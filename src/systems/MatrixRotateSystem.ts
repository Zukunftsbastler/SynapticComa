// MatrixRotateSystem: Host-only. Handles ROTATE_CONDUIT messages.
// Rotates an existing conduit plate 90° clockwise and recomputes its faceMask.
// Cost: 1 AP.
// After mutation, broadcasts MATRIX_STATE_UPDATE.
//
// Task 4 (SPRINT_006b): locates the target entity via explicit column + row
// grid coordinates from the message, not via regex-parsed entityId strings.

import type { IWorld } from 'bitecs';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery } from '@/queries';
import { computeFaceMask, isRotatableInPlace } from '@/utils/ConduitFaceMask';
import { scrapPool } from '@/state/ScrapPoolState';
import { markActivity } from '@/state/GameState';
import type { GameStateData } from '@/state/GameState';
import type { RotateConduitMessage, MatrixStateUpdateMessage } from '@/network/messages';
import { buildMatrixStatePayload } from './matrixStateHelpers';
import { ConduitShape } from '@/types';
import { resonanceState } from '@/state/ResonanceState';

export function MatrixRotateSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const rotateInputs = state.pendingInputs.filter(
    (m): m is RotateConduitMessage => m.type === 'ROTATE_CONDUIT',
  );

  for (const input of rotateInputs) {
    // Dampening resonance (mechanics.md §4.5): the next Rotate costs 0 AP.
    const cost = resonanceState.dampeningActive ? 0 : 1;
    if (state.apPool < cost) continue;

    const target = findMatrixConduit(world, input.column, input.row);
    if (target === -1) continue;

    // Master Set plates are static once placed (mechanics.md §4.4) —
    // rejected before any AP is deducted.
    if (!isRotatableInPlace(Conduit.shape[target] as ConduitShape)) continue;

    const newRotation = (Conduit.rotation[target] + 1) % 4;
    Conduit.rotation[target] = newRotation;
    Conduit.faceMask[target] = computeFaceMask(
      Conduit.shape[target] as ConduitShape,
      newRotation,
    );

    state.apPool -= cost;
    if (resonanceState.dampeningActive) resonanceState.dampeningActive = false;
    resonanceState.mutatedThisTick = true;

    const update: MatrixStateUpdateMessage = {
      type: 'MATRIX_STATE_UPDATE',
      grid: buildMatrixStatePayload(world),
      scrapCount: scrapPool.plates.length,
    };
    state.outboundMessages.push(update);
    markActivity(state, input.senderId);
  }

  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'ROTATE_CONDUIT');
}

// Locate a conduit entity by its exact grid coordinates.
function findMatrixConduit(world: IWorld, column: number, row: number): number {
  const entities = conduitQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (MatrixNode.column[eid] === column && MatrixNode.row[eid] === row) return eid;
  }
  return -1;
}
