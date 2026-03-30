// MatrixUI: handles mouse interaction on the DNA Matrix panel.
//
// Interactions:
//   - Click on a column-2 or column-4 TOP arrow    → InsertConduitMessage (fromTop=true)
//   - Click on a column-2 or column-4 BOTTOM arrow → InsertConduitMessage (fromTop=false)
//   - Click on an existing matrix conduit tile      → RotateConduitMessage
//   - Press R while hovering an inventory slot       → pre-orient conduit (0 AP)
//
// Only fires messages for senderId === GameState.localPlayerId.
// Host messages go directly to pendingInputs; Guest messages to outboundMessages.
// The selected inventory slot is tracked here; it is never sent over the network
// (inventory is private and only visible to the owning player).

import { GameState } from '@/state/GameState';
import { inventory } from '@/state/InventoryState';
import type { InsertConduitMessage, RotateConduitMessage } from '@/network/messages';
import { MATRIX_ROWS } from '@/constants';

const CELL = 48;
const GAP  = 3;

// Column indices (0-based) that accept inserts.
const CONDUIT_COLS_0IDX = [1, 3]; // columns 2 and 4 (0-indexed)

export class MatrixUI {
  private originX: number;
  private originY: number;
  // The inventory slot the player has selected for insertion (index into player's inventory array).
  private selectedSlot: number = 0;
  // Pending rotation override from R key (0–3), applied before next insert.
  private pendingRotation: number | null = null;

  constructor(originX: number, originY: number) {
    this.originX = originX;
    this.originY = originY;
    this.bindEvents();
  }

  private colXCenter(col0: number): number {
    return this.originX + col0 * (CELL + GAP) + CELL / 2;
  }

  private rowYCenter(row: number): number {
    return this.originY + row * (CELL + GAP) + CELL / 2;
  }

  // Hit-test: returns { col0, row } (0-indexed) if the point is inside the matrix grid.
  private hitTest(px: number, py: number): { col0: number; row: number } | null {
    const col0 = Math.floor((px - this.originX) / (CELL + GAP));
    const row  = Math.floor((py - this.originY) / (CELL + GAP));
    if (col0 < 0 || col0 >= 5 || row < 0 || row >= MATRIX_ROWS) return null;
    // Verify the point is inside the cell (not in the gap).
    const cellX = (px - this.originX) % (CELL + GAP);
    const cellY = (py - this.originY) % (CELL + GAP);
    if (cellX > CELL || cellY > CELL) return null;
    return { col0, row };
  }

  // Arrow hit-test: a thin band above (fromTop) or below (fromBottom) each conduit column.
  private hitTestArrow(px: number, py: number): { col0: number; fromTop: boolean } | null {
    const ARROW_HEIGHT = 16;
    for (const col0 of CONDUIT_COLS_0IDX) {
      const cx = this.originX + col0 * (CELL + GAP);
      if (px < cx || px > cx + CELL) continue;
      const topY    = this.originY - ARROW_HEIGHT - 4;
      const bottomY = this.originY + MATRIX_ROWS * (CELL + GAP) + 4;
      if (py >= topY && py <= topY + ARROW_HEIGHT) return { col0, fromTop: true };
      if (py >= bottomY && py <= bottomY + ARROW_HEIGHT) return { col0, fromTop: false };
    }
    return null;
  }

  private bindEvents(): void {
    window.addEventListener('click', (e: MouseEvent) => {
      if (GameState.phase !== 'PLAYING') return;

      const px = e.clientX;
      const py = e.clientY;

      // ── Arrow click → Insert ────────────────────────────────────────────
      const arrow = this.hitTestArrow(px, py);
      if (arrow) {
        this.fireInsert(arrow.col0 + 1 as 2 | 4, arrow.fromTop);
        return;
      }

      // ── Cell click → Rotate ─────────────────────────────────────────────
      const cell = this.hitTest(px, py);
      if (cell && CONDUIT_COLS_0IDX.includes(cell.col0)) {
        this.fireRotate(cell.col0 + 1, cell.row);
      }
    });

    // R key: cycle pending rotation for the next insert (0 AP).
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && GameState.phase === 'PLAYING') {
        this.pendingRotation = (((this.pendingRotation ?? -1) + 1) % 4);
        console.debug(`[MatrixUI] Pre-orient rotation: ${this.pendingRotation! * 90}°`);
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
    });
  }

  private fireInsert(column: 2 | 4, fromTop: boolean): void {
    const pid = GameState.localPlayerId;
    const inv = pid === 0 ? inventory.player0 : inventory.player1;
    if (inv.length === 0) {
      console.debug('[MatrixUI] Insert rejected: inventory empty');
      return;
    }
    const slot = Math.min(this.selectedSlot, inv.length - 1);
    const conduit = inv[slot];
    const rotation = this.pendingRotation ?? conduit.rotation;
    this.pendingRotation = null; // consume pending rotation

    const msg: InsertConduitMessage = {
      type:           'INSERT_CONDUIT',
      column,
      fromTop,
      shape:          conduit.shape as 0 | 1 | 2 | 3 | 4,
      rotation:       rotation as 0 | 1 | 2 | 3,
      sourceEntityId: conduit.entityId,
      apCost:         2,
      seq:            GameState.outSeq++,
      senderId:       pid,
      tick:           0,
    };

    if (pid === 0) {
      GameState.pendingInputs.push(msg);
    } else {
      GameState.outboundMessages.push(msg);
    }
  }

  private fireRotate(col1: number, row: number): void {
    const pid = GameState.localPlayerId;
    const entityId = `matrix_col${col1}_row${row}`;

    const msg: RotateConduitMessage = {
      type:     'ROTATE_CONDUIT',
      entityId,
      apCost:   1,
      seq:      GameState.outSeq++,
      senderId: pid,
      tick:     0,
    };

    if (pid === 0) {
      GameState.pendingInputs.push(msg);
    } else {
      GameState.outboundMessages.push(msg);
    }
  }
}
