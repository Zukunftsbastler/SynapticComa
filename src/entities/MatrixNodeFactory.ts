// Creates matrix node entities: source nodes (col 1), ability nodes (col 3/5),
// and pre-placed conduit entities (col 2/4).
import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import { MatrixNode, Conduit } from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { computeFaceMask } from '@/utils/ConduitFaceMask';
import { MATRIX_ROWS } from '@/constants';
import type { MatrixNodeDef, MatrixConduitDef } from '@/levels/LevelSchema';
import type { ConduitShape } from '@/types';

/** Create the 5 source nodes in col 1 (always present in every level). */
export function createSourceNodes(world: IWorld): void {
  for (let row = 0; row < MATRIX_ROWS; row++) {
    const id  = `matrix_source_row${row}`;
    const eid = addEntity(world);
    addComponent(world, MatrixNode, eid);
    MatrixNode.column[eid]      = 1;
    MatrixNode.row[eid]         = row;
    MatrixNode.abilityType[eid] = 0; // source — no ability
    MatrixNode.active[eid]      = 1; // always on
    entityRegistry.register(id, eid);
  }
}

/** Create an ability node (col 3 or col 5) from a level definition entry. */
export function createAbilityNode(world: IWorld, def: MatrixNodeDef): number {
  const eid = addEntity(world);
  addComponent(world, MatrixNode, eid);
  MatrixNode.column[eid]      = def.column;
  MatrixNode.row[eid]         = def.row;
  MatrixNode.abilityType[eid] = def.abilityType;
  MatrixNode.active[eid]      = 0;
  entityRegistry.register(def.id, eid);
  return eid;
}

/** Create a pre-placed conduit entity in col 2 or col 4 from a level definition entry. */
export function createMatrixConduit(world: IWorld, def: MatrixConduitDef): number {
  const eid = addEntity(world);
  addComponent(world, MatrixNode, eid);
  addComponent(world, Conduit, eid);
  MatrixNode.column[eid]      = def.column;
  MatrixNode.row[eid]         = def.row;
  MatrixNode.abilityType[eid] = 0;
  MatrixNode.active[eid]      = 0;
  Conduit.shape[eid]    = def.shape;
  Conduit.rotation[eid] = def.rotation;
  Conduit.faceMask[eid] = computeFaceMask(def.shape as ConduitShape, def.rotation);
  entityRegistry.register(def.id, eid);
  return eid;
}
