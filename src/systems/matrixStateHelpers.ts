// Shared helper: serialises the current 5×5 matrix conduit state into the
// flat grid payload used by MATRIX_STATE_UPDATE messages.
// Called by MatrixInsertSystem, MatrixRotateSystem, and ScrapPoolSystem.

import type { IWorld } from 'bitecs';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery } from '@/queries';
import { MATRIX_ROWS, MATRIX_COLS } from '@/constants';

export function buildMatrixStatePayload(
  world: IWorld,
): { shape: number; rotation: number; active: boolean }[][] {
  // Initialise a MATRIX_ROWS × MATRIX_COLS grid of empty cells.
  const grid: { shape: number; rotation: number; active: boolean }[][] = Array.from(
    { length: MATRIX_ROWS },
    () => Array.from({ length: MATRIX_COLS }, () => ({ shape: -1, rotation: 0, active: false })),
  );

  const entities = conduitQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const col = MatrixNode.column[eid] - 1; // 1-indexed → 0-indexed
    const row = MatrixNode.row[eid];
    if (row >= 0 && row < MATRIX_ROWS && col >= 0 && col < MATRIX_COLS) {
      grid[row][col] = {
        shape:    Conduit.shape[eid],
        rotation: Conduit.rotation[eid],
        active:   MatrixNode.active[eid] === 1,
      };
    }
  }

  return grid;
}
