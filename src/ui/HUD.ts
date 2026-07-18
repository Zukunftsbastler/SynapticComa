// HUD: DOM-based heads-up display. Polls GameState and abilityFlags each frame
// (called from main.ts render loop). No EventBus — read GameState directly
// (Decision 7: no EventBus in this codebase).
//
// Layout: AP pool vials (top-left) | Dead End indicator (top-center) |
//         active ability icons (top-right)
// The AP pool is persistent: it never resets, and Shared Unlock surges can push
// it above the level's starting value (the vial row grows to match).
// Art direction: medical macabre palette from docs/art_and_ui.md.

import { GameState } from '@/state/GameState';
import { abilityFlags } from '@/systems/AbilitySystem';
import { AbilityType } from '@/types';

const ABILITY_LABELS: Partial<Record<AbilityType, string>> = {
  [AbilityType.JUMP]:         '↑↑ JUMP',
  [AbilityType.PUSH]:         '▶ PUSH',
  [AbilityType.UNLOCK_RED]:   '🔴 UNLOCK',
  [AbilityType.UNLOCK_BLUE]:  '🔵 UNLOCK',
  [AbilityType.PHASE_SHIFT]:  '◈ PHASE',
  [AbilityType.FIRE_IMMUNITY]:'🔥 IMMUNE',
};

export class HUD {
  private el:         HTMLElement;
  private apRow:      HTMLElement;
  private deadEndEl:  HTMLElement;
  private abilityEl:  HTMLElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;top:8px;left:0;right:0;display:flex;',
      'align-items:flex-start;justify-content:space-between;',
      'padding:0 16px;pointer-events:none;z-index:20;font-family:monospace;',
    ].join('');

    this.apRow = document.createElement('div');
    this.apRow.style.cssText = 'display:flex;gap:6px;align-items:center;';

    this.deadEndEl = document.createElement('div');
    this.deadEndEl.style.cssText = [
      'color:#8a2020;font-size:0.85rem;letter-spacing:0.15em;',
      'border:1px solid #4a1010;padding:2px 10px;display:none;',
      'background:#120404;',
    ].join('');
    this.deadEndEl.textContent = '⊘ DEAD END';

    this.abilityEl = document.createElement('div');
    this.abilityEl.style.cssText = 'display:flex;gap:6px;align-items:center;';

    this.el.appendChild(this.apRow);
    this.el.appendChild(this.deadEndEl);
    this.el.appendChild(this.abilityEl);
    container.appendChild(this.el);
  }

  /** Call each render frame to sync display with current GameState. */
  update(): void {
    this.renderAP();
    this.renderDeadEnd();
    this.renderAbilities();
  }

  private renderAP(): void {
    const { apPool, apMax } = GameState;
    // The pool is persistent and can surge above the starting value — the
    // vial row grows with the high-water mark (never a "round reset" refill).
    const vials = Math.max(apMax, apPool);
    const circles: string[] = [];
    for (let i = 0; i < vials; i++) {
      const filled = i < apPool;
      circles.push(
        `<span style="width:14px;height:14px;border-radius:50%;display:inline-block;` +
        `background:${filled ? '#d4820a' : '#2a1808'};border:1px solid #7a4010;"></span>`,
      );
    }
    this.apRow.innerHTML =
      `<span style="color:#7a6040;font-size:0.75rem;margin-right:4px">AP</span>` +
      circles.join('');
  }

  // Dead End: subtle, language-agnostic-adjacent indicator (art_and_ui.md §5 —
  // the board does not flash or alarm; the silence communicates the state).
  private renderDeadEnd(): void {
    this.deadEndEl.style.display = GameState.deadEnd ? 'block' : 'none';
    this.el.style.opacity = GameState.deadEnd ? '0.85' : '1';
  }

  private renderAbilities(): void {
    const active: string[] = [];
    if (abilityFlags.jumpActive)       active.push(ABILITY_LABELS[AbilityType.JUMP]       ?? '');
    if (abilityFlags.pushActive)       active.push(ABILITY_LABELS[AbilityType.PUSH]       ?? '');
    if (abilityFlags.phaseShiftActive) active.push(ABILITY_LABELS[AbilityType.PHASE_SHIFT] ?? '');
    this.abilityEl.innerHTML = active
      .map(label =>
        `<span style="background:#1e1008;color:#50d050;border:1px solid #2a5020;` +
        `padding:2px 6px;font-size:0.7rem;letter-spacing:0.05em">${label}</span>`,
      )
      .join('');
  }

  destroy(): void {
    this.el.remove();
  }
}
