// MatrixUI: handles mouse interaction on the DNA Matrix panel.
//
// Interactions:
//   - Click on a column-2 or column-4 TOP arrow    → InsertConduitMessage (fromTop=true)
//   - Click on a column-2 or column-4 BOTTOM arrow → InsertConduitMessage (fromTop=false)
//   - Click on an existing matrix conduit tile      → RotateConduitMessage (column + row)
//   - Press R while holding a conduit               → pre-orient pending rotation (0 AP)
//   - Tab                                           → cycle selected inventory slot
//
// All messages are dispatched to Host pendingInputs or Guest outboundMessages,
// matching the same Host-Authority pattern used by KeyboardInput.ts.
//
// Lifecycle: call destroy() during level reload to remove all window listeners
// and prevent duplicate dispatches.

import { GameState } from '@/state/GameState';
import { inventory } from '@/state/InventoryState';
import type { InsertConduitMessage, RotateConduitMessage } from '@/network/messages';
import { MATRIX_ROWS } from '@/constants';

const CELL         = 48;
const GAP          = 3;
const ARROW_HEIGHT = 16;

// Column indices (0-based) that accept inserts.
const CONDUIT_COLS_0IDX = [1, 3]; // columns 2 and 4 (0-indexed)

export class MatrixUI {
  private originX: number;
  private originY: number;
  private selectedSlot:     number      = 0;
  private pendingRotation:  number | null = null;

  // Bound handler references kept for removeEventListener cleanup.
  private readonly _onClick:   (e: MouseEvent)    => void;
  private readonly _onKeydown: (e: KeyboardEvent) => void;

  constructor(originX: number, originY: number) {
    this.originX = originX;
    this.originY = originY;

    this._onClick   = this.handleClick.bind(this);
    this._onKeydown = this.handleKeydown.bind(this);

    window.addEventListener('click',   this._onClick);
    window.addEventListener('keydown', this._onKeydown);
  }

  // Call during level reload / world teardown to prevent listener accumulation.
  destroy(): void {
    window.removeEventListener('click',   this._onClick);
    window.removeEventListener('keydown', this._onKeydown);
  }

  // ── Hit testing ──────────────────────────────────────────────────────────

  private hitTestArrow(px: number, py: number): { col0: number; fromTop: boolean } | null {
    for (const col0 of CONDUIT_COLS_0IDX) {
      const cx = this.originX + col0 * (CELL + GAP);
      if (px < cx || px > cx + CELL) continue;
      const topY    = this.originY - ARROW_HEIGHT - 4;
      const bottomY = this.originY + MATRIX_ROWS * (CELL + GAP) + 4;
      if (py >= topY    && py <= topY    + ARROW_HEIGHT) return { col0, fromTop: true };
      if (py >= bottomY && py <= bottomY + ARROW_HEIGHT) return { col0, fromTop: false };
    }
    return null;
  }

  private hitTestCell(px: number, py: number): { col0: number; row: number } | null {
    const col0 = Math.floor((px - this.originX) / (CELL + GAP));
    const row  = Math.floor((py - this.originY) / (CELL + GAP));
    if (col0 < 0 || col0 >= 5 || row < 0 || row >= MATRIX_ROWS) return null;
    const cellX = (px - this.originX) % (CELL + GAP);
    const cellY = (py - this.originY) % (CELL + GAP);
    if (cellX > CELL || cellY > CELL) return null;
    return { col0, row };
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private handleClick(e: MouseEvent): void {
    if (GameState.phase !== 'PLAYING') return;

    const arrow = this.hitTestArrow(e.clientX, e.clientY);
    if (arrow) {
      this.fireInsert((arrow.col0 + 1) as 2 | 4, arrow.fromTop);
      return;
    }

    const cell = this.hitTestCell(e.clientX, e.clientY);
    if (cell && CONDUIT_COLS_0IDX.includes(cell.col0)) {
      this.fireRotate(cell.col0 + 1, cell.row);
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (GameState.phase !== 'PLAYING') return;

    // R: pre-orient pending rotation (0 AP). Guard: player must hold a tile.
    if (e.key.toLowerCase() === 'r') {
      const pid = GameState.localPlayerId;
      const inv = pid === 0 ? inventory.player0 : inventory.player1;
      if (inv.length === 0) return; // Task 5: guard — nothing to rotate
      this.pendingRotation = (((this.pendingRotation ?? -1) + 1) % 4);
      console.debug(`[MatrixUI] Pre-orient rotation: ${this.pendingRotation * 90}°`);
      return;
    }

    // Tab: cycle selected inventory slot.
    if (e.key === 'Tab') {
      e.preventDefault();
      const pid = GameState.localPlayerId;
      const inv = pid === 0 ? inventory.player0 : inventory.player1;
      if (inv.length > 0) {
        this.selectedSlot = (this.selectedSlot + 1) % inv.length;
        console.debug(`[MatrixUI] Selected inventory slot: ${this.selectedSlot}`);
      }
    }
  }

  // ── Message dispatch ──────────────────────────────────────────────────────

  private fireInsert(column: 2 | 4, fromTop: boolean): void {
    const pid = GameState.localPlayerId;
    const inv = pid === 0 ? inventory.player0 : inventory.player1;
    if (inv.length === 0) {
      console.debug('[MatrixUI] Insert rejected: inventory empty');
      return;
    }
    const slot    = Math.min(this.selectedSlot, inv.length - 1);
    const conduit = inv[slot];
    const rotation = (this.pendingRotation ?? conduit.rotation) as 0 | 1 | 2 | 3;
    this.pendingRotation = null;

    const msg: InsertConduitMessage = {
      type:           'INSERT_CONDUIT',
      column,
      fromTop,
      shape:          conduit.shape as 0 | 1 | 2 | 3 | 4,
      rotation,
      sourceEntityId: conduit.entityId,
      apCost:         2,
      seq:            GameState.outSeq++,
      senderId:       pid,
      tick:           0,
    };

    if (pid === 0) GameState.pendingInputs.push(msg);
    else           GameState.outboundMessages.push(msg);
  }

  private fireRotate(col1: number, row: number): void {
    const pid = GameState.localPlayerId;

    // Task 4: use explicit column + row, not a regex-parsed entityId string.
    const msg: RotateConduitMessage = {
      type:     'ROTATE_CONDUIT',
      column:   col1 as 2 | 4,
      row,
      apCost:   1,
      seq:      GameState.outSeq++,
      senderId: pid,
      tick:     0,
    };

    if (pid === 0) GameState.pendingInputs.push(msg);
    else           GameState.outboundMessages.push(msg);
  }
}
