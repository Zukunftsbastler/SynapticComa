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
import { createHazard, createPhaseBarrier, createPushableBlock, createEchoTile } from '@/entities/HazardFactory';
import { createCollectible } from '@/entities/ConduitFactory';
import { createExit, createWall } from '@/entities/ExitFactory';
import {
  createSourceNodes, createAbilityNode, createMatrixConduit,
} from '@/entities/MatrixNodeFactory';
import { createApUnlockPair } from '@/entities/ApUnlockFactory';
import { createFocusVaultPair } from '@/entities/FocusVaultFactory';
import { focusVaults, clearFocusVaults } from '@/state/FocusVaultState';
import { resetEchoTileState } from '@/systems/EchoTileSystem';
import { clearResonanceState } from '@/state/ResonanceState';
import { scatterDecals } from '@/state/DecalState';
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
  level_16: () => import('@/levels/level_16.json'),
  level_17: () => import('@/levels/level_17.json'),
  level_18: () => import('@/levels/level_18.json'),
  level_19: () => import('@/levels/level_19.json'),
  level_20: () => import('@/levels/level_20.json'),
  level_21: () => import('@/levels/level_21.json'),
  level_22: () => import('@/levels/level_22.json'),
  level_23: () => import('@/levels/level_23.json'),
  level_24: () => import('@/levels/level_24.json'),
  level_25: () => import('@/levels/level_25.json'),
  level_26: () => import('@/levels/level_26.json'),
  level_27: () => import('@/levels/level_27.json'),
  level_28: () => import('@/levels/level_28.json'),
  level_29: () => import('@/levels/level_29.json'),
  level_30: () => import('@/levels/level_30.json'),
  level_31: () => import('@/levels/level_31.json'),
  level_32: () => import('@/levels/level_32.json'),
  level_33: () => import('@/levels/level_33.json'),
  level_34: () => import('@/levels/level_34.json'),
  level_35: () => import('@/levels/level_35.json'),
  level_36: () => import('@/levels/level_36.json'),
  level_37: () => import('@/levels/level_37.json'),
  level_38: () => import('@/levels/level_38.json'),
  level_39: () => import('@/levels/level_39.json'),
  level_40: () => import('@/levels/level_40.json'),
  level_41: () => import('@/levels/level_41.json'),
  level_42: () => import('@/levels/level_42.json'),
  level_43: () => import('@/levels/level_43.json'),
  level_44: () => import('@/levels/level_44.json'),
  level_45: () => import('@/levels/level_45.json'),
  level_46: () => import('@/levels/level_46.json'),
  level_47: () => import('@/levels/level_47.json'),
  level_48: () => import('@/levels/level_48.json'),
  level_49: () => import('@/levels/level_49.json'),
  // Generator scratch slot (generative_levels.md §3's acceptance gate,
  // scripts/generateLevel.ts) — never a shipped campaign level. Overwritten
  // on disk before each verification pass; loaded only via ?debugLevel=_candidate.
  _candidate: () => import('@/levels/_candidate.json'),
};

function dispatchEntityFactory(world: IWorld, def: EntityDef): void {
  switch (def.type) {
    case 'avatar':        createAvatar(world, def);         break;
    case 'exit':          createExit(world, def);           break;
    case 'hazard':        createHazard(world, def);         break;
    case 'phase_barrier': createPhaseBarrier(world, def);   break;
    case 'collectible':   createCollectible(world, def);    break;
    case 'wall':          createWall(world, def);           break;
    case 'pushable_block': createPushableBlock(world, def); break;
    case 'echo_tile':      createEchoTile(world, def);      break;
  }
}

function populateWorld(world: IWorld, def: LevelDef): void {
  // Floor tiles for both dimensions — the visible board. Movement is bounded
  // to this radius (MovementSystem checks GameState.gridRadius).
  const radius = def.gridRadius ?? 3;
  GameState.gridRadius = radius;
  scatterDecals(radius); // fresh random cosmetic scatter every load — see state/DecalState.ts
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

  // Focus Vault pairs (mechanic_roadmap.md #8) — optional AP-spend bonus
  // rooms. FocusNode.id is a ui8 (0-255) exactly like APUnlock.id, so ids
  // stay small (1-indexed per level) — no offset needed: FocusNode and
  // APUnlock are separate component types with separate queries, so their
  // id spaces never collide regardless of value.
  (def.focusVaultNodes ?? []).forEach((vaultDef, i) => {
    const numericId = i + 1;
    createFocusVaultPair(world, vaultDef, numericId);
    focusVaults.set(numericId, {
      q: vaultDef.vault.q, r: vaultDef.vault.r, z: vaultDef.vault.z,
      shape: vaultDef.vault.shape, rotation: vaultDef.vault.rotation,
      entityId: `${vaultDef.id}_plate`,
    });
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
    base:     c.base ?? 0,
  }));
  inventory.player1 = def.initialInventory.player1.map(c => ({
    entityId: c.entityId,
    shape:    c.shape as ConduitShape,
    rotation: c.rotation,
    base:     c.base ?? 0,
  }));

  // Populate scrap pool.
  scrapPool.plates = def.scrapPool.map(p => ({
    shape:    p.shape as ConduitShape,
    rotation: p.rotation,
    base:     p.base ?? 0,
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
  clearFocusVaults();
  resetEchoTileState();
  clearResonanceState();
  resetGameState({
    localPlayerId:    GameState.localPlayerId, // preserve networking identity
    viewPlayerId:     GameState.viewPlayerId,  // preserve local-mode view toggle
    revealBothDims:   GameState.revealBothDims,
    currentLevel:     levelId,
    currentLevelName: def.name,
    phase:            'PLAYING',
  });

  // 3. Fresh world.
  const newWorld = createWorld();

  // 4. Populate from level definition.
  populateWorld(newWorld, def);

  console.debug(`[LevelLoaderSystem] Loaded "${levelId}" (${def.name}).`);
  return newWorld;
}
