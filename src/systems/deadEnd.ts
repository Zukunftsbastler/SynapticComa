// Dead End detection (mechanics.md §7, digital_implementation.md §7).
//
// A Dead End holds when: AP = 0, no untriggered Shared Unlock pair remains,
// and neither avatar can reach its exit with the remaining budget.
//
// Reachability is a budget-bounded BFS on the hex grid (1 AP per step) against
// the *current* tick's blocking state: Static blocks, PhaseBarrier blocks
// unless Phase Shift is active, Lethal blocks unless the avatar carries the
// matching resistance. This is deliberately conservative — it does not explore
// hypothetical future matrix routings. The full solver (generative_levels.md
// §2.5) replaces this core in Sprint 14; the function signature is its contract.
//
// Runs on both clients (read-only, deterministic on synced state).

import type { IWorld } from 'bitecs';
import { hasComponent } from 'bitecs';
import {
  Position, Avatar, Exit, Resistances, Lethal, APUnlock,
} from '@/components';
import {
  avatarQuery, exitQuery, apUnlockQuery,
  staticQuery, phaseBarrierQuery, lethalQuery,
} from '@/queries';
import { HEX_DIRECTIONS, hexDistance } from '@/rendering/HexMath';
import { abilityFlags } from '@/systems/AbilitySystem';
import { HazardType } from '@/types';
import type { GameStateData } from '@/state/GameState';

// Collects all blocked hexes in dimension z for the given avatar into a Set of
// "q,r" keys. Rebuilt per call — hex counts are tiny (< 100 entities).
function blockedSet(world: IWorld, avatarEid: number, z: number): Set<string> {
  const blocked = new Set<string>();

  const statics = staticQuery(world);
  for (let i = 0; i < statics.length; i++) {
    const eid = statics[i];
    if (Position.z[eid] === z) blocked.add(`${Position.q[eid]},${Position.r[eid]}`);
  }

  if (!abilityFlags.phaseShiftActive) {
    const barriers = phaseBarrierQuery(world);
    for (let i = 0; i < barriers.length; i++) {
      const eid = barriers[i];
      if (Position.z[eid] === z) blocked.add(`${Position.q[eid]},${Position.r[eid]}`);
    }
  }

  const hasRes = hasComponent(world, Resistances, avatarEid);
  const fireRes  = hasRes ? Resistances.fire[avatarEid]  === 1 : false;
  const laserRes = hasRes ? Resistances.laser[avatarEid] === 1 : false;
  const lethals = lethalQuery(world);
  for (let i = 0; i < lethals.length; i++) {
    const eid = lethals[i];
    if (Position.z[eid] !== z) continue;
    const t = Lethal.hazardType[eid];
    const survivable =
      (t === HazardType.FIRE && fireRes) || (t === HazardType.LASER && laserRes);
    if (!survivable) blocked.add(`${Position.q[eid]},${Position.r[eid]}`);
  }

  return blocked;
}

/**
 * Budget-bounded BFS: can the avatar of `playerId` reach its exit hex within
 * `budget` single-hex moves under the current blocking state?
 */
export function canAvatarReachExit(
  world: IWorld, state: GameStateData, playerId: 0 | 1, budget: number,
): boolean {
  // Locate avatar and exit.
  let avatarEid = -1;
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    if (Avatar.playerId[avatars[i]] === playerId) { avatarEid = avatars[i]; break; }
  }
  if (avatarEid === -1) return false;

  let exitQ = 0, exitR = 0, exitFound = false, exitLocked = false;
  const exits = exitQuery(world);
  for (let i = 0; i < exits.length; i++) {
    const eid = exits[i];
    if (Exit.playerId[eid] === playerId) {
      exitQ = Position.q[eid];
      exitR = Position.r[eid];
      exitFound = true;
      // P2's exit is Static until P1 has exited — unreachable by definition.
      exitLocked = playerId === 1 && !state.p1HasExited;
      break;
    }
  }
  if (!exitFound || exitLocked) return false;

  const z = Position.z[avatarEid];
  const blocked = blockedSet(world, avatarEid, z);
  blocked.delete(`${exitQ},${exitR}`); // the exit itself is always enterable

  // BFS bounded by budget.
  const startKey = `${Position.q[avatarEid]},${Position.r[avatarEid]}`;
  if (startKey === `${exitQ},${exitR}`) return true;
  const visited = new Set<string>([startKey]);
  let frontier: [number, number][] = [[Position.q[avatarEid], Position.r[avatarEid]]];

  for (let depth = 0; depth < budget && frontier.length > 0; depth++) {
    const next: [number, number][] = [];
    for (const [q, r] of frontier) {
      for (const [dq, dr] of HEX_DIRECTIONS) {
        const nq = q + dq, nr = r + dr;
        if (hexDistance(0, 0, nq, nr) > state.gridRadius) continue; // board edge
        const key = `${nq},${nr}`;
        if (visited.has(key) || blocked.has(key)) continue;
        if (nq === exitQ && nr === exitR) return true;
        visited.add(key);
        next.push([nq, nr]);
      }
    }
    frontier = next;
  }
  return false;
}

/** True while any untriggered Shared Unlock pair exists. */
function unlocksRemain(world: IWorld): boolean {
  const nodes = apUnlockQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    if (APUnlock.triggered[nodes[i]] === 0) return true;
  }
  return false;
}

/** Evaluates the Dead End condition for the current tick. */
export function isDeadEnd(world: IWorld, state: GameStateData): boolean {
  if (state.phase !== 'PLAYING') return false;
  if (state.apPool > 0) return false;
  if (unlocksRemain(world)) return false;

  const p1CanExit = state.p1HasExited
    || canAvatarReachExit(world, state, 0, state.apPool);
  const p2CanExit = canAvatarReachExit(world, state, 1, state.apPool);
  return !p1CanExit && !p2CanExit;
}
