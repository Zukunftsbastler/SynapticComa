// GuestSyncSystem: the Guest-side applier for authoritative Host → Guest
// messages. Runs first in the pipeline (right after InputSystem) so every
// downstream system sees the synced state this tick. No-op on the Host.
//
// Handles: STATE_UPDATE, MATRIX_STATE_UPDATE, INVENTORY_UPDATE, COLLECTED,
// PHASE_UPDATE, LEVEL_LOAD. (AP_UNLOCK stays in APUnlockSystem — each system
// owns its message types, per the InputSystem convention.)
//
// Level loading is async and touches UI lifecycle, so LEVEL_LOAD is delegated
// to a callback registered by the campaign controller (main.ts).

import type { IWorld } from 'bitecs';
import { removeEntity } from 'bitecs';
import { Position, Renderable, Conduit, MatrixNode, APPool } from '@/components';
import { conduitQuery } from '@/queries';
import { entityRegistry } from '@/registry/EntityRegistry';
import { inventory } from '@/state/InventoryState';
import { scrapPool } from '@/state/ScrapPoolState';
import { createMatrixConduit } from '@/entities/MatrixNodeFactory';
import { activateP2Exit } from '@/systems/LevelTransitionSystem';
import type { GameStateData } from '@/state/GameState';
import type {
  GameMessage, StateUpdateMessage, MatrixStateUpdateMessage,
  InventoryUpdateMessage, CollectedMessage, PhaseUpdateMessage, LevelLoadMessage,
} from '@/network/messages';
import type { ConduitShape } from '@/types';

// Registered by main.ts; invoked when the Host orders a level load.
let onLevelLoad: ((levelId: string, failureCount: number) => void) | null = null;

export function setGuestLevelLoadHandler(
  handler: (levelId: string, failureCount: number) => void,
): void {
  onLevelLoad = handler;
}

const SYNC_TYPES = new Set([
  'STATE_UPDATE', 'MATRIX_STATE_UPDATE', 'INVENTORY_UPDATE',
  'COLLECTED', 'PHASE_UPDATE', 'LEVEL_LOAD',
]);

export function GuestSyncSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 1) return; // Guest-only

  const msgs = state.pendingInputs.filter(m => SYNC_TYPES.has(m.type));
  if (msgs.length === 0) return;
  state.pendingInputs = state.pendingInputs.filter(m => !SYNC_TYPES.has(m.type));

  for (const msg of msgs) {
    switch (msg.type) {
      case 'STATE_UPDATE':        applyStateUpdate(world, state, msg);  break;
      case 'MATRIX_STATE_UPDATE': applyMatrixUpdate(world, msg);        break;
      case 'INVENTORY_UPDATE':    applyInventoryUpdate(state, msg);     break;
      case 'COLLECTED':           applyCollected(world, state, msg);    break;
      case 'PHASE_UPDATE':        applyPhaseUpdate(world, state, msg);  break;
      case 'LEVEL_LOAD':          applyLevelLoad(msg);                  break;
    }
  }
}

function syncApPool(state: GameStateData, newAP: number): void {
  state.apPool = newAP;
  if (state.apPool > state.apMax) state.apMax = state.apPool;
  if (state.apPoolEid >= 0) {
    APPool.current[state.apPoolEid] = state.apPool;
    APPool.max[state.apPoolEid]     = state.apMax;
  }
}

function applyStateUpdate(
  world: IWorld, state: GameStateData, msg: StateUpdateMessage,
): void {
  syncApPool(state, msg.apPool);
  // entityId '' signals an AP-only update (no position change).
  if (msg.entityId !== '' && entityRegistry.has(msg.entityId)) {
    const eid = entityRegistry.get(msg.entityId);
    Position.q[eid]       = msg.q;
    Position.r[eid]       = msg.r;
    Renderable.dirty[eid] = 1;
  }
  void world;
}

// Full reconcile: drop all conduit-slot entities (cols 2/4) and rebuild from
// the payload. Counts are tiny (≤ 10) and mutations are rare, so the entity
// churn is acceptable; MatrixRoutingSystem recomputes `active` locally.
function applyMatrixUpdate(world: IWorld, msg: MatrixStateUpdateMessage): void {
  const conduits = conduitQuery(world);
  for (let i = conduits.length - 1; i >= 0; i--) {
    const eid = conduits[i];
    const col = MatrixNode.column[eid];
    if (col === 2 || col === 4) removeEntity(world, eid);
  }

  for (let row = 0; row < msg.grid.length; row++) {
    for (const col of [2, 4] as const) {
      const cell = msg.grid[row][col - 1];
      if (cell.shape < 0) continue; // empty slot
      createMatrixConduit(world, {
        id:       `sync_col${col}_row${row}`,
        column:   col,
        row,
        shape:    cell.shape,
        rotation: cell.rotation,
      });
    }
  }

  // Mirror the face-down pile size with placeholder plates (contents are
  // never transmitted — the count is public, the shapes are not).
  scrapPool.plates = Array.from({ length: msg.scrapCount }, () => ({
    shape: 0 as ConduitShape, rotation: 0,
  }));
}

function applyInventoryUpdate(state: GameStateData, msg: InventoryUpdateMessage): void {
  // Privacy rule: only the drawing player learns the shape. The Host's own
  // draws never enter the Guest's inventory mirror.
  if (msg.playerId !== state.localPlayerId) return;
  inventory.player1.push({
    entityId: msg.entityId,
    shape:    msg.drawnShape as ConduitShape,
    rotation: msg.rotation,
  });
}

function applyCollected(
  world: IWorld, state: GameStateData, msg: CollectedMessage,
): void {
  if (entityRegistry.has(msg.entityId)) {
    const eid = entityRegistry.get(msg.entityId);
    removeEntity(world, eid);
    entityRegistry.delete(msg.entityId);
  }
  if (msg.playerId === state.localPlayerId) {
    inventory.player1.push({
      entityId: msg.entityId,
      shape:    msg.shape as ConduitShape,
      rotation: msg.rotation,
    });
  }
}

function applyPhaseUpdate(
  world: IWorld, state: GameStateData, msg: PhaseUpdateMessage,
): void {
  if (msg.p1HasExited && !state.p1HasExited) activateP2Exit(world);
  state.p1HasExited  = msg.p1HasExited;
  state.failureCount = msg.failureCount;
  state.phase        = msg.phase;
}

function applyLevelLoad(msg: LevelLoadMessage): void {
  if (onLevelLoad) onLevelLoad(msg.levelId, msg.failureCount);
}

// Type-level completeness check helper (unused at runtime).
export type _GuestSyncedMessage = Extract<
  GameMessage,
  | StateUpdateMessage | MatrixStateUpdateMessage | InventoryUpdateMessage
  | CollectedMessage | PhaseUpdateMessage | LevelLoadMessage
>;
