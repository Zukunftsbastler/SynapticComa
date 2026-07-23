// TutorialDirector: the Monitor's sequencing brain (tutorial_design.md §4.2).
// Replaces TutorialPopups.ts — same "at most one box, exactly once per
// profile" contract, now driving TutorialOverlay's dim/frame/arrow
// presentation instead of a plain centered popup, and able to run Level 1's
// scripted Calibration sequence (calibration.ts) before falling back to
// reactive mode (today's behavior: first unseen concept whose trigger fires).
//
// Called once per frame from main.ts's uiHook, exactly where TutorialPopups
// was — deliberately NOT added to pipeline.ts's runCoreSystems. This is
// read-only/presentation-only and purely local per client (tutorial_design.md
// §3: "In networked play, tutorial state is local per client"), same
// reasoning that already keeps RenderSystem itself out of the deterministic
// tick pipeline.

import { GameState } from '@/state/GameState';
import { hasSeen, markSeen } from './TutorialState';
import { CONCEPTS } from './concepts';
import type { ConceptDef, BlockingSpec } from './concepts';
import { CALIBRATION_SEQUENCE } from './calibration';
import { TutorialOverlay } from './TutorialOverlay';
import type { PixiDriver } from '@/rendering/PixiDriver';

const SKIP_HOLD_MS = 1000; // doc §3.6 — "hold ESC"

const CONCEPTS_BY_ID = new Map(CONCEPTS.map((c) => [c.id, c] as const));

export class TutorialDirector {
  private overlay:        TutorialOverlay;
  private active:         ConceptDef | null = null;
  private activeBlocking: BlockingSpec | null = null;
  private activeSnapshot: unknown = null;
  private escDownAt:      number | null = null;
  private lastLevel       = '';

  constructor(container: HTMLElement, driver: PixiDriver) {
    this.overlay = new TutorialOverlay(container, driver);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.active && !this.activeBlocking) this.dismissActive();
      if (e.key === 'Escape' && this.escDownAt === null) this.escDownAt = performance.now();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') this.escDownAt = null;
    });
  }

  /** Call each render frame — shows at most one unseen concept at a time. */
  update(): void {
    // A level reload mid-step invalidates any in-flight snapshot (the target
    // entity may no longer exist) — drop it rather than let it hang forever.
    if (GameState.currentLevel !== this.lastLevel) {
      this.lastLevel = GameState.currentLevel;
      this.clearActive();
    }

    if (GameState.phase !== 'PLAYING') return;

    if (this.escDownAt !== null && performance.now() - this.escDownAt >= SKIP_HOLD_MS) {
      this.skipCurrent();
      this.escDownAt = null;
    }

    if (this.active) {
      this.pollActive();
      return;
    }

    const next = this.pickNext();
    if (next) this.activate(next);
  }

  private pickNext(): ConceptDef | null {
    // Script mode: Level 1 only, strict order, until every Calibration step
    // is seen — after that this level falls through to reactive mode too
    // (the seen-set already prevents re-running the script on a replay).
    if (GameState.currentLevel === 'level_01') {
      for (const id of CALIBRATION_SEQUENCE) {
        if (!hasSeen(id)) return CONCEPTS_BY_ID.get(id) ?? null;
      }
    }
    for (const c of CONCEPTS) {
      if (hasSeen(c.id)) continue;
      if (c.trigger()) return c;
    }
    return null;
  }

  private activate(c: ConceptDef): void {
    this.active         = c;
    this.activeBlocking = c.blocking ? c.blocking() : null;
    this.activeSnapshot = this.activeBlocking ? this.activeBlocking.snapshot() : null;
    this.overlay.show({
      title:    c.title,
      bodyHtml: c.bodyHtml,
      focus:    c.focus(),
      waitingForAction: this.activeBlocking !== null,
      onDismiss: () => this.dismissActive(),
    });
  }

  private pollActive(): void {
    if (!this.active) return;
    this.overlay.tick();
    // Non-blocking steps no longer time out (Till's ask, 2026-07-24: "es ging
    // für mich immer zu schnell" — every box, blocking or not, now waits for
    // an explicit dismissal: the described action for blocking steps, a click
    // or Enter for non-blocking ones). A deliberate deviation from
    // tutorial_design.md §3.5's 8-second non-blocking timeout — see the
    // status banner there.
    if (this.activeBlocking && this.activeBlocking.isComplete(this.activeSnapshot)) {
      this.completeActive();
    }
  }

  private completeActive(): void {
    if (this.active) markSeen(this.active.id);
    this.clearActive();
  }

  /** Enter dismisses non-blocking steps (their only way to complete, now that
   *  they no longer time out) — a blocking step ignores Enter and waits for
   *  the action itself, per doc §3.5 ("stays until the player performs the
   *  described action, not until they click OK"). */
  private dismissActive(): void {
    if (this.activeBlocking) return;
    this.completeActive();
  }

  /** Hold-ESC skip (doc §3.6): marks whatever's currently pending as seen —
   *  the active box, the rest of Calibration if mid-script, and any other
   *  concept whose trigger already fires right now. */
  private skipCurrent(): void {
    if (this.active) markSeen(this.active.id);
    if (GameState.currentLevel === 'level_01') {
      for (const id of CALIBRATION_SEQUENCE) markSeen(id);
    }
    for (const c of CONCEPTS) {
      if (!hasSeen(c.id) && c.trigger()) markSeen(c.id);
    }
    this.clearActive();
  }

  private clearActive(): void {
    this.active         = null;
    this.activeBlocking = null;
    this.activeSnapshot = null;
    this.overlay.hide();
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
