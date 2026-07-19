// Spawns visual-effect entities (components/Fx.ts). Callable from any system
// on any client — FX are local, cosmetic, and never networked.
import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import { Position, Dimension, Fx } from '@/components';
import { FxKind } from '@/components/Fx';

export function spawnFx(
  world: IWorld, kind: FxKind, q: number, r: number, z: number, durationTicks = 60,
): number {
  const eid = addEntity(world);
  addComponent(world, Fx, eid);
  addComponent(world, Position, eid);
  addComponent(world, Dimension, eid);
  Fx.kind[eid]     = kind;
  Fx.age[eid]      = 0;
  Fx.duration[eid] = durationTicks;
  Position.q[eid]  = q;
  Position.r[eid]  = r;
  Position.z[eid]  = z;
  Dimension.layer[eid] = z;
  return eid;
}
