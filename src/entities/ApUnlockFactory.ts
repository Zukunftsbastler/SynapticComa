// Creates Shared Unlock node pairs (mechanics.md §2, decisions_needed.md D4).
// One JSON definition produces TWO hex entities — one in Dimension A, one in
// Dimension B — linked by the same numeric APUnlock.id. Both must be occupied
// by their dimension's avatar in the same tick to trigger (APUnlockSystem).
import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import {
  Position, Renderable, Dimension, APUnlock,
} from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { SpriteId } from '@/registry/SpriteRegistry';
import type { ApUnlockNodeDef } from '@/levels/LevelSchema';

function createNode(
  world: IWorld, key: string, numericId: number, value: number,
  q: number, r: number, z: 0 | 1,
): number {
  const eid = addEntity(world);
  addComponent(world, Position,   eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension,  eid);
  addComponent(world, APUnlock,   eid);

  Position.q[eid]          = q;
  Position.r[eid]          = r;
  Position.z[eid]          = z;
  Dimension.layer[eid]     = z;
  APUnlock.id[eid]         = numericId;
  APUnlock.value[eid]      = value;
  APUnlock.triggered[eid]  = 0;
  Renderable.spriteId[eid] = SpriteId.AP_UNLOCK_NODE;
  Renderable.visible[eid]  = 1;
  Renderable.layer[eid]    = 0; // floor-level marker; avatars render above it
  Renderable.dirty[eid]    = 1;

  entityRegistry.register(key, eid);
  return eid;
}

/**
 * Creates both halves of a Shared Unlock pair. `numericId` links them and must
 * be unique per level (the loader passes the array index + 1).
 */
export function createApUnlockPair(
  world: IWorld, def: ApUnlockNodeDef, numericId: number,
): void {
  createNode(world, `${def.id}_a`, numericId, def.value, def.hexA.q, def.hexA.r, 0);
  createNode(world, `${def.id}_b`, numericId, def.value, def.hexB.q, def.hexB.r, 1);
}
