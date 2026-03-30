// MatrixInsertSystem: Host-only. Handles INSERT_CONDUIT messages.
//
// Column-slide mechanic (per docs/mechanics.md):
//   fromTop=true  → new plate enters at row 0; existing plates shift down by 1.
//                   Only the plate whose row was already MATRIX_ROWS-1 is ejected.
//   fromTop=false → new plate enters at row MATRIX_ROWS-1; plates shift up by 1.
//                   Only the plate whose row was already 0 is ejected.
//
// Ejection is determined by checking the actual MatrixNode.row value, NOT by
// array index. If the column is partially populated, the shift simply vacates
// the entry position — no tile is ejected if none occupies the boundary row.
//
// Only columns 2 and 4 accept conduit inserts (conduit-slot columns).
// Cost: 2 AP. Consumes one conduit from the inserting player's inventory.
// After mutation, broadcasts MATRIX_STATE_UPDATE so the Guest stays in sync.

import type { IWorld } from 'bitecs';
import { addEntity, addComponent, removeEntity } from 'bitecs';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery } from '@/queries';
import { computeFaceMask } from '@/utils/ConduitFaceMask';
import { scrapPool } from '@/state/ScrapPoolState';
import { inventory } from '@/state/InventoryState';
import type { GameStateData } from '@/state/GameState';
import type { InsertConduitMessage, MatrixStateUpdateMessage } from '@/network/messages';
import { MATRIX_ROWS } from '@/constants';
import { buildMatrixStatePayload } from './matrixStateHelpers';
import { ConduitShape } from '@/types';

export function MatrixInsertSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const insertInputs = state.pendingInputs.filter(
    (m): m is InsertConduitMessage => m.type === 'INSERT_CONDUIT',
  );

  for (const input of insertInputs) {
    if (state.apPool < 2) continue;

    const pid = input.senderId;
    const playerInventory = pid === 0 ? inventory.player0 : inventory.player1;

    const invIdx = playerInventory.findIndex(c => c.entityId === input.sourceEntityId);
    if (invIdx === -1) continue;

    // Collect all conduit entities in the target column, sorted by row.
    const colEntities = conduitQuery(world)
      .filter(eid => MatrixNode.column[eid] === input.column)
      .sort((a, b) => MatrixNode.row[a] - MatrixNode.row[b]);

    if (input.fromTop) {
      // Eject the tile at the boundary row (MATRIX_ROWS-1) if it exists.
      const ejected = colEntities.find(eid => MatrixNode.row[eid] === MATRIX_ROWS - 1);
      if (ejected !== undefined) {
        scrapPool.plates.push({
          shape:    Conduit.shape[ejected] as ConduitShape,
          rotation: Conduit.rotation[ejected],
        });
        removeEntity(world, ejected);
      }
      // Shift all remaining tiles down by 1 (row++).
      for (const eid of colEntities) {
        if (eid === ejected) continue;
        MatrixNode.row[eid] = MatrixNode.row[eid] + 1;
      }
      // Insert new tile at row 0.
      createConduitEntity(world, input.column, 0, input.shape, input.rotation);
    } else {
      // Eject the tile at the boundary row (0) if it exists.
      const ejected = colEntities.find(eid => MatrixNode.row[eid] === 0);
      if (ejected !== undefined) {
        scrapPool.plates.push({
          shape:    Conduit.shape[ejected] as ConduitShape,
          rotation: Conduit.rotation[ejected],
        });
        removeEntity(world, ejected);
      }
      // Shift all remaining tiles up by 1 (row--).
      for (const eid of colEntities) {
        if (eid === ejected) continue;
        MatrixNode.row[eid] = MatrixNode.row[eid] - 1;
      }
      // Insert new tile at the bottom row.
      createConduitEntity(world, input.column, MATRIX_ROWS - 1, input.shape, input.rotation);
    }

    playerInventory.splice(invIdx, 1);
    state.apPool -= 2;

    const update: MatrixStateUpdateMessage = {
      type: 'MATRIX_STATE_UPDATE',
      grid: buildMatrixStatePayload(world),
    };
    state.outboundMessages.push(update);
  }

  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'INSERT_CONDUIT');
}

function createConduitEntity(
  world: IWorld,
  column: number,
  row: number,
  shape: number,
  rotation: number,
): void {
  const eid = addEntity(world);
  addComponent(world, Conduit,    eid);
  addComponent(world, MatrixNode, eid);
  Conduit.shape[eid]          = shape;
  Conduit.rotation[eid]       = rotation;
  Conduit.faceMask[eid]       = computeFaceMask(shape as ConduitShape, rotation);
  MatrixNode.column[eid]      = column;
  MatrixNode.row[eid]         = row;
  MatrixNode.abilityType[eid] = 0;
  MatrixNode.active[eid]      = 0;
}
