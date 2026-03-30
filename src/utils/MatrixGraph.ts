// MatrixGraph: builds a logical representation of the 5-column DNA Matrix
// from ECS state and exposes connectivity helpers for MatrixRoutingSystem.
//
// Column layout (1-indexed):
//   Col 1 — Source nodes:       always emit East unconditionally.
//   Col 2 — Conduit slots:      traverse N/S via face-mask; receive West, emit East.
//   Col 3 — Tier-1 ability nodes: receive West; if powered, also emit East.
//   Col 4 — Conduit slots:      same as col 2.
//   Col 5 — Tier-2 ability nodes: receive West only.
//
// Routing is purely East-flowing: power never travels West.

import type { IWorld } from 'bitecs';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery, matrixNodeQuery } from '@/queries';
import { facesConnect } from './ConduitFaceMask';
import { MATRIX_ROWS, MATRIX_COLS } from '@/constants';

export const enum CellType { Empty, Source, Conduit, Ability }

export interface MatrixCell {
  type:        CellType;
  eid:         number;   // bitECS entity id (-1 if empty)
  faceMask:    number;   // 0 for non-conduit cells
  abilityType: number;   // AbilityType enum value (0 for conduit/empty)
}

// Rebuild from ECS state. Returned grid is [col0][row] (0-indexed).
export function buildMatrixGraph(world: IWorld): MatrixCell[][] {
  // Initialise empty grid.
  const grid: MatrixCell[][] = Array.from({ length: MATRIX_COLS }, () =>
    Array.from({ length: MATRIX_ROWS }, () => ({
      type: CellType.Empty, eid: -1, faceMask: 0, abilityType: 0,
    })),
  );

  // Fill conduit cells (col 2 and 4, 0-indexed 1 and 3).
  const conduits = conduitQuery(world);
  for (let i = 0; i < conduits.length; i++) {
    const eid  = conduits[i];
    const col0 = MatrixNode.column[eid] - 1;
    const row  = MatrixNode.row[eid];
    if (col0 < 0 || col0 >= MATRIX_COLS || row < 0 || row >= MATRIX_ROWS) continue;
    grid[col0][row] = {
      type:        CellType.Conduit,
      eid,
      faceMask:    Conduit.faceMask[eid],
      abilityType: 0,
    };
  }

  // Fill source and ability node cells (col 1, 3, 5 → 0-indexed 0, 2, 4).
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid  = nodes[i];
    const col0 = MatrixNode.column[eid] - 1;
    const row  = MatrixNode.row[eid];
    if (col0 < 0 || col0 >= MATRIX_COLS || row < 0 || row >= MATRIX_ROWS) continue;
    // Skip if already filled by a conduit entity.
    if (grid[col0][row].type !== CellType.Empty) continue;
    const type = col0 === 0 ? CellType.Source : CellType.Ability;
    grid[col0][row] = { type, eid, faceMask: 0, abilityType: MatrixNode.abilityType[eid] };
  }

  return grid;
}

// Returns true if two vertically adjacent conduit cells in the same column
// are connected (both have N/S faces open toward each other).
// direction: 1 = topCell→bottomCell (South), topCell must open South, bottomCell North.
export function conduitsConnectVertically(
  topCell:    MatrixCell,
  bottomCell: MatrixCell,
): boolean {
  if (topCell.type    !== CellType.Conduit) return false;
  if (bottomCell.type !== CellType.Conduit) return false;
  // direction 1 = South (top→bottom): topCell East=0,South=1,West=2,North=3
  return facesConnect(topCell.faceMask, bottomCell.faceMask, 1);
}

// Returns true if a conduit cell has its East face open (can pass power rightward).
export function conduitEmitsEast(cell: MatrixCell): boolean {
  return cell.type === CellType.Conduit && ((cell.faceMask >> 0) & 1) === 1;
}

// Returns true if a conduit cell has its West face open (can receive power from left).
export function conduitReceivesWest(cell: MatrixCell): boolean {
  return cell.type === CellType.Conduit && ((cell.faceMask >> 2) & 1) === 1;
}
