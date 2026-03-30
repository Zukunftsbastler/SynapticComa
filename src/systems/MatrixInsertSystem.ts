// MatrixInsertSystem: Host-only. Handles INSERT_CONDUIT messages.
//
// Column-slide mechanic (per docs/mechanics.md):
//   fromTop=true  → new plate enters at row 0; existing plates shift down;
//                   plate at row MATRIX_ROWS-1 is ejected to Scrap Pool.
//   fromTop=false → new plate enters at row MATRIX_ROWS-1; plates shift up;
//                   plate at row 0 is ejected.
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

    const pid = input.senderId; // 0 or 1
    const playerInventory = pid === 0 ? inventory.player0 : inventory.player1;

    // Find the conduit in the player's inventory by sourceEntityId.
    const invIdx = playerInventory.findIndex(c => c.entityId === input.sourceEntityId);
    if (invIdx === -1) continue; // not in inventory — reject

    // Collect all conduit entities currently in the target column, sorted by row.
    const colEntities = conduitQuery(world)
      .filter(eid => MatrixNode.column[eid] === input.column)
      .sort((a, b) => MatrixNode.row[a] - MatrixNode.row[b]);

    // Eject the end tile to the Scrap Pool.
    const ejectedEid = input.fromTop
      ? colEntities[colEntities.length - 1]  // bottom tile ejected
      : colEntities[0];                        // top tile ejected

    if (ejectedEid !== undefined) {
      scrapPool.plates.push({
        shape:    Conduit.shape[ejectedEid] as ConduitShape,
        rotation: Conduit.rotation[ejectedEid],
      });
      removeEntity(world, ejectedEid);
    }

    // Shift remaining tiles.
    const remaining = colEntities.filter(eid => eid !== ejectedEid);
    if (input.fromTop) {
      // Shift down: row++ for each existing tile.
      for (const eid of remaining) {
        MatrixNode.row[eid] = MatrixNode.row[eid] + 1;
      }
      // New tile enters at row 0.
      createConduitEntity(world, input.column, 0, input.shape, input.rotation);
    } else {
      // Shift up: row-- for each existing tile.
      for (const eid of remaining) {
        MatrixNode.row[eid] = MatrixNode.row[eid] - 1;
      }
      // New tile enters at bottom row.
      createConduitEntity(world, input.column, MATRIX_ROWS - 1, input.shape, input.rotation);
    }

    // Consume the conduit from inventory.
    playerInventory.splice(invIdx, 1);
    state.apPool -= 2;

    // Broadcast full matrix state to Guest.
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
  addComponent(world, Conduit,     eid);
  addComponent(world, MatrixNode,  eid);
  Conduit.shape[eid]       = shape;
  Conduit.rotation[eid]    = rotation;
  Conduit.faceMask[eid]    = computeFaceMask(shape as ConduitShape, rotation);
  MatrixNode.column[eid]   = column;
  MatrixNode.row[eid]      = row;
  MatrixNode.abilityType[eid] = 0;
  MatrixNode.active[eid]   = 0;
}
