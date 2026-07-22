// MovementSystem: Host-only. Processes MOVE_AVATAR messages from pendingInputs,
// validates passability and AP budget, mutates Position, and broadcasts STATE_UPDATE.
//
// Passability rules:
//  - Target hex must not contain a Static entity in the same dimension.
//  - Target hex must not contain a PhaseBarrier entity unless Phase Shift is active.
//  - Cost: 1 AP per move.
//
// JUMP ability: when jumpActive, the avatar may move 2 hexes in a straight line
//   (same dq/dr direction applied twice). The intermediate hex must be free; the
//   landing hex is checked for passability as normal. Costs 1 AP total.
//
// PHASE_SHIFT ability: PhaseBarrier entities no longer block movement.
//
// Push interaction: if the target hex contains a Pushable entity and pushActive,
//   the avatar's move is aborted. A PushAttempt is written to GameState.pushAttempts
//   for PushSystem to resolve. Costs 1 AP.

import type { IWorld } from 'bitecs';
import {
  Position, Renderable, Movable, Static, PhaseBarrier, Pushable,
} from '@/components';
import { staticQuery, phaseBarrierQuery, pushableQuery } from '@/queries';
import { entityRegistry } from '@/registry/EntityRegistry';
import { hexDistance } from '@/rendering/HexMath';
import { GameState, markActivity } from '@/state/GameState';
import type { GameStateData } from '@/state/GameState';
import { abilityFlags } from '@/systems/AbilitySystem';
import type { MoveAvatarMessage, StateUpdateMessage } from '@/network/messages';

// Returns the eid of a Pushable entity at (tq, tr, tz), or -1 if none.
function pushableAt(world: IWorld, tq: number, tr: number, tz: number): number {
  const pushables = pushableQuery(world);
  for (let i = 0; i < pushables.length; i++) {
    const eid = pushables[i];
    if (
      Position.q[eid] === tq &&
      Position.r[eid] === tr &&
      Position.z[eid] === tz
    ) return eid;
  }
  return -1;
}

// Checks whether (tq, tr, tz) is freely passable this tick.
// PhaseBarrier passability depends on phaseShiftActive flag.
// The board boundary (GameState.gridRadius) is a hard wall — wisps never
// leave the visible hex grid.
// Exported so RenderSystem.ts can classify the hovered hex (valid step/jump
// vs blocked) using the exact same rule MovementSystem itself validates
// against — never a second, potentially-diverging copy of this logic.
export function isHexPassable(world: IWorld, tq: number, tr: number, tz: number): boolean {
  if (hexDistance(0, 0, tq, tr) > GameState.gridRadius) return false;

  const statics = staticQuery(world);
  for (let i = 0; i < statics.length; i++) {
    const eid = statics[i];
    if (
      Position.q[eid] === tq &&
      Position.r[eid] === tr &&
      Position.z[eid] === tz
    ) return false;
  }

  if (!abilityFlags[tz as 0 | 1].phaseShiftActive) {
    const barriers = phaseBarrierQuery(world);
    for (let i = 0; i < barriers.length; i++) {
      const eid = barriers[i];
      if (
        Position.q[eid] === tq &&
        Position.r[eid] === tr &&
        Position.z[eid] === tz
      ) return false;
    }
  }

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

    if (Movable.canMove[eid] !== 1) continue;
    if (state.apPool < 1) continue;

    const tz = Position.z[eid];

    // ── Movement semantics (SPRINT_010, mechanics.md §5.1) ─────────────────
    // The 1-hex step is always the default. The 2-hex JUMP fires only when
    //   (a) the player explicitly requested it (mouse click on a distance-2
    //       tile → input.jump), or
    //   (b) the 1-hex step is blocked and the jump can bypass the obstacle.
    // The intermediate hex is bypassed ENTIRELY — walls, doors, chasms and
    // barriers in it are irrelevant; only the landing hex is checked.
    const step1Q = Position.q[eid] + input.dq;
    const step1R = Position.r[eid] + input.dr;
    const step1Passable = isHexPassable(world, step1Q, step1R, tz);

    const wantsJump = abilityFlags[tz as 0 | 1].jumpActive &&
      (input.jump === true || !step1Passable);

    if (wantsJump) {
      const tq = Position.q[eid] + 2 * input.dq;
      const tr = Position.r[eid] + 2 * input.dr;
      if (isHexPassable(world, tq, tr, tz)) {
        Position.q[eid]       = tq;
        Position.r[eid]       = tr;
        Renderable.dirty[eid] = 1;
        state.apPool         -= 1;

        const update: StateUpdateMessage = {
          type: 'STATE_UPDATE', entityId: input.entityId,
          q: tq, r: tr, apPool: state.apPool,
        };
        state.outboundMessages.push(update);
        markActivity(state, input.senderId);
        continue;
      }
      if (input.jump === true) continue; // explicit jump blocked — no fallback
      // implicit jump blocked too — fall through (1-hex is blocked as well;
      // the push check below may still apply)
    }

    // ── Normal 1-hex move ───────────────────────────────────────────────────
    const tq = step1Q;
    const tr = step1R;

    // Push interaction: pushable on target hex + PUSH ability active.
    if (abilityFlags[tz as 0 | 1].pushActive) {
      const peid = pushableAt(world, tq, tr, tz);
      if (peid !== -1) {
        // Do not move avatar; queue push attempt for PushSystem.
        state.pushAttempts.push({ avatarEid: eid, pushableEid: peid, dq: input.dq, dr: input.dr });
        state.apPool -= 1;

        const update: StateUpdateMessage = {
          type: 'STATE_UPDATE', entityId: input.entityId,
          q: Position.q[eid], r: Position.r[eid], apPool: state.apPool,
        };
        state.outboundMessages.push(update);
        markActivity(state, input.senderId);
        continue;
      }
    }

    if (!isHexPassable(world, tq, tr, tz)) continue;

    // Commit the move.
    Position.q[eid]       = tq;
    Position.r[eid]       = tr;
    Renderable.dirty[eid] = 1;
    state.apPool         -= 1;

    const update: StateUpdateMessage = {
      type: 'STATE_UPDATE', entityId: input.entityId,
      q: tq, r: tr, apPool: state.apPool,
    };
    state.outboundMessages.push(update);
    markActivity(state, input.senderId);
  }

  // Remove all consumed MOVE_AVATAR messages.
  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'MOVE_AVATAR');
}
