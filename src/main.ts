// main.ts — campaign controller.
//
// Boot sequence: Lobby (HOST / JOIN / LOCAL) → loadLevel → play.
// Owns the per-level UI lifecycle (MatrixUI listeners are torn down and
// rebuilt on every level load) and the campaign flow:
//   LEVEL_COMPLETE → LevelCompleteScreen → next level (Host decides)
//   1st failure    → automatic retry reload (failureCount carried over)
//   2nd failure    → NeuralCollapseScreen → back to lobby (page reload)
//   Dead End       → Enter restarts the level free of charge (no retry spent)
//
// Networked play: the Host drives every level load and mirrors it to the
// Guest via LEVEL_LOAD (sent directly — resetGameState clears the outbound
// queue, so the tick pipeline cannot carry it). Local play: one machine,
// keys 1/2 toggle which wisp is viewed/controlled; the simulation always
// stays Host-authoritative (GameState.viewPlayerId vs. localPlayerId).

import { Application } from 'pixi.js';
import { startLoop, world, setWorld, setDriver, setUiHook } from '@/gameLoop';
import { PixiDriver } from '@/rendering/PixiDriver';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { setGuestLevelLoadHandler, setGuestCutsceneHandler } from '@/systems/GuestSyncSystem';
import { GameState } from '@/state/GameState';
import { inventory } from '@/state/InventoryState';
import { scrapPool } from '@/state/ScrapPoolState';
import { uiState } from '@/ui/uiState';
import { loadProgress, ProgressionState } from '@/state/ProgressionState';
import {
  NarrativeState, loadNarrative, hasSeenBeat, markBeatSeen, unlockRegion, setForkChoice,
} from '@/state/NarrativeState';
import { CutscenePlayer } from '@/narrative/CutscenePlayer';
import { BEATS, BeatId } from '@/narrative/beats';
import { LEVEL_ORDER } from '@/levels/levelIndex';
import { initKeyboardInput } from '@/input/KeyboardInput';
import { initMouseInput } from '@/input/MouseInput';
import { peerManager } from '@/network/PeerJSManager';
import type { LevelLoadMessage, CutsceneAdvanceMessage } from '@/network/messages';
import { LobbyUI } from '@/ui/LobbyUI';
import type { LobbyResult } from '@/ui/LobbyUI';
import { HUD } from '@/ui/HUD';
import { InventoryPanel } from '@/ui/InventoryPanel';
import { AbilityPanel } from '@/ui/AbilityPanel';
import { MatrixUI } from '@/ui/MatrixUI';
import { LevelCompleteScreen, NeuralCollapseScreen } from '@/ui/LevelCompleteScreen';
import { LevelSelectScreen } from '@/ui/LevelSelectScreen';
import { MonitorStrip } from '@/ui/MonitorStrip';
import { LegendPanel } from '@/ui/LegendPanel';
import { HoverTooltip } from '@/ui/HoverTooltip';
import { TutorialDirector } from '@/tutorial/TutorialDirector';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/constants';

let driver:    PixiDriver;
let matrixUI:  MatrixUI | null = null;
let overlay:   { destroy(): void } | null = null;
let networked = false;
let transitioning = false;

// Verification-only bypass (Playwright e2e, generative_levels.md §3's
// acceptance gate): ?debugLevel=<id> skips the Lobby and Level Select
// entirely and loads that level directly in local mode, ignoring
// ProgressionState's unlock rule. Mirrors the existing GameState.revealBothDims
// "local-testing flag" precedent (SPRINT_025) — additive, never touched by
// normal play.
const debugLevel = new URLSearchParams(location.search).get('debugLevel');

// Narrative beats are campaign flow, not level mechanics, so ?debugLevel=
// (the Playwright level-verification harness) suppresses them by default —
// a full-screen cutscene overlay would otherwise swallow the witness's clicks
// exactly the way a blocking tutorial box did in SPRINT_029. ?narrative=1 opts
// back in, which is how the narrative e2e spec drives this code path.
const narrativeEnabled =
  !debugLevel || new URLSearchParams(location.search).has('narrative');

let cutscene: CutscenePlayer | null = null;

// Read-only introspection surface for e2e/actionToInput.ts (Playwright can't
// import app modules directly — it drives real clicks/keys from outside the
// page, then reads live state through this to decide what to click next).
// Only ever populated when debugLevel is set; absent in normal play.
declare global {
  interface Window {
    __e2e?: {
      GameState:  typeof GameState;
      inventory:  typeof inventory;
      scrapPool:  typeof scrapPool;
      uiState:    typeof uiState;
      driver:     PixiDriver;
      tutorials:  TutorialDirector;
    };
  }
}

async function goToLevel(levelId: string, carriedFailures: number): Promise<void> {
  transitioning = true;
  overlay?.destroy();
  overlay = null;
  matrixUI?.destroy();
  matrixUI = null;

  setWorld(await loadLevel(world, levelId));
  GameState.failureCount = carriedFailures;
  // Local mode: every level starts with P1 in control. Without this, the
  // auto-switch to P2 (after P1's exit) leaks into the next level and the
  // player starts staring at P2's empty inventory.
  if (!networked) GameState.viewPlayerId = 0;

  // Keep the campaign index aligned with what is actually being played.
  const idx = LEVEL_ORDER.indexOf(levelId);
  if (idx >= 0) ProgressionState.currentLevelIndex = idx;

  const origin = driver.getMatrixOrigin();
  matrixUI = new MatrixUI(origin.x, origin.y);

  // Host mirrors every load to the Guest — next level, retry, or free restart.
  if (networked && GameState.localPlayerId === 0) {
    const msg: LevelLoadMessage = { type: 'LEVEL_LOAD', levelId, failureCount: carriedFailures };
    peerManager.send(msg);
  }
  transitioning = false;
}

function broadcastCutscene(beatId: number, panelIndex: number): void {
  if (!networked || GameState.localPlayerId !== 0) return;
  const msg: CutsceneAdvanceMessage = {
    type: 'CUTSCENE_ADVANCE', beatId, panelIndex,
    storyVariant: NarrativeState.storyVariant,
  };
  peerManager.send(msg);
}

/**
 * Plays queued beats one after another, then runs `onComplete`.
 *
 * Host/local only — on the Guest, GameState.pendingBeats is always empty
 * (NarrativeBeatEvent is produced by Host-only systems) and the cutscene is
 * opened by CUTSCENE_ADVANCE instead.
 *
 * Beats never auto-replay: revisiting level 5 must not force its cutscene
 * again, so an already-seen beat is skipped here rather than being filtered
 * out further upstream — the ECS event stays a pure "this beat is due" signal,
 * and a future replay-from-gallery entry point can reuse the same path.
 */
function playBeatQueue(queue: number[], onComplete: () => void): void {
  const beatId = queue.shift();
  if (beatId === undefined) { onComplete(); return; }

  const def = BEATS[beatId as BeatId];
  if (!def || hasSeenBeat(def.key)) { playBeatQueue(queue, onComplete); return; }

  const player = new CutscenePlayer(document.body, def, {
    storyVariant: NarrativeState.storyVariant,
    interactive:  true, // only ever constructed on the Host/local machine
    onAdvance:    panelIndex => broadcastCutscene(beatId, panelIndex),
    onDone:       forkChoice => {
      // The player is presentational; committing story progress happens here,
      // in the one place that owns campaign state.
      markBeatSeen(def.key);
      if (def.region) unlockRegion(def.region);
      if (forkChoice) setForkChoice(forkChoice);
      broadcastCutscene(beatId, -1);
      cutscene = null;
      overlay  = null;
      playBeatQueue(queue, onComplete);
    },
  });
  // Occupies the same slot as any other overlay: watchGamePhase must not open
  // a second LevelCompleteScreen behind a playing beat.
  cutscene = player;
  overlay  = player;
  broadcastCutscene(beatId, 0);
}

function openLevelSelect(closable: boolean): void {
  overlay?.destroy();
  overlay = new LevelSelectScreen(
    document.body,
    levelId => { overlay = null; void goToLevel(levelId, 0); },
    closable ? () => { overlay = null; } : undefined,
  );
}

function watchGamePhase(): void {
  if (transitioning || overlay) return;

  // ── Level complete ────────────────────────────────────────────────────────
  if (GameState.phase === 'LEVEL_COMPLETE') {
    const interactive = !networked || GameState.localPlayerId === 0;
    // Drain here, not at playback time: goToLevel() calls resetGameState(),
    // which would clear the queue before the player ever dismisses this
    // screen. Always drained, even with narrative off, so the queue can never
    // leak into a later level.
    const drained = GameState.pendingBeats.splice(0);
    const queued  = narrativeEnabled ? drained : [];
    // D16: the beat plays AFTER this screen — mechanical resolution first
    // ("NEXUS CLEARED"), then the story, then the next level.
    overlay = new LevelCompleteScreen(
      document.body,
      nextId => { overlay = null; playBeatQueue(queued, () => void goToLevel(nextId, 0)); },
      ()     => { overlay = null; playBeatQueue(queued, () => openLevelSelect(false)); },
      interactive,
    );
    return;
  }

  // ── Failure (CollisionSystem halted the simulation) ───────────────────────
  if (GameState.phase === 'SETUP' && GameState.currentLevel !== '') {
    if (GameState.failureCount >= 2) {
      overlay = new NeuralCollapseScreen(document.body, () => openLevelSelect(false));
    } else if (!networked || GameState.localPlayerId === 0) {
      // First failure: instant retry, failure count carried over (mechanics.md §7).
      const level = GameState.currentLevel;
      const failures = GameState.failureCount;
      overlay = { destroy() {} }; // block re-entry while the timer runs
      setTimeout(() => { void goToLevel(level, failures); }, 800);
    }
  }
}

function startSession(result: LobbyResult): void {
  networked = result.networked;
  GameState.viewPlayerId   = result.networked ? result.role : 0;
  // Local single-machine play: show both dimensions side by side so the
  // player sees what the other wisp's board looks like (debug layout,
  // digital_implementation.md §3). Networked play keeps the strict mask.
  GameState.revealBothDims = !result.networked;

  // ── Persistent UI (polls GameState each frame; survives level reloads) ────
  const hud       = new HUD(document.body);
  const invPanel  = new InventoryPanel(document.body);
  const abilities = new AbilityPanel(document.body);
  const monitor   = new MonitorStrip(document.body, networked);
  const legend    = new LegendPanel(document.body);
  const tooltip   = new HoverTooltip(document.body);
  const tutorials = new TutorialDirector(document.body, driver);
  if (debugLevel) {
    window.__e2e = { GameState, inventory, scrapPool, uiState, driver, tutorials };
  }
  setUiHook(() => {
    // Local mode: when P1 dissolves into the Nexus, hand control to P2 so the
    // player is never left staring at an empty board. Suppressed under
    // ?debugLevel=: the solver's witness (LevelSolver.ts) treats both
    // inventories as one ownership-agnostic pool, matching NETWORKED play
    // (each client keeps permanent access to its own board) — this local-only
    // convenience would otherwise strand a witness that has the exited
    // player's leftover plate still needed for a later Insert, a restriction
    // that doesn't exist in real (networked) play and that the solver never
    // modeled in the first place.
    if (!networked && !debugLevel && GameState.p1HasExited && GameState.viewPlayerId === 0) {
      GameState.viewPlayerId = 1;
    }
    hud.update();
    invPanel.update();
    abilities.update();
    monitor.update();
    legend.update();
    tooltip.update();
    tutorials.update();
    watchGamePhase();
  });

  // ── Input ────────────────────────────────────────────────────────────────
  initKeyboardInput(() => `avatar_p${GameState.viewPlayerId + 1}`);
  initMouseInput(driver);

  window.addEventListener('keydown', (e) => {
    // Local mode: 1/2 toggles which wisp this machine views and controls.
    if (!networked && (e.key === '1' || e.key === '2')) {
      GameState.viewPlayerId = e.key === '1' ? 0 : 1;
    }
    // Dead End: Enter restarts the level without consuming the retry.
    if (
      e.key === 'Enter' && GameState.deadEnd && !transitioning &&
      (!networked || GameState.localPlayerId === 0)
    ) {
      void goToLevel(GameState.currentLevel, GameState.failureCount);
    }
    // Esc: level select (host/local decide the level; the Guest follows).
    // Suppressed under ?debugLevel=: Escape is also the Monitor's documented
    // hold-to-skip affordance (TutorialDirector.ts, doc §3.6) — the e2e
    // verification harness (e2e/actionToInput.ts) uses it to clear a blocking
    // concept the witness's own actions will never satisfy (e.g. a
    // "rotate the existing plate" tip when the witness only ever inserts a
    // fresh one). Without this guard the same keypress would also hijack the
    // session into LevelSelectScreen mid-replay.
    if (
      e.key === 'Escape' && !transitioning && !debugLevel &&
      (!networked || GameState.localPlayerId === 0)
    ) {
      if (overlay instanceof LevelSelectScreen) {
        overlay.destroy();
        overlay = null;
      } else if (!overlay) {
        openLevelSelect(true);
      }
    }
  });

  // ── Guest follows the Host's level loads ─────────────────────────────────
  setGuestLevelLoadHandler((levelId, failureCount) => {
    void goToLevel(levelId, failureCount);
  });

  // ── Guest watches the same beat, panel for panel ─────────────────────────
  // Purely reactive: the Guest never advances a beat itself, matching the
  // "WAITING FOR HOST…" behaviour its LevelCompleteScreen already has.
  setGuestCutsceneHandler((beatId, panelIndex, storyVariant) => {
    if (panelIndex < 0) {
      cutscene?.finishFromRemote();
      cutscene = null;
      overlay  = null;
      return;
    }
    if (!cutscene) {
      const def = BEATS[beatId as BeatId];
      if (!def) return;
      overlay?.destroy(); // replaces the Guest's own LevelCompleteScreen
      cutscene = new CutscenePlayer(document.body, def, {
        storyVariant,
        interactive: false,
        onDone:      () => { cutscene = null; overlay = null; },
      });
      overlay = cutscene;
    }
    cutscene.showPanel(panelIndex);
  });

  // ── Host/local: choose the level; Guest: load the handshake level and
  //    follow the Host's LEVEL_LOAD messages from there. ────────────────────
  if (debugLevel) {
    void goToLevel(debugLevel, 0);
  } else if (result.role === 0) {
    // The opening sequence (narrative.md §5.1) runs once ever, before the
    // campaign is first entered — hasSeenBeat makes every later session skip
    // straight to the level select.
    playBeatQueue(narrativeEnabled ? [BeatId.PROLOGUE] : [], () => openLevelSelect(false));
  } else {
    void goToLevel(result.levelId, 0);
  }

  startLoop();
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width:       CANVAS_WIDTH,
    height:      CANVAS_HEIGHT,
    background:  0x000000,
    // Without this, PixiJS renders at a fixed 1280x720 backing buffer
    // regardless of the display — on a Retina/HiDPI screen (devicePixelRatio
    // 2, typical on modern Macs) the browser then has to upscale that buffer
    // to fill physical pixels, softening every sprite generically on top of
    // whatever detail loss the sprite's own resolution already has. `width`/
    // `height` above stay the logical CSS size either way; only the backing
    // buffer gets sharper.
    resolution:  window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);

  driver = new PixiDriver(app);
  setDriver(driver);

  loadProgress();
  loadNarrative(); // separate storage key: story and campaign progress reset independently
  if (debugLevel) {
    startSession({ role: 0, levelId: debugLevel, networked: false });
  } else {
    new LobbyUI(document.body, startSession);
  }
}

main().catch(console.error);
