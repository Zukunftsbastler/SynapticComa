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
import { setGuestLevelLoadHandler } from '@/systems/GuestSyncSystem';
import { GameState } from '@/state/GameState';
import { loadProgress, ProgressionState } from '@/state/ProgressionState';
import { LEVEL_ORDER } from '@/levels/levelIndex';
import { initKeyboardInput } from '@/input/KeyboardInput';
import { peerManager } from '@/network/PeerJSManager';
import type { LevelLoadMessage } from '@/network/messages';
import { LobbyUI } from '@/ui/LobbyUI';
import type { LobbyResult } from '@/ui/LobbyUI';
import { HUD } from '@/ui/HUD';
import { InventoryPanel } from '@/ui/InventoryPanel';
import { AbilityPanel } from '@/ui/AbilityPanel';
import { MatrixUI } from '@/ui/MatrixUI';
import { LevelCompleteScreen, NeuralCollapseScreen } from '@/ui/LevelCompleteScreen';
import { MonitorStrip } from '@/ui/MonitorStrip';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/constants';

let driver:    PixiDriver;
let matrixUI:  MatrixUI | null = null;
let overlay:   { destroy(): void } | null = null;
let networked = false;
let transitioning = false;

async function goToLevel(levelId: string, carriedFailures: number): Promise<void> {
  transitioning = true;
  overlay?.destroy();
  overlay = null;
  matrixUI?.destroy();
  matrixUI = null;

  setWorld(await loadLevel(world, levelId));
  GameState.failureCount = carriedFailures;

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

function watchGamePhase(): void {
  if (transitioning || overlay) return;

  // ── Level complete ────────────────────────────────────────────────────────
  if (GameState.phase === 'LEVEL_COMPLETE') {
    const interactive = !networked || GameState.localPlayerId === 0;
    overlay = new LevelCompleteScreen(
      document.body,
      nextId => { void goToLevel(nextId, 0); },
      ()     => window.location.reload(),   // "Level Select" → lobby, progress persisted
      interactive,
    );
    return;
  }

  // ── Failure (CollisionSystem halted the simulation) ───────────────────────
  if (GameState.phase === 'SETUP' && GameState.currentLevel !== '') {
    if (GameState.failureCount >= 2) {
      overlay = new NeuralCollapseScreen(document.body, () => window.location.reload());
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
  GameState.viewPlayerId = result.networked ? result.role : 0;

  // ── Persistent UI (polls GameState each frame; survives level reloads) ────
  const hud       = new HUD(document.body);
  const invPanel  = new InventoryPanel(document.body);
  const abilities = new AbilityPanel(document.body);
  const monitor   = new MonitorStrip(document.body, networked);
  setUiHook(() => {
    // Local mode: when P1 dissolves into the Nexus, hand control to P2 so the
    // player is never left staring at an empty board.
    if (!networked && GameState.p1HasExited && GameState.viewPlayerId === 0) {
      GameState.viewPlayerId = 1;
    }
    hud.update();
    invPanel.update();
    abilities.update();
    monitor.update();
    watchGamePhase();
  });

  // ── Input ────────────────────────────────────────────────────────────────
  initKeyboardInput(() => `avatar_p${GameState.viewPlayerId + 1}`);

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
  });

  // ── Guest follows the Host's level loads ─────────────────────────────────
  setGuestLevelLoadHandler((levelId, failureCount) => {
    void goToLevel(levelId, failureCount);
  });

  // ── Enter the campaign at the persisted position (Host/local decides) ────
  const startId = result.role === 0
    ? LEVEL_ORDER[Math.min(ProgressionState.currentLevelIndex, LEVEL_ORDER.length - 1)]
    : result.levelId;
  void goToLevel(startId, 0);

  startLoop();
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width:      CANVAS_WIDTH,
    height:     CANVAS_HEIGHT,
    background: 0x000000,
  });
  document.body.appendChild(app.canvas);

  driver = new PixiDriver(app);
  setDriver(driver);

  loadProgress();
  new LobbyUI(document.body, startSession);
}

main().catch(console.error);
