// PushSystem: Host-only. Runs after MovementSystem each tick.
// Consumes PushAttempt entries written by MovementSystem, validates that the
// destination hex of the Pushable is clear, and moves the Pushable 1 hex in
// the push direction.
//
// If the destination is blocked the push silently fails (AP was already spent
// by MovementSystem — this matches the design: a push attempt always costs 1 AP
// regardless of whether the target can move).
//
// The pushed entity is broadcast to Guest via STATE_UPDATE so both screens stay
// in sync. The avatar itself did NOT move; its position update was already sent
// by MovementSystem (with its current coordinates, unchanged).

import type { IWorld } from 'bitecs';
import { Position, Renderable } from '@/components';
import { staticQuery, phaseBarrierQuery } from '@/queries';
import { entityRegistry } from '@/registry/EntityRegistry';
import type { GameStateData } from '@/state/GameState';
import { abilityFlags } from '@/systems/AbilitySystem';
import type { StateUpdateMessage } from '@/network/messages';

// Returns true if (tq, tr, tz) is free of Static and (when applicable) PhaseBarrier.
function isPushDestinationClear(world: IWorld, tq: number, tr: number, tz: number): boolean {
  const statics = staticQuery(world);
  for (let i = 0; i < statics.length; i++) {
    const eid = statics[i];
    if (Position.q[eid] === tq && Position.r[eid] === tr && Position.z[eid] === tz) return false;
  }
  if (!abilityFlags.phaseShiftActive) {
    const barriers = phaseBarrierQuery(world);
    for (let i = 0; i < barriers.length; i++) {
      const eid = barriers[i];
      if (Position.q[eid] === tq && Position.r[eid] === tr && Position.z[eid] === tz) return false;
    }
  }
  return true;
}

export function PushSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  for (const attempt of state.pushAttempts) {
    const { pushableEid, dq, dr } = attempt;

    const srcQ = Position.q[pushableEid];
    const srcR = Position.r[pushableEid];
    const tz   = Position.z[pushableEid];
    const dstQ = srcQ + dq;
    const dstR = srcR + dr;

    if (!isPushDestinationClear(world, dstQ, dstR, tz)) continue; // blocked — silent fail

    // Move the pushable entity.
    Position.q[pushableEid]       = dstQ;
    Position.r[pushableEid]       = dstR;
    Renderable.dirty[pushableEid] = 1;

    // Find registry key for this entity to broadcast a STATE_UPDATE.
    let pushableKey: string | null = null;
    for (const [key, eid] of entityRegistry.entries()) {
      if (eid === pushableEid) { pushableKey = key; break; }
    }

    if (pushableKey !== null) {
      const update: StateUpdateMessage = {
        type:     'STATE_UPDATE',
        entityId: pushableKey,
        q:        dstQ,
        r:        dstR,
        apPool:   state.apPool,
      };
      state.outboundMessages.push(update);
    }
  }

  // Clear attempts consumed this tick.
  state.pushAttempts = [];
}
