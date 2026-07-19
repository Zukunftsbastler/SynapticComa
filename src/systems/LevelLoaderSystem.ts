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
import { APPool, Position, Renderable, Dimension } from '@/components';
import { hexesInRadius } from '@/rendering/HexMath';
import { clearAnimationState } from '@/rendering/AnimationState';
import { SpriteId } from '@/registry/SpriteRegistry';
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
import { createApUnlockPair } from '@/entities/ApUnlockFactory';
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
  level_06: () => import('@/levels/level_06.json'),
  level_07: () => import('@/levels/level_07.json'),
  level_08: () => import('@/levels/level_08.json'),
  level_09: () => import('@/levels/level_09.json'),
  level_10: () => import('@/levels/level_10.json'),
  level_11: () => import('@/levels/level_11.json'),
  level_12: () => import('@/levels/level_12.json'),
  level_13: () => import('@/levels/level_13.json'),
  level_14: () => import('@/levels/level_14.json'),
  level_15: () => import('@/levels/level_15.json'),
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
  // Floor tiles for both dimensions — the visible board. Movement is bounded
  // to this radius (MovementSystem checks GameState.gridRadius).
  const radius = def.gridRadius ?? 3;
  GameState.gridRadius = radius;
  for (const z of [0, 1] as const) {
    for (const { q, r } of hexesInRadius(radius)) {
      const eid = addEntity(world);
      addComponent(world, Position,   eid);
      addComponent(world, Renderable, eid);
      addComponent(world, Dimension,  eid);
      Position.q[eid]          = q;
      Position.r[eid]          = r;
      Position.z[eid]          = z;
      Dimension.layer[eid]     = z;
      Renderable.spriteId[eid] = z === 0 ? SpriteId.HEX_ID_FLOOR : SpriteId.HEX_SUPEREGO_FLOOR;
      Renderable.visible[eid]  = 1;
      Renderable.layer[eid]    = 0;
      Renderable.dirty[eid]    = 1;
    }
  }

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

  // Shared Unlock pairs — the only AP-gain mechanism (mechanics.md §2).
  def.apUnlockNodes.forEach((unlockDef, i) => {
    createApUnlockPair(world, unlockDef, i + 1);
  });

  // Singleton APPool entity — persistent pool seeded from the level's initialAP.
  const apEid = addEntity(world);
  addComponent(world, APPool, apEid);
  APPool.current[apEid] = def.initialAP;
  APPool.max[apEid]     = def.initialAP;
  GameState.apPoolEid   = apEid;
  GameState.apPool      = def.initialAP;
  GameState.apMax       = def.initialAP;

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

  // 2. Reset all singletons. Animation state must go too — bitECS recycles
  // entity ids across worlds, and stale tween targets would teleport sprites.
  entityRegistry.clear();
  clearCollectionRegistry();
  clearAnimationState();
  resetGameState({
    localPlayerId:    GameState.localPlayerId, // preserve networking identity
    viewPlayerId:     GameState.viewPlayerId,  // preserve local-mode view toggle
    revealBothDims:   GameState.revealBothDims,
    currentLevel:     levelId,
    currentLevelName: def.name,
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
