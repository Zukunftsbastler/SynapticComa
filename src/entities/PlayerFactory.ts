import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import {
  Position, Renderable, Dimension, Movable, Avatar, Health,
} from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { SpriteId } from '@/registry/SpriteRegistry';
import type { AvatarDef } from '@/levels/LevelSchema';

export function createAvatar(world: IWorld, def: AvatarDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension, eid);
  addComponent(world, Movable, eid);
  addComponent(world, Avatar, eid);
  addComponent(world, Health, eid);

  Position.q[eid]   = def.q;
  Position.r[eid]   = def.r;
  Position.z[eid]   = def.z;
  Avatar.playerId[eid] = def.playerId;
  Movable.canMove[eid] = 1;
  Health.max[eid]     = 1;
  Health.current[eid] = 1;
  Renderable.spriteId[eid] = def.playerId === 0 ? SpriteId.AVATAR_P1 : SpriteId.AVATAR_P2;
  Renderable.visible[eid]  = 1;
  Renderable.dirty[eid]    = 1;
  Dimension.layer[eid]     = def.z;

  entityRegistry.register(def.id, eid);
  return eid;
}
