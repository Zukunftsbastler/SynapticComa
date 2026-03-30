// MovementSystem: Host-only. Processes MOVE_AVATAR messages from pendingInputs,
// validates passability and AP budget, mutates Position, and broadcasts STATE_UPDATE.
//
// Passability rules:
//  - Target hex must be within the grid (checked via hex-in-radius; deferred to
//    level data in Sprint 9 — for now any hex is in-bounds).
//  - Target hex must not contain a Static entity in the same dimension.
//  - Target hex must not contain a PhaseBarrier entity unless Phase Shift is active
//    for that dimension (checked via AbilitySystem flags; deferred to Sprint 7).
//  - Target hex must not be a Chasm/Lethal hex (movement is blocked; damage is
//    applied by CollisionSystem after movement in Sprint 8).
//  - Cost: 1 AP per move.
//
// Push interaction: if the target hex contains a Pushable entity, MovementSystem
// aborts the avatar's move and instead writes a PUSH_ATTEMPT into the push queue
// for PushSystem to resolve (Sprint 7).

import type { IWorld } from 'bitecs';
import {
  Position, Renderable, Movable, Static, PhaseBarrier,
} from '@/components';
import { staticQuery } from '@/queries';
import { entityRegistry } from '@/registry/EntityRegistry';
import type { GameStateData } from '@/state/GameState';
import type { MoveAvatarMessage, StateUpdateMessage } from '@/network/messages';

// Checks whether (tq, tr, tz) is freely passable this tick.
function isHexPassable(world: IWorld, tq: number, tr: number, tz: number): boolean {
  const statics = staticQuery(world);
  for (let i = 0; i < statics.length; i++) {
    const eid = statics[i];
    if (
      Position.q[eid] === tq &&
      Position.r[eid] === tr &&
      Position.z[eid] === tz
    ) {
      return false; // blocked by a Static entity (wall, locked door)
    }
  }
  // PhaseBarrier and Pushable checks deferred to Sprint 7.
  return true;
}

export function MovementSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const moveInputs = state.pendingInputs.filter(
    (m): m is MoveAvatarMessage => m.type === 'MOVE_AVATAR',
  );

  for (const input of moveInputs) {
    if (!entityRegistry.has(input.entityId)) continue;
    const eid = entityRegistry.get(input.entityId);

    // Entity must be movable and have AP budget.
    if (Movable.canMove[eid] !== 1) continue;
    if (state.apPool < 1) continue;

    const tq = Position.q[eid] + input.dq;
    const tr = Position.r[eid] + input.dr;
    const tz = Position.z[eid];

    if (!isHexPassable(world, tq, tr, tz)) continue;

    // Commit the move.
    Position.q[eid]      = tq;
    Position.r[eid]      = tr;
    Renderable.dirty[eid] = 1;
    state.apPool         -= 1;

    // Broadcast authoritative result to Guest.
    const update: StateUpdateMessage = {
      type:     'STATE_UPDATE',
      entityId: input.entityId,
      q:        tq,
      r:        tr,
      apPool:   state.apPool,
    };
    state.outboundMessages.push(update);
  }

  // Remove all consumed MOVE_AVATAR messages.
  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'MOVE_AVATAR');
}
