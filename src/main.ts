import { Application } from 'pixi.js';
import { addEntity, addComponent } from 'bitecs';
import { startLoop, world, setDriver } from '@/gameLoop';
import { PixiDriver } from '@/rendering/PixiDriver';
import { hexesInRadius } from '@/rendering/HexMath';
import {
  Position, Renderable, Dimension, Avatar, MatrixNode,
  Movable, APPool, Static, Collectible, Conduit,
} from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { registerForCollection } from '@/systems/CollectionSystem';
import { inventory } from '@/state/InventoryState';
import { MatrixUI } from '@/ui/MatrixUI';
import { ConduitShape } from '@/types';
import { computeFaceMask } from '@/utils/ConduitFaceMask';
import { SpriteId } from '@/registry/SpriteRegistry';
import { GameState, resetGameState } from '@/state/GameState';
import { initKeyboardInput } from '@/input/KeyboardInput';
import { CANVAS_WIDTH, CANVAS_HEIGHT, MATRIX_ROWS, MATRIX_COLS, AP_DEFAULT } from '@/constants';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width:      CANVAS_WIDTH,
    height:     CANVAS_HEIGHT,
    background: 0x000000,
  });
  document.body.appendChild(app.canvas);

  const driver = new PixiDriver(app);
  setDriver(driver);

  // ── GameState bootstrap (local single-machine dev mode, Player 1 = Host) ──
  resetGameState({ localPlayerId: 0, phase: 'PLAYING' });

  // ── APPool singleton entity ───────────────────────────────────────────────
  {
    const eid = addEntity(world);
    addComponent(world, APPool, eid);
    APPool.current[eid]    = AP_DEFAULT;
    APPool.max[eid]        = AP_DEFAULT;
    GameState.apPoolEid    = eid;
  }

  // ── Dimension A hex grid (radius 3) ──────────────────────────────────────
  for (const { q, r } of hexesInRadius(3)) {
    const eid = addEntity(world);
    addComponent(world, Position,   eid);
    addComponent(world, Renderable, eid);
    addComponent(world, Dimension,  eid);
    Position.q[eid]          = q;
    Position.r[eid]          = r;
    Position.z[eid]          = 0;
    Renderable.spriteId[eid] = SpriteId.HEX_ID_FLOOR;
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 0;
    Dimension.layer[eid]     = 0;
  }

  // ── Dimension B hex grid (radius 3) ──────────────────────────────────────
  for (const { q, r } of hexesInRadius(3)) {
    const eid = addEntity(world);
    addComponent(world, Position,   eid);
    addComponent(world, Renderable, eid);
    addComponent(world, Dimension,  eid);
    Position.q[eid]          = q;
    Position.r[eid]          = r;
    Position.z[eid]          = 1;
    Renderable.spriteId[eid] = SpriteId.HEX_SUPEREGO_FLOOR;
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 0;
    Dimension.layer[eid]     = 1;
  }

  // ── P1 Avatar (Dimension A) ───────────────────────────────────────────────
  {
    const eid = addEntity(world);
    addComponent(world, Position,   eid);
    addComponent(world, Renderable, eid);
    addComponent(world, Dimension,  eid);
    addComponent(world, Avatar,     eid);
    addComponent(world, Movable,    eid);
    Position.q[eid]          = 0;
    Position.r[eid]          = 0;
    Position.z[eid]          = 0;
    Renderable.spriteId[eid] = SpriteId.AVATAR_P1;
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 1;
    Dimension.layer[eid]     = 0;
    Avatar.playerId[eid]     = 0;
    Movable.canMove[eid]     = 1;
    entityRegistry.register('avatar_p1', eid);
  }

  // ── P2 Avatar (Dimension B) ───────────────────────────────────────────────
  {
    const eid = addEntity(world);
    addComponent(world, Position,   eid);
    addComponent(world, Renderable, eid);
    addComponent(world, Dimension,  eid);
    addComponent(world, Avatar,     eid);
    addComponent(world, Movable,    eid);
    Position.q[eid]          = 0;
    Position.r[eid]          = 0;
    Position.z[eid]          = 1;
    Renderable.spriteId[eid] = SpriteId.AVATAR_P2;
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 1;
    Dimension.layer[eid]     = 1;
    Avatar.playerId[eid]     = 1;
    Movable.canMove[eid]     = 1;
    entityRegistry.register('avatar_p2', eid);
  }

  // ── Static wall test: one blocked hex in Dim A ────────────────────────────
  {
    const eid = addEntity(world);
    addComponent(world, Position,   eid);
    addComponent(world, Renderable, eid);
    addComponent(world, Dimension,  eid);
    addComponent(world, Static,     eid);
    Position.q[eid]          = 1;
    Position.r[eid]          = 0;
    Position.z[eid]          = 0;
    Renderable.spriteId[eid] = SpriteId.HAZARD_LOCKED_RED;
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 0;
    Dimension.layer[eid]     = 0;
  }

  // ── Collectible conduits (test: 2 in Dim A, 1 in Dim B) ──────────────────
  const testCollectibles = [
    { key: 'conduit_a1', q:  2, r: -1, z: 0, shape: ConduitShape.STRAIGHT,   rotation: 0 },
    { key: 'conduit_a2', q: -1, r:  2, z: 0, shape: ConduitShape.CURVED,     rotation: 1 },
    { key: 'conduit_b1', q:  0, r:  2, z: 1, shape: ConduitShape.T_JUNCTION, rotation: 0 },
  ];
  for (const c of testCollectibles) {
    const eid = addEntity(world);
    addComponent(world, Position,    eid);
    addComponent(world, Renderable,  eid);
    addComponent(world, Dimension,   eid);
    addComponent(world, Collectible, eid);
    addComponent(world, Conduit,     eid);
    Position.q[eid]          = c.q;
    Position.r[eid]          = c.r;
    Position.z[eid]          = c.z;
    Renderable.spriteId[eid] = SpriteId.CONDUIT_UNKNOWN; // ??? until collected
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 1;
    Dimension.layer[eid]     = c.z;
    Conduit.shape[eid]       = c.shape;
    Conduit.rotation[eid]    = c.rotation;
    Conduit.faceMask[eid]    = 0;
    entityRegistry.register(c.key, eid);
    registerForCollection(c.key, eid);
  }

  // ── Debug: F1 prints inventory counts to console ─────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      console.log(
        `[Inventory] P1: ${inventory.player0.length} conduit(s), ` +
        `P2: ${inventory.player1.length} conduit(s)`,
        '\nP1:', inventory.player0,
        '\nP2:', inventory.player1,
      );
    }
  });

  // ── DNA Matrix ────────────────────────────────────────────────────────────
  // Source nodes (col 1) — always powered, no conduit component.
  // Ability nodes (col 3, 5) — powered by routing, no conduit component.
  // Conduit slots (col 2, 4) — start empty; players insert plates via MatrixUI.
  for (let row = 0; row < MATRIX_ROWS; row++) {
    for (const col of [1, 3, 5]) {
      const eid = addEntity(world);
      addComponent(world, MatrixNode, eid);
      MatrixNode.column[eid]      = col;
      MatrixNode.row[eid]         = row;
      MatrixNode.abilityType[eid] = col === 1 ? 0 : row + 1; // simple test ability IDs
      MatrixNode.active[eid]      = col === 1 ? 1 : 0; // source nodes always on
    }
  }

  // Pre-populate column 2 with one Straight conduit at row 0 as a test.
  {
    const eid = addEntity(world);
    addComponent(world, Conduit,    eid);
    addComponent(world, MatrixNode, eid);
    const shape    = ConduitShape.STRAIGHT;
    const rotation = 0;
    Conduit.shape[eid]          = shape;
    Conduit.rotation[eid]       = rotation;
    Conduit.faceMask[eid]       = computeFaceMask(shape, rotation);
    MatrixNode.column[eid]      = 2;
    MatrixNode.row[eid]         = 0;
    MatrixNode.abilityType[eid] = 0;
    MatrixNode.active[eid]      = 0;
  }

  // ── Keyboard input ────────────────────────────────────────────────────────
  // In local dev mode: Q/W/E/A/S/D move P1 avatar.
  // Press '1'/'2' to switch which avatar you're controlling (and which dimension renders).
  let controlledAvatar = 'avatar_p1';
  initKeyboardInput(() => controlledAvatar);

  window.addEventListener('keydown', (e) => {
    if (e.key === '1') {
      GameState.localPlayerId = 0;
      controlledAvatar = 'avatar_p1';
    }
    if (e.key === '2') {
      GameState.localPlayerId = 1;
      controlledAvatar = 'avatar_p2';
    }
  });

  // ── MatrixUI ──────────────────────────────────────────────────────────────
  const matrixOrigin = driver.getMatrixOrigin();
  // Hold the reference so destroy() can be called on level reload.
  const _matrixUI = new MatrixUI(matrixOrigin.x, matrixOrigin.y);
  // Usage: _matrixUI.destroy() before calling loadLevel() in Sprint 9.

  startLoop();
}

main().catch(console.error);
