// FxSystem: ages visual-effect entities and removes expired ones.
// Runs on both clients (FX are local and cosmetic — never host-guarded,
// never networked). RenderSystem draws them based on kind + age/duration.
import type { IWorld } from 'bitecs';
import { removeEntity } from 'bitecs';
import { Fx } from '@/components';
import { fxQuery } from '@/queries';

export function FxSystem(world: IWorld): void {
  const fx = fxQuery(world);
  for (let i = fx.length - 1; i >= 0; i--) {
    const eid = fx[i];
    Fx.age[eid] += 1;
    if (Fx.age[eid] >= Fx.duration[eid]) removeEntity(world, eid);
  }
}
