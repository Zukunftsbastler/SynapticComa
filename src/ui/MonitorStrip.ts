// MonitorStrip: v0 of "The Monitor" (tutorial_design.md §1) — a diegetic CRT
// status line at the bottom of the screen that always answers two questions:
// WHAT is my goal right now, and WHICH keys do something.
//
// This is the minimal onboarding layer; the full concept registry, highlight
// framing, and the scripted Calibration intro follow in the Monitor sprint.
// Polls GameState each frame like HUD (no EventBus — Decision 7).

import { GameState } from '@/state/GameState';
import { world } from '@/gameLoop';
import { apUnlockQuery } from '@/queries';
import { APUnlock } from '@/components';
import { inventory } from '@/state/InventoryState';

const P1_KEYS = 'W/A/S/D/Q/E';
const P2_KEYS = 'I/J/K/L/U/O';

export class MonitorStrip {
  private el:   HTMLElement;
  private text: HTMLElement;
  private networked: boolean;

  constructor(container: HTMLElement, networked: boolean) {
    this.networked = networked;
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;left:0;right:0;bottom:0;padding:8px 16px;',
      'background:#040a04ee;border-top:1px solid #1a3a1a;',
      'font-family:monospace;font-size:0.85rem;color:#50d050;',
      'letter-spacing:0.06em;z-index:30;text-shadow:0 0 6px #205020;',
    ].join('');

    const tag = document.createElement('span');
    tag.textContent = '▌MONITOR▐ ';
    tag.style.cssText = 'color:#2a7a2a;margin-right:8px;';

    this.text = document.createElement('span');

    this.el.appendChild(tag);
    this.el.appendChild(this.text);
    container.appendChild(this.el);
  }

  /** Call each render frame. */
  update(): void {
    this.text.textContent = this.composeLine();
  }

  private composeLine(): string {
    const gs = GameState;

    if (gs.phase === 'LEVEL_COMPLETE') {
      return 'NEXUS CLEARED. AWAITING NEXT DESCENT.';
    }
    if (gs.phase === 'SETUP') {
      return 'SIGNAL LOST. RECALIBRATING…';
    }
    if (gs.deadEnd) {
      return 'DEAD END — THIS LEVEL CAN NO LONGER BE WON WITH THE REMAINING AP. PRESS [ENTER] FOR A FREE RESTART (NO RETRY CONSUMED).';
    }

    const parts: string[] = [];

    if (!gs.p1HasExited) {
      if (gs.viewPlayerId === 0) {
        parts.push(`GUIDE P1 (VIOLET) TO THE GREEN NEXUS EXIT · KEYS ${P1_KEYS} (SHOWN ON TILES) OR CLICK A NEIGHBOR TILE · 1 AP/STEP`);
      } else {
        parts.push(`GUIDE P2 (CYAN) · KEYS ${P2_KEYS} (SHOWN ON TILES) OR CLICK · P1 MUST REACH ITS EXIT FIRST`);
      }
    } else {
      parts.push(`P1 HAS MERGED WITH THE NEXUS. GUIDE P2 (CYAN) TO THE NOW-OPEN EXIT · KEYS ${P2_KEYS} OR CLICK`);
    }

    if (this.hasUntriggeredUnlock()) {
      parts.push('GOLD NODE: BOTH WISPS ON IT SIMULTANEOUSLY = +AP');
    }

    const inv = GameState.viewPlayerId === 0 ? inventory.player0 : inventory.player1;
    if (inv.length > 0) {
      parts.push(`YOU HOLD ${inv.length} PLATE${inv.length > 1 ? 'S' : ''}: [TAB] SELECT · [R] PRE-ROTATE · CLICK ▼/▲ ON THE MATRIX TO INSERT (2 AP)`);
    } else {
      parts.push('MATRIX: CLICK ▼/▲ = INSERT PLATE (2 AP) · CLICK PLATE = ROTATE (1 AP)');
    }

    if (!this.networked) {
      parts.push('[1]/[2] SWITCH WISP');
    }

    return parts.join('  ▪  ');
  }

  private hasUntriggeredUnlock(): boolean {
    const nodes = apUnlockQuery(world);
    for (let i = 0; i < nodes.length; i++) {
      if (APUnlock.triggered[nodes[i]] === 0) return true;
    }
    return false;
  }

  destroy(): void { this.el.remove(); }
}
