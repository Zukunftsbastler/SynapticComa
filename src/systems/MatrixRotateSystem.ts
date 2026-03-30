// MatrixRotateSystem: Host-only. Handles ROTATE_CONDUIT messages.
// Rotates an existing conduit plate 90° clockwise and recomputes its faceMask.
// Cost: 1 AP.
// After mutation, broadcasts MATRIX_STATE_UPDATE.

import type { IWorld } from 'bitecs';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery } from '@/queries';
import { computeFaceMask } from '@/utils/ConduitFaceMask';
import type { GameStateData } from '@/state/GameState';
import type { RotateConduitMessage, MatrixStateUpdateMessage } from '@/network/messages';
import { buildMatrixStatePayload } from './matrixStateHelpers';
import { ConduitShape } from '@/types';

export function MatrixRotateSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const rotateInputs = state.pendingInputs.filter(
    (m): m is RotateConduitMessage => m.type === 'ROTATE_CONDUIT',
  );

  for (const input of rotateInputs) {
    if (state.apPool < 1) continue;

    // Find the matrix conduit entity identified by column + row encoded in entityId.
    // entityId format: "matrix_col{C}_row{R}" (set during level load / insert).
    const target = findMatrixConduit(world, input.entityId);
    if (target === -1) continue;

    const newRotation = (Conduit.rotation[target] + 1) % 4;
    Conduit.rotation[target] = newRotation;
    Conduit.faceMask[target] = computeFaceMask(
      Conduit.shape[target] as ConduitShape,
      newRotation,
    );

    state.apPool -= 1;

    const update: MatrixStateUpdateMessage = {
      type: 'MATRIX_STATE_UPDATE',
      grid: buildMatrixStatePayload(world),
    };
    state.outboundMessages.push(update);
  }

  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'ROTATE_CONDUIT');
}

// Resolves "matrix_col{C}_row{R}" entityId string to a bitECS entity ID.
function findMatrixConduit(world: IWorld, entityId: string): number {
  const match = entityId.match(/^matrix_col(\d)_row(\d)$/);
  if (!match) return -1;
  const col = parseInt(match[1], 10);
  const row = parseInt(match[2], 10);

  const entities = conduitQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (MatrixNode.column[eid] === col && MatrixNode.row[eid] === row) return eid;
  }
  return -1;
}
