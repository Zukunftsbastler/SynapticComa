// Creates Focus Vault node pairs (mechanic_roadmap.md #8). One JSON
// definition produces TWO hex entities — one in Dimension A, one in
// Dimension B — linked by the same numeric FocusNode.id, exactly mirroring
// ApUnlockFactory's pairing. The vault's plate is NOT created here — it is
// spawned dynamically by FocusVaultSystem when the pair triggers, so it can
// never be collected (or even be a collision-check target) before that.
import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import { Position, Renderable, Dimension, FocusNode } from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { SpriteId } from '@/registry/SpriteRegistry';
import type { FocusVaultNodeDef } from '@/levels/LevelSchema';

function createNode(
  world: IWorld, key: string, numericId: number, cost: number,
  q: number, r: number, z: 0 | 1,
): number {
  const eid = addEntity(world);
  addComponent(world, Position,   eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension,  eid);
  addComponent(world, FocusNode,  eid);

  Position.q[eid]          = q;
  Position.r[eid]          = r;
  Position.z[eid]          = z;
  Dimension.layer[eid]     = z;
  FocusNode.id[eid]        = numericId;
  FocusNode.cost[eid]      = cost;
  FocusNode.triggered[eid] = 0;
  Renderable.spriteId[eid] = SpriteId.FOCUS_NODE;
  Renderable.visible[eid]  = 1;
  Renderable.layer[eid]    = 0;
  Renderable.dirty[eid]    = 1;

  entityRegistry.register(key, eid);
  return eid;
}

/**
 * Creates both halves of a Focus Vault pair. `numericId` links them and must
 * be unique per level (the loader passes a counter offset past apUnlockNodes'
 * own ids, since both share the same id-space convention but not a system).
 */
export function createFocusVaultPair(
  world: IWorld, def: FocusVaultNodeDef, numericId: number,
): void {
  createNode(world, `${def.id}_a`, numericId, def.cost, def.hexA.q, def.hexA.r, 0);
  createNode(world, `${def.id}_b`, numericId, def.cost, def.hexB.q, def.hexB.r, 1);
}
