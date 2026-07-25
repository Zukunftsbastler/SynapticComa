// CutscenePlayer: plays one narrative beat as a sequence of silent panels
// (docs/narrative.md §5). Plain DOM overlay, following LevelCompleteScreen's
// convention exactly — no PixiJS, no ECS. The ECS side of this feature is the
// event that made the beat due (NarrativeBeatEvent); everything from here on
// is presentation.
//
// Deliberately presentational only: it reports what happened via `onDone` and
// never writes NarrativeState itself, so the campaign controller stays the one
// place that commits story progress.
//
// DISPLAY SIZE (body_awakening.md §7): panels render as a modest framed image,
// not a full-bleed splash — "eher kleine Bilder als zu große", and the same
// `image-rendering: pixelated` treatment the rest of the game's art gets.
//
// TEXT (narrative.md §5.2b): the panel itself is wordless; the Monitor's CRT
// line beneath it is the single sanctioned exception.

import type { BeatDef } from './beats';
import { BeatKind, monitorLine } from './beats';

export interface CutsceneOptions {
  storyVariant: number;
  /** false on the Guest — the Host drives advancement (CUTSCENE_ADVANCE). */
  interactive:  boolean;
  /** Host only: fires on every advance so the Guest can be kept in lockstep. */
  onAdvance?:   (panelIndex: number) => void;
  /** Fires once, when the last panel is dismissed or the beat is skipped.
   *  `forkChoice` is set only for a FORK beat the player actually answered. */
  onDone:       (forkChoice?: 'motor' | 'sense') => void;
}

export class CutscenePlayer {
  private el:    HTMLElement;
  private stage: HTMLElement;
  private index = 0;
  private done  = false;

  constructor(
    container: HTMLElement,
    private beat: BeatDef,
    private opts: CutsceneOptions,
  ) {
    this.el = document.createElement('div');
    this.el.dataset.cutscene = beat.key;
    this.el.style.cssText = [
      'position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:18px;',
      // Above LevelCompleteScreen (200): the beat plays after it, and must
      // never be competed with by a stale overlay behind it.
      'background:#050706;z-index:300;font-family:monospace;',
      opts.interactive ? 'cursor:pointer;' : '',
    ].join('');

    this.stage = document.createElement('div');
    this.stage.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;';
    this.el.appendChild(this.stage);

    if (opts.interactive) {
      this.el.addEventListener('click', () => this.advance());
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.advance(); }
        if (e.key === 'Escape') this.finish();
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    container.appendChild(this.el);
    this.render();
  }

  private keyHandler?: (e: KeyboardEvent) => void;

  private render(): void {
    this.stage.replaceChildren();
    const panel = this.beat.panels[this.index];
    if (!panel) return;

    const frame = document.createElement('div');
    frame.dataset.cutscenePanel = String(this.index);
    // Placeholder until art exists: a flat wash in the clinical-reality
    // palette. Setting PanelDef.asset is the whole art-integration step.
    frame.style.cssText = [
      'width:420px;height:260px;border:1px solid #2a3230;',
      `background:${panel.tint};`,
      'display:flex;align-items:center;justify-content:center;overflow:hidden;',
      'box-shadow:0 0 60px #000 inset;',
    ].join('');

    if (panel.asset) {
      const img = document.createElement('img');
      img.src = `/cutscenes/${panel.asset}`;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;image-rendering:pixelated;';
      frame.appendChild(img);
    }
    this.stage.appendChild(frame);

    const monitor = document.createElement('div');
    monitor.dataset.cutsceneMonitor = '';
    monitor.textContent = monitorLine(panel, this.opts.storyVariant);
    monitor.style.cssText = [
      'color:#6f8a78;font-size:0.72rem;letter-spacing:0.18em;',
      'max-width:420px;text-align:center;',
    ].join('');
    this.stage.appendChild(monitor);

    const isLast = this.index === this.beat.panels.length - 1;
    if (this.beat.kind === BeatKind.FORK && isLast) {
      this.stage.appendChild(this.renderForkChoice());
    } else {
      this.stage.appendChild(this.renderFooter(isLast));
    }
  }

  /** The one place a beat asks for input rather than just being watched
   *  (body_awakening.md §4a). Emphasis, not exclusivity — the level sequence
   *  is identical either way; only which Act-3 region wakes differs. */
  private renderForkChoice(): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;margin-top:4px;';
    if (!this.opts.interactive) {
      const waiting = document.createElement('div');
      waiting.textContent = 'WAITING FOR HOST…';
      waiting.style.cssText = 'color:#3f5248;letter-spacing:0.2em;font-size:0.7rem;';
      row.appendChild(waiting);
      return row;
    }
    for (const [choice, label] of [['motor', 'MOVEMENT'], ['sense', 'PERCEPTION']] as const) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.fork = choice;
      btn.style.cssText = [
        'background:#16201c;color:#8fae9c;border:1px solid #2a3230;',
        'padding:8px 20px;font-family:monospace;font-size:0.75rem;',
        'letter-spacing:0.16em;cursor:pointer;',
      ].join('');
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.finish(choice); });
      row.appendChild(btn);
    }
    return row;
  }

  private renderFooter(isLast: boolean): HTMLElement {
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;align-items:center;gap:16px;margin-top:2px;';

    if (!this.opts.interactive) {
      const waiting = document.createElement('div');
      waiting.textContent = 'WAITING FOR HOST…';
      waiting.style.cssText = 'color:#3f5248;letter-spacing:0.2em;font-size:0.7rem;';
      footer.appendChild(waiting);
      return footer;
    }

    // No button labels — the arrow is universal (narrative.md §5.1). The dots
    // double as a progress read so a multi-panel beat never feels open-ended.
    const dots = document.createElement('div');
    dots.style.cssText = 'color:#3f5248;letter-spacing:0.4em;font-size:0.7rem;';
    dots.textContent = this.beat.panels.map((_, i) => (i === this.index ? '●' : '○')).join('');
    footer.appendChild(dots);

    const arrow = document.createElement('div');
    arrow.dataset.cutsceneAdvance = '';
    arrow.textContent = isLast ? '▶|' : '▶';
    arrow.style.cssText = 'color:#8fae9c;font-size:1rem;';
    footer.appendChild(arrow);

    const skip = document.createElement('button');
    skip.textContent = 'SKIP';
    skip.dataset.cutsceneSkip = '';
    skip.style.cssText = [
      'background:none;color:#3f5248;border:1px solid #1e2a24;',
      'padding:3px 10px;font-family:monospace;font-size:0.6rem;',
      'letter-spacing:0.16em;cursor:pointer;',
    ].join('');
    skip.addEventListener('click', (e) => { e.stopPropagation(); this.finish(); });
    footer.appendChild(skip);

    return footer;
  }

  private advance(): void {
    if (this.done) return;
    // A FORK's final panel waits for an actual answer — clicking past it would
    // silently pick a track on the player's behalf.
    if (this.beat.kind === BeatKind.FORK && this.index === this.beat.panels.length - 1) return;
    if (this.index >= this.beat.panels.length - 1) { this.finish(); return; }
    this.index += 1;
    this.opts.onAdvance?.(this.index);
    this.render();
  }

  /** Guest-side: follow the Host's panel index verbatim (CUTSCENE_ADVANCE). */
  showPanel(index: number): void {
    if (this.done || index === this.index) return;
    this.index = Math.max(0, Math.min(index, this.beat.panels.length - 1));
    this.render();
  }

  private finish(forkChoice?: 'motor' | 'sense'): void {
    if (this.done) return;
    this.done = true;
    this.destroy();
    this.opts.onDone(forkChoice);
  }

  /** Guest-side: the Host finished the beat and moved on. */
  finishFromRemote(): void {
    if (this.done) return;
    this.done = true;
    this.destroy();
  }

  destroy(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.el.remove();
  }
}
