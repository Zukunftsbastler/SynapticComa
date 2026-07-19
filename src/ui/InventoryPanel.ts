// InventoryPanel: DOM panel showing the viewed player's conduit inventory.
// Click a plate to arm it for insertion — the matrix ▼/▲ arrows light up and
// the next arrow click inserts it (uiState is the single source of truth
// shared with MatrixUI and MatrixRenderer). Tab/R keyboard flow still works.
// Polling-based — reads inventory state each frame from InventoryState.

import { inventory } from '@/state/InventoryState';
import { GameState } from '@/state/GameState';
import { uiState, armInsert } from '@/ui/uiState';
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
  private titleEl:  HTMLElement;
  private listEl:   HTMLElement;
  private hintEl:   HTMLElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;bottom:80px;left:8px;background:#120d08cc;',
      'border:1px solid #3a2508;padding:8px 10px;font-family:monospace;',
      'color:#c8a87c;font-size:0.8rem;min-width:150px;z-index:20;',
    ].join('');

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = 'color:#7a6040;font-size:0.7rem;letter-spacing:0.15em;margin-bottom:6px;';

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    this.hintEl = document.createElement('div');
    this.hintEl.style.cssText = 'color:#c9a227;font-size:0.65rem;margin-top:5px;display:none;';
    this.hintEl.textContent = '[R] rotate · hover an ▼/▲ arrow to preview the push';

    this.el.appendChild(this.titleEl);
    this.el.appendChild(this.listEl);
    this.el.appendChild(this.hintEl);
    container.appendChild(this.el);

    // Click a plate row to select + arm it for insertion.
    this.listEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
      if (!target) return;
      armInsert(Number(target.dataset['slot']));
    });
  }

  /** Call each render frame. */
  update(): void {
    const pid = GameState.viewPlayerId;
    const inv = pid === 0 ? inventory.player0 : inventory.player1;
    // Inventories are per player — always say whose plates these are.
    this.titleEl.textContent = pid === 0 ? 'THE ID — PLATES' : 'THE SUPEREGO — PLATES';
    this.titleEl.style.color = pid === 0 ? '#a86ac9' : '#5aa8c9';
    this.hintEl.style.display = uiState.insertArmed && inv.length > 0 ? 'block' : 'none';

    if (inv.length === 0) {
      this.listEl.innerHTML = '<span style="color:#4a3018">— empty —</span>';
      return;
    }

    uiState.selectedSlot = Math.min(uiState.selectedSlot, inv.length - 1);
    this.listEl.innerHTML = inv.map((item, i) => {
      const selected = i === uiState.selectedSlot;
      const armed    = selected && uiState.insertArmed;
      // Pre-insert rotation ([R], 0 AP) applies to the selected plate; show
      // the EFFECTIVE orientation in gold so the state is never invisible.
      const pending  = selected && uiState.pendingRotation !== null;
      const rotation = pending ? uiState.pendingRotation! : item.rotation;
      return (
        `<div data-slot="${i}" style="padding:2px 4px;cursor:pointer;` +
        `background:${armed ? '#3a2a08' : selected ? '#2a1808' : 'transparent'};` +
        `border:1px solid ${armed ? '#c9a227' : selected ? '#7a4010' : 'transparent'};` +
        `color:${selected ? '#e8c88c' : '#c8a87c'};` +
        `display:flex;justify-content:space-between;gap:8px;">` +
        `<span>${SHAPE_LABELS[item.shape as ConduitShape] ?? '?'}</span>` +
        `<span style="color:${pending ? '#c9a227' : '#7a6040'}">` +
        `${pending ? '↻ ' : ''}${ROT_LABELS[rotation] ?? ''}</span>` +
        `</div>`
      );
    }).join('');
  }

  destroy(): void { this.el.remove(); }
}
