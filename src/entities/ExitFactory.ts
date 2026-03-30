// Creates exit hexes, threshold hexes, and wall (Static-only) entities.
import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import {
  Position, Renderable, Dimension, Exit, Static, Threshold,
} from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { SpriteId } from '@/registry/SpriteRegistry';
import type { ExitDef, ThresholdDef, WallDef } from '@/levels/LevelSchema';

export function createExit(world: IWorld, def: ExitDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension, eid);
  addComponent(world, Exit, eid);

  Position.q[eid]   = def.q;
  Position.r[eid]   = def.r;
  Position.z[eid]   = def.z;
  Dimension.layer[eid] = def.z;
  Exit.playerId[eid]   = def.playerId;
  Renderable.spriteId[eid] = def.z === 0 ? SpriteId.EXIT_NEXUS_A : SpriteId.EXIT_NEXUS_B;
  Renderable.visible[eid]  = 1;
  Renderable.dirty[eid]    = 1;

  // P2's exit starts locked until P1 has exited.
  if (def.initiallyLocked) addComponent(world, Static, eid);

  entityRegistry.register(def.id, eid);
  return eid;
}

export function createThreshold(world: IWorld, def: ThresholdDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension, eid);
  addComponent(world, Threshold, eid);

  Position.q[eid]   = def.q;
  Position.r[eid]   = def.r;
  Position.z[eid]   = def.z;
  Dimension.layer[eid] = def.z;
  Threshold.triggered[eid] = 0;
  Renderable.spriteId[eid] = SpriteId.THRESHOLD_HEX;
  Renderable.visible[eid]  = 1;
  Renderable.dirty[eid]    = 1;

  entityRegistry.register(def.id, eid);
  return eid;
}

export function createWall(world: IWorld, def: WallDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Static, eid);

  Position.q[eid] = def.q;
  Position.r[eid] = def.r;
  Position.z[eid] = def.z;

  entityRegistry.register(def.id, eid);
  return eid;
}
