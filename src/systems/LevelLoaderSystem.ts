// LevelLoaderSystem: destroys the current bitECS world entirely and creates a
// fresh one, then populates it from a level JSON definition.
//
// CRITICAL (Decision — Sprint 9): Never use removeEntity in a loop to "reset"
// a level. bitECS SoA TypedArrays are allocated per archetype; repeated entity
// churn causes memory fragmentation. Instead, deleteWorld() frees everything at
// once and createWorld() starts clean.
//
// Caller (gameLoop.ts) must replace the world reference:
//   import { world, setWorld } from '@/gameLoop';
//   setWorld(loadLevel(world, 'level_02'));

import { createWorld, deleteWorld } from 'bitecs';
import type { IWorld } from 'bitecs';
import { addEntity, addComponent } from 'bitecs';
import { APPool } from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { clearCollectionRegistry } from '@/systems/CollectionSystem';
import { inventory } from '@/state/InventoryState';
import { scrapPool } from '@/state/ScrapPoolState';
import { resetGameState } from '@/state/GameState';
import { GameState } from '@/state/GameState';
import { createAvatar } from '@/entities/PlayerFactory';
import { createHazard, createPhaseBarrier } from '@/entities/HazardFactory';
import { createCollectible } from '@/entities/ConduitFactory';
import { createExit, createThreshold, createWall } from '@/entities/ExitFactory';
import {
  createSourceNodes, createAbilityNode, createMatrixConduit,
} from '@/entities/MatrixNodeFactory';
import { AP_DEFAULT } from '@/constants';
import type { LevelDef, EntityDef } from '@/levels/LevelSchema';
import type { ConduitShape } from '@/types';

// Lazily imported level JSON files — Vite resolves these as static assets.
// Cast to unknown first: JSON imports infer `type` as `string`, not literal.
const LEVEL_MODULES: Record<string, () => Promise<{ default: unknown }>> = {
  level_01: () => import('@/levels/level_01.json'),
  level_02: () => import('@/levels/level_02.json'),
  level_03: () => import('@/levels/level_03.json'),
  level_04: () => import('@/levels/level_04.json'),
  level_05: () => import('@/levels/level_05.json'),
};

function dispatchEntityFactory(world: IWorld, def: EntityDef): void {
  switch (def.type) {
    case 'avatar':        createAvatar(world, def);         break;
    case 'exit':          createExit(world, def);           break;
    case 'threshold':     createThreshold(world, def);      break;
    case 'hazard':        createHazard(world, def);         break;
    case 'phase_barrier': createPhaseBarrier(world, def);   break;
    case 'collectible':   createCollectible(world, def);    break;
    case 'wall':          createWall(world, def);           break;
  }
}

function populateWorld(world: IWorld, def: LevelDef): void {
  // Hex grid entities (avatars, hazards, exits, etc.)
  for (const entityDef of def.entities) {
    dispatchEntityFactory(world, entityDef);
  }

  // Matrix: source nodes always exist (one per row).
  createSourceNodes(world);

  // Ability nodes (col 3 / col 5).
  for (const nodeDef of def.matrix.nodes) {
    createAbilityNode(world, nodeDef);
  }

  // Pre-placed conduit tiles (col 2 / col 4).
  for (const conduitDef of def.matrix.conduits) {
    createMatrixConduit(world, conduitDef);
  }

  // Singleton APPool entity.
  const apEid = addEntity(world);
  addComponent(world, APPool, apEid);
  APPool.current[apEid] = AP_DEFAULT;
  APPool.max[apEid]     = AP_DEFAULT;
  GameState.apPoolEid   = apEid;

  // Populate initial inventory.
  inventory.player0 = def.initialInventory.player0.map(c => ({
    entityId: c.entityId,
    shape:    c.shape as ConduitShape,
    rotation: c.rotation,
  }));
  inventory.player1 = def.initialInventory.player1.map(c => ({
    entityId: c.entityId,
    shape:    c.shape as ConduitShape,
    rotation: c.rotation,
  }));

  // Populate scrap pool.
  scrapPool.plates = def.scrapPool.map(p => ({
    shape:    p.shape as ConduitShape,
    rotation: p.rotation,
  }));
}

/** Load a level by id. Returns the new IWorld. Caller must call setWorld(). */
export async function loadLevel(currentWorld: IWorld, levelId: string): Promise<IWorld> {
  const loader = LEVEL_MODULES[levelId];
  if (!loader) throw new Error(`Unknown level id: "${levelId}"`);

  const { default: def } = await loader() as { default: LevelDef };

  // 1. Destroy old world — releases all SoA TypedArrays.
  deleteWorld(currentWorld);

  // 2. Reset all singletons.
  entityRegistry.clear();
  clearCollectionRegistry();
  resetGameState({
    localPlayerId:    GameState.localPlayerId, // preserve networking identity
    currentLevel:     levelId,
    thresholdEnabled: def.thresholdEnabled,
    phase:            'PLAYING',
  });

  // 3. Fresh world.
  const newWorld = createWorld();

  // 4. Populate from level definition.
  populateWorld(newWorld, def);

  console.debug(`[LevelLoaderSystem] Loaded "${levelId}" (${def.name}).`);
  return newWorld;
}
