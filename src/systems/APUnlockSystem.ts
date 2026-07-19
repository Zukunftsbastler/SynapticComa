// APUnlockSystem: the sole mechanism for gaining AP (mechanics.md §2).
//
// A Shared Unlock is a *pair* of hex entities (one per dimension) linked by
// APUnlock.id. When both avatars stand on their respective node of an
// untriggered pair in the same tick, the Host:
//   1. increments the shared AP pool by the pair's value,
//   2. marks both entities triggered (one-time activation),
//   3. broadcasts AP_UNLOCK so the Guest syncs pool + triggered state.
//
// Guest side: consumes AP_UNLOCK from pendingInputs (each system filters the
// queue for its own message types — see InputSystem.ts) and applies the same
// mutation to its local mirror world.
//
// Creates no event entity — the AP change is the signal (architecture.md §4).

import type { IWorld } from 'bitecs';
import { Position, Avatar, APUnlock } from '@/components';
import { FxKind } from '@/components/Fx';
import { spawnFx } from '@/entities/FxFactory';
import { apUnlockQuery, avatarQuery } from '@/queries';
import type { GameStateData } from '@/state/GameState';
import type { ApUnlockMessage } from '@/network/messages';

// An avatar of `playerId` stands on (q, r) in dimension z?
function isAvatarAt(
  world: IWorld, playerId: number, q: number, r: number, z: number,
): boolean {
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    const eid = avatars[i];
    if (
      Avatar.playerId[eid] === playerId &&
      Position.q[eid] === q &&
      Position.r[eid] === r &&
      Position.z[eid] === z
    ) return true;
  }
  return false;
}

// Marks every APUnlock entity with the given id as triggered and plays the
// surge effect on each node (both dimensions — the cross-dimensional flash is
// the point, art_and_ui.md §4).
function markTriggered(world: IWorld, unlockId: number): void {
  const nodes = apUnlockQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (APUnlock.id[eid] === unlockId) {
      APUnlock.triggered[eid] = 1;
      spawnFx(world, FxKind.UNLOCK_SURGE,
        Position.q[eid], Position.r[eid], Position.z[eid], 75);
    }
  }
}

export function APUnlockSystem(world: IWorld, state: GameStateData): void {
  // ── Guest: apply authoritative AP_UNLOCK messages from the Host ──────────
  if (state.localPlayerId !== 0) {
    const unlockMsgs = state.pendingInputs.filter(
      (m): m is ApUnlockMessage => m.type === 'AP_UNLOCK',
    );
    for (const msg of unlockMsgs) {
      state.apPool = msg.newAP;
      if (state.apPool > state.apMax) state.apMax = state.apPool;
      markTriggered(world, msg.unlockId);
    }
    state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'AP_UNLOCK');
    return;
  }

  // ── Host: detect pair occupancy ──────────────────────────────────────────
  if (state.phase !== 'PLAYING') return;

  const nodes = apUnlockQuery(world);

  // Group untriggered nodes by their shared pair id.
  // Pair convention: z === 0 node must host P1's avatar, z === 1 node P2's.
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (APUnlock.triggered[eid] === 1) continue;
    if (Position.z[eid] !== 0) continue; // evaluate each pair once, via its Dim A node

    const unlockId = APUnlock.id[eid];

    // Find the Dim B partner node of this pair.
    let partnerEid = -1;
    for (let j = 0; j < nodes.length; j++) {
      const other = nodes[j];
      if (
        other !== eid &&
        APUnlock.id[other] === unlockId &&
        Position.z[other] === 1 &&
        APUnlock.triggered[other] === 0
      ) { partnerEid = other; break; }
    }
    if (partnerEid === -1) continue; // unpaired node — level data error, skip

    const p1OnNode = isAvatarAt(world, 0, Position.q[eid], Position.r[eid], 0);
    const p2OnNode = isAvatarAt(
      world, 1, Position.q[partnerEid], Position.r[partnerEid], 1,
    );
    if (!p1OnNode || !p2OnNode) continue;

    // ── Trigger: grant AP, consume the pair (+ surge FX), broadcast ────────
    state.apPool += APUnlock.value[eid];
    if (state.apPool > state.apMax) state.apMax = state.apPool; // pool can exceed initial AP
    markTriggered(world, unlockId);

    const msg: ApUnlockMessage = {
      type:     'AP_UNLOCK',
      unlockId,
      newAP:    state.apPool,
    };
    state.outboundMessages.push(msg);
    console.debug(
      `[APUnlockSystem] Shared Unlock #${unlockId} triggered — +${APUnlock.value[eid]} AP (pool: ${state.apPool}).`,
    );
  }
}
