import { Application } from 'pixi.js';
import { addEntity, addComponent } from 'bitecs';
import { startLoop, world, setDriver } from '@/gameLoop';
import { PixiDriver } from '@/rendering/PixiDriver';
import { hexesInRadius } from '@/rendering/HexMath';
import { Position, Renderable, Dimension, Avatar, MatrixNode } from '@/components';
import { entityRegistry } from '@/registry/EntityRegistry';
import { SpriteId } from '@/registry/SpriteRegistry';
import { CANVAS_WIDTH, CANVAS_HEIGHT, MATRIX_ROWS, MATRIX_COLS } from '@/constants';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width:      CANVAS_WIDTH,
    height:     CANVAS_HEIGHT,
    background: 0x000000,
  });
  document.body.appendChild(app.canvas);

  const driver = new PixiDriver(app);

  // ── Test World: Dimension A hex grid (radius 3) ──────────────────────────
  const hexesA = hexesInRadius(3);
  for (const { q, r } of hexesA) {
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

  // ── Test World: Dimension B hex grid (radius 3) ──────────────────────────
  const hexesB = hexesInRadius(3);
  for (const { q, r } of hexesB) {
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

  // ── Test World: P1 Avatar (Dimension A) ──────────────────────────────────
  {
    const eid = addEntity(world);
    addComponent(world, Position,   eid);
    addComponent(world, Renderable, eid);
    addComponent(world, Dimension,  eid);
    addComponent(world, Avatar,     eid);
    Position.q[eid]          = 0;
    Position.r[eid]          = 0;
    Position.z[eid]          = 0;
    Renderable.spriteId[eid] = SpriteId.AVATAR_P1;
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 1;
    Dimension.layer[eid]     = 0;
    Avatar.playerId[eid]     = 0;
    entityRegistry.register('avatar_p1', eid);
  }

  // ── Test World: P2 Avatar (Dimension B) ──────────────────────────────────
  {
    const eid = addEntity(world);
    addComponent(world, Position,   eid);
    addComponent(world, Renderable, eid);
    addComponent(world, Dimension,  eid);
    addComponent(world, Avatar,     eid);
    Position.q[eid]          = 0;
    Position.r[eid]          = 0;
    Position.z[eid]          = 1;
    Renderable.spriteId[eid] = SpriteId.AVATAR_P2;
    Renderable.visible[eid]  = 1;
    Renderable.layer[eid]    = 1;
    Dimension.layer[eid]     = 1;
    Avatar.playerId[eid]     = 1;
    entityRegistry.register('avatar_p2', eid);
  }

  // ── Test World: DNA Matrix (5×5 placeholder nodes) ───────────────────────
  for (let row = 0; row < MATRIX_ROWS; row++) {
    for (let col = 1; col <= MATRIX_COLS; col++) {
      const eid = addEntity(world);
      addComponent(world, MatrixNode, eid);
      MatrixNode.column[eid]      = col;
      MatrixNode.row[eid]         = row;
      MatrixNode.abilityType[eid] = 0;
      // Mark source nodes (col 1) and the top-left ability node as active for visibility.
      MatrixNode.active[eid]      = (col === 1 || (col === 3 && row === 0)) ? 1 : 0;
    }
  }

  // Start as Player 1 (Dimension A). Press '2' to toggle to Player 2 for testing.
  let localPlayerId: 0 | 1 = 0;
  setDriver(driver, localPlayerId);

  window.addEventListener('keydown', (e) => {
    if (e.key === '1') { localPlayerId = 0; setDriver(driver, localPlayerId); }
    if (e.key === '2') { localPlayerId = 1; setDriver(driver, localPlayerId); }
  });

  startLoop();
}

main().catch(console.error);
