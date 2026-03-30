// Creates collectible conduit entities on the hex grid (face-down ??? until collected).
import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import {
  Position, Renderable, Dimension, Conduit, Collectible,
} from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { registerForCollection } from '@/systems/CollectionSystem';
import { SpriteId } from '@/registry/SpriteRegistry';
import { computeFaceMask } from '@/utils/ConduitFaceMask';
import type { CollectibleDef } from '@/levels/LevelSchema';
import type { ConduitShape } from '@/types';

export function createCollectible(world: IWorld, def: CollectibleDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension, eid);
  addComponent(world, Conduit, eid);
  addComponent(world, Collectible, eid);

  Position.q[eid]   = def.q;
  Position.r[eid]   = def.r;
  Position.z[eid]   = def.z;
  Dimension.layer[eid]   = def.z;
  Conduit.shape[eid]     = def.shape;
  Conduit.rotation[eid]  = def.rotation;
  Conduit.faceMask[eid]  = computeFaceMask(def.shape as ConduitShape, def.rotation);
  // Render as ??? (face-down) until collected.
  Renderable.spriteId[eid] = SpriteId.CONDUIT_UNKNOWN;
  Renderable.visible[eid]  = 1;
  Renderable.dirty[eid]    = 1;

  entityRegistry.register(def.id, eid);
  registerForCollection(def.id, eid);
  return eid;
}
