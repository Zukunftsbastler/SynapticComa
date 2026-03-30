import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import {
  Position, Renderable, Dimension, Hazard, Lethal, Static, PhaseBarrier,
} from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { SpriteId } from '@/registry/SpriteRegistry';
import type { HazardDef, PhaseBarrierDef } from '@/levels/LevelSchema';
import { HazardType } from '@/types';

// Sprite map per hazard type and dimension.
function hazardSpriteId(hazardType: number, z: number): SpriteId {
  switch (hazardType) {
    case HazardType.LOCKED_RED:   return SpriteId.HAZARD_LOCKED_RED;
    case HazardType.LOCKED_BLUE:  return SpriteId.HAZARD_LOCKED_BLUE;
    case HazardType.FIRE:         return SpriteId.HAZARD_FIRE;
    case HazardType.LASER:        return z === 0 ? SpriteId.HAZARD_LETHAL_A : SpriteId.HAZARD_LETHAL_B;
    case HazardType.CHASM:
    default:                      return z === 0 ? SpriteId.HAZARD_LETHAL_A : SpriteId.HAZARD_LETHAL_B;
  }
}

export function createHazard(world: IWorld, def: HazardDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension, eid);
  addComponent(world, Hazard, eid);

  Position.q[eid]   = def.q;
  Position.r[eid]   = def.r;
  Position.z[eid]   = def.z;
  Dimension.layer[eid] = def.z;
  Hazard.hazardType[eid] = def.hazardType;
  Renderable.spriteId[eid] = hazardSpriteId(def.hazardType, def.z);
  Renderable.visible[eid]  = 1;
  Renderable.dirty[eid]    = 1;

  // Lethal types: CHASM, FIRE, LASER
  if (
    def.hazardType === HazardType.CHASM ||
    def.hazardType === HazardType.FIRE  ||
    def.hazardType === HazardType.LASER
  ) {
    addComponent(world, Lethal, eid);
    Lethal.hazardType[eid] = def.hazardType;
  }

  // Blocking types: LOCKED_RED, LOCKED_BLUE
  if (
    def.hazardType === HazardType.LOCKED_RED ||
    def.hazardType === HazardType.LOCKED_BLUE
  ) {
    addComponent(world, Static, eid);
  }

  entityRegistry.register(def.id, eid);
  return eid;
}

export function createPhaseBarrier(world: IWorld, def: PhaseBarrierDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension, eid);
  addComponent(world, PhaseBarrier, eid);

  Position.q[eid]   = def.q;
  Position.r[eid]   = def.r;
  Position.z[eid]   = def.z;
  Dimension.layer[eid] = def.z;
  Renderable.spriteId[eid] = SpriteId.HAZARD_PHASE_BARRIER;
  Renderable.visible[eid]  = 1;
  Renderable.dirty[eid]    = 1;

  entityRegistry.register(def.id, eid);
  return eid;
}
