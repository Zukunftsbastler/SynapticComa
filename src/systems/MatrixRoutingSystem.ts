// MatrixRoutingSystem: BFS from each source node to determine which ability
// nodes are currently powered. Runs after every matrix mutation (and every
// tick) so ability states are always fresh.
//
// Routing rules (Decision 6 — Two-Layer Matrix Routing):
//   1. Power flows East only — never West.
//   2. Within a conduit column (col 2 or 4), power may spread North/South
//      between adjacent conduits that are face-connected.
//   3. A conduit in col 2 that has its East face open propagates to col 3
//      at the same row.
//   4. A col-3 ability node that is reached (powered) propagates East to
//      col 4 at the same row, regardless of its own face-mask (ability nodes
//      are transparent pass-throughs once powered).
//   5. A conduit in col 4 with its East face open reaches a col-5 node.
//   6. Power NEVER flows West — a conduit with only a West-open face does
//      not receive from the East.
//
// At the start of each run, all MatrixNode.active flags are reset to 0.
// After the BFS, activated nodes have active = 1.

import type { IWorld } from 'bitecs';
import { MatrixNode } from '@/components';
import { matrixNodeQuery, conduitQuery } from '@/queries';
import {
  buildMatrixGraph,
  CellType,
  conduitEmitsEast,
  conduitReceivesWest,
  conduitsConnectVertically,
} from '@/utils/MatrixGraph';
import { MATRIX_ROWS } from '@/constants';

export function MatrixRoutingSystem(world: IWorld): void {
  // Reset all active flags.
  const allNodes = matrixNodeQuery(world);
  for (let i = 0; i < allNodes.length; i++) MatrixNode.active[allNodes[i]] = 0;
  const allConduits = conduitQuery(world);
  for (let i = 0; i < allConduits.length; i++) MatrixNode.active[allConduits[i]] = 0;

  const grid = buildMatrixGraph(world);

  // powered[col0][row] — whether that cell has received power this pass.
  const powered: boolean[][] = Array.from({ length: 5 }, () =>
    new Array(MATRIX_ROWS).fill(false),
  );

  // ── Seed: source nodes (col 0) are always on ───────────────────────────
  for (let row = 0; row < MATRIX_ROWS; row++) {
    const cell = grid[0][row];
    if (cell.type === CellType.Source) {
      powered[0][row] = true;
      if (cell.eid >= 0) MatrixNode.active[cell.eid] = 1;
    }
  }

  // ── BFS queue: [col0, row] pairs ────────────────────────────────────────
  // We process columns left to right. For conduit columns we also spread N/S.
  // Use a simple iterative flood-fill per conduit column instead of a generic
  // BFS queue, which is cleaner given the strict East-only flow constraint.

  // Col 0 (source) → Col 1 (conduit): each powered source row seeds col 1
  // if that cell has its West face open.
  spreadSourceToConduit(grid, powered, 0, 1);

  // Flood within col 1 (conduit), then propagate East to col 2 (ability).
  floodConduitColumn(grid, powered, 1);
  spreadConduitToAbility(grid, powered, world, 1, 2);

  // Col 2 (ability) → col 3 (conduit): powered ability nodes seed col 3.
  spreadAbilityToConduit(grid, powered, 2, 3);

  // Flood within col 3, then propagate to col 4 (ability).
  floodConduitColumn(grid, powered, 3);
  spreadConduitToAbility(grid, powered, world, 3, 4);

  // Mark all powered non-source/non-conduit nodes (ability nodes in col 2 & 4).
  markAbilityNodes(grid, powered, world, 2);
  markAbilityNodes(grid, powered, world, 4);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Source → first conduit column: power passes if conduit has West face open.
function spreadSourceToConduit(
  grid: ReturnType<typeof buildMatrixGraph>,
  powered: boolean[][],
  srcCol: number,
  conduitCol: number,
): void {
  for (let row = 0; row < MATRIX_ROWS; row++) {
    if (!powered[srcCol][row]) continue;
    const cell = grid[conduitCol][row];
    if (cell.type === CellType.Conduit && conduitReceivesWest(cell)) {
      powered[conduitCol][row] = true;
    }
  }
}

// Flood-fill power within a conduit column via N/S face connectivity.
function floodConduitColumn(
  grid: ReturnType<typeof buildMatrixGraph>,
  powered: boolean[][],
  col: number,
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 0; row < MATRIX_ROWS; row++) {
      if (!powered[col][row]) continue;
      // Spread South (row+1).
      if (row + 1 < MATRIX_ROWS) {
        const below = grid[col][row + 1];
        if (!powered[col][row + 1] && conduitsConnectVertically(grid[col][row], below)) {
          powered[col][row + 1] = true;
          changed = true;
        }
      }
      // Spread North (row-1).
      if (row - 1 >= 0) {
        const above = grid[col][row - 1];
        if (!powered[col][row - 1] && conduitsConnectVertically(above, grid[col][row])) {
          powered[col][row - 1] = true;
          changed = true;
        }
      }
    }
  }
}

// Conduit column → ability node column: power passes if conduit emits East.
function spreadConduitToAbility(
  grid: ReturnType<typeof buildMatrixGraph>,
  powered: boolean[][],
  world: IWorld,
  conduitCol: number,
  abilityCol: number,
): void {
  for (let row = 0; row < MATRIX_ROWS; row++) {
    if (!powered[conduitCol][row]) continue;
    if (!conduitEmitsEast(grid[conduitCol][row])) continue;
    const abilityCell = grid[abilityCol][row];
    if (abilityCell.type === CellType.Ability || abilityCell.type === CellType.Empty) {
      powered[abilityCol][row] = true;
      if (abilityCell.eid >= 0) MatrixNode.active[abilityCell.eid] = 1;
    }
  }
}

// Ability node → next conduit column: powered ability node seeds the conduit.
function spreadAbilityToConduit(
  grid: ReturnType<typeof buildMatrixGraph>,
  powered: boolean[][],
  abilityCol: number,
  conduitCol: number,
): void {
  for (let row = 0; row < MATRIX_ROWS; row++) {
    if (!powered[abilityCol][row]) continue;
    const conduitCell = grid[conduitCol][row];
    if (conduitCell.type === CellType.Conduit && conduitReceivesWest(conduitCell)) {
      powered[conduitCol][row] = true;
    }
  }
}

// Write active=1 onto ability node ECS entities that received power.
function markAbilityNodes(
  grid: ReturnType<typeof buildMatrixGraph>,
  powered: boolean[][],
  world: IWorld,
  col: number,
): void {
  for (let row = 0; row < MATRIX_ROWS; row++) {
    const cell = grid[col][row];
    if (powered[col][row] && cell.eid >= 0 && cell.type === CellType.Ability) {
      MatrixNode.active[cell.eid] = 1;
    }
  }
}
