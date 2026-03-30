// StateHasher: periodic determinism check.
// Every HASH_INTERVAL ticks, collects all entity (q,r,z) tuples from the ECS,
// sorts them, and computes a djb2 hash. Both peers send their hash; on mismatch
// a console warning is logged. Full rollback recovery is out of scope for MVP.

import type { IWorld } from 'bitecs';
import { Position } from '@/components';
import { avatarQuery } from '@/queries';

const HASH_INTERVAL = 300; // ticks (~5 seconds at 60 fps)
let tickCount = 0;

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash |= 0; // keep it 32-bit
  }
  return hash >>> 0; // unsigned
}

/** Returns a hash of the current avatar positions, or null if not yet due. */
export function computeStateHash(world: IWorld): number | null {
  tickCount++;
  if (tickCount % HASH_INTERVAL !== 0) return null;

  const avatars = avatarQuery(world);
  const tuples: string[] = [];
  for (let i = 0; i < avatars.length; i++) {
    const eid = avatars[i];
    tuples.push(`${Position.q[eid]},${Position.r[eid]},${Position.z[eid]}`);
  }
  tuples.sort();
  return djb2(tuples.join('|'));
}

export function checkStateHash(local: number, remote: number): void {
  if (local !== remote) {
    console.warn(
      `[StateHasher] DESYNC detected! local=${local} remote=${remote}`,
    );
  }
}

export function resetHasher(): void {
  tickCount = 0;
}
