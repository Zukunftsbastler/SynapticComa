// InventoryPanel: DOM panel showing the local player's conduit inventory.
// Integrates with MatrixUI (Tab cycles slots, R rotates selected).
// Polling-based — reads inventory state each frame from InventoryState.
// Art direction: Bakelite plates aesthetic matching the Matrix panel.

import { inventory } from '@/state/InventoryState';
import { GameState } from '@/state/GameState';
import { ConduitShape } from '@/types';

const SHAPE_LABELS: Record<ConduitShape, string> = {
  [ConduitShape.STRAIGHT]:   '—',
  [ConduitShape.CURVED]:     '⌒',
  [ConduitShape.T_JUNCTION]: '⊤',
  [ConduitShape.CROSS]:      '+',
  [ConduitShape.SPLITTER]:   'Y',
};

const ROT_LABELS = ['0°', '90°', '180°', '270°'];

export class InventoryPanel {
  private el:       HTMLElement;
  private listEl:   HTMLElement;
  private selectedIndex = 0;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;bottom:80px;left:8px;background:#120d08cc;',
      'border:1px solid #3a2508;padding:8px 10px;font-family:monospace;',
      'color:#c8a87c;font-size:0.8rem;min-width:140px;z-index:20;',
    ].join('');

    const title = document.createElement('div');
    title.textContent = 'INVENTORY';
    title.style.cssText = 'color:#7a6040;font-size:0.7rem;letter-spacing:0.15em;margin-bottom:6px;';

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    this.el.appendChild(title);
    this.el.appendChild(this.listEl);
    container.appendChild(this.el);
  }

  /** Call each render frame. */
  update(): void {
    const pid = GameState.localPlayerId;
    const inv = pid === 0 ? inventory.player0 : inventory.player1;

    if (inv.length === 0) {
      this.listEl.innerHTML = '<span style="color:#4a3018">— empty —</span>';
      return;
    }

    this.selectedIndex = Math.min(this.selectedIndex, inv.length - 1);
    this.listEl.innerHTML = inv.map((item, i) => {
      const selected = i === this.selectedIndex;
      return (
        `<div style="padding:2px 4px;background:${selected ? '#2a1808' : 'transparent'};` +
        `border:1px solid ${selected ? '#7a4010' : 'transparent'};color:${selected ? '#e8c88c' : '#c8a87c'};` +
        `display:flex;justify-content:space-between;gap:8px;">` +
        `<span>${SHAPE_LABELS[item.shape as ConduitShape] ?? '?'}</span>` +
        `<span style="color:#7a6040">${ROT_LABELS[item.rotation] ?? ''}</span>` +
        `</div>`
      );
    }).join('');
  }

  getSelectedIndex(): number { return this.selectedIndex; }
  setSelectedIndex(i: number): void { this.selectedIndex = i; }

  destroy(): void { this.el.remove(); }
}
