import type { IWorld } from 'bitecs';
import { hasComponent } from 'bitecs';
import {
  Position, Renderable, Dimension, Avatar, APUnlock, Static, Collectible,
} from '@/components';
import { renderableQuery, avatarQuery } from '@/queries';
import { renderCommandBuffer } from '@/rendering/RenderCommandBuffer';
import { renderMatrix } from '@/rendering/MatrixRenderer';
import type { PixiDriver } from '@/rendering/PixiDriver';
import { SpriteId } from '@/registry/SpriteRegistry';
import { HEX_SIZE } from '@/constants';

// Art palette — Medical Macabre Diorama (docs/art_and_ui.md)
// Dim A (The Id): bruised purples, sickly crimson
const COLOR_DIM_A_FLOOR = 0x2A1A2E; // deep bruised purple (velvet)
const COLOR_AVATAR_P1   = 0x8B2FC9; // obsidian-violet
// Dim B (The Superego): cold clinical steel, icy blue
const COLOR_DIM_B_FLOOR = 0x0D1F2D; // near-black steel
const COLOR_AVATAR_P2   = 0x3AAED8; // surgical cyan

// Entity hex colors — every board element must be readable at a glance.
// Placeholder flats until the sprite pipeline lands; hues follow art_and_ui.md.
const ENTITY_COLORS: Partial<Record<SpriteId, number>> = {
  [SpriteId.EXIT_NEXUS_A]:         0x1E8A3C, // nexus green (goal!)
  [SpriteId.EXIT_NEXUS_B]:         0x1E8A3C,
  [SpriteId.AP_UNLOCK_NODE]:       0xC9A227, // shared-unlock gold
  [SpriteId.THRESHOLD_HEX]:        0xD8D8E8, // pale threshold slab
  [SpriteId.HAZARD_LETHAL_A]:      0x7A1010, // repressed fear — deep blood red
  [SpriteId.HAZARD_LETHAL_B]:      0x7A1010, // firewall laser
  [SpriteId.HAZARD_FIRE]:          0xB0521A, // smoldering orange
  [SpriteId.HAZARD_LOCKED_RED]:    0x8B2430, // fleshy red door
  [SpriteId.HAZARD_LOCKED_BLUE]:   0x24478B, // vault blue door
  [SpriteId.HAZARD_PHASE_BARRIER]: 0x3A6A78, // ghostly teal
  [SpriteId.WALL_HEX]:             0x3A3A42, // solid slate wall
};

export function RenderSystem(world: IWorld, driver: PixiDriver, localPlayerId: 0 | 1): void {
  renderCommandBuffer.clear();

  const renderables = renderableQuery(world);

  // ── Pass 1: floor tiles ──────────────────────────────────────────────────
  for (let i = 0; i < renderables.length; i++) {
    const eid = renderables[i];
    if (Renderable.visible[eid] === 0) continue;
    const dimLayer = Dimension.layer[eid];
    if (dimLayer !== localPlayerId) continue;
    const sid = Renderable.spriteId[eid] as SpriteId;
    if (sid !== SpriteId.HEX_ID_FLOOR && sid !== SpriteId.HEX_SUPEREGO_FLOOR) continue;

    const baseColor = dimLayer === 0 ? COLOR_DIM_A_FLOOR : COLOR_DIM_B_FLOOR;
    renderCommandBuffer.push({
      cmd: 'drawHex', q: Position.q[eid], r: Position.r[eid],
      fillColor: (dimLayer << 24) | baseColor, alpha: 1,
    });
  }

  // ── Pass 2: entity hexes (exits, unlock nodes, hazards, thresholds) ──────
  for (let i = 0; i < renderables.length; i++) {
    const eid = renderables[i];
    if (Renderable.visible[eid] === 0) continue;
    const dimLayer = Dimension.layer[eid];
    if (dimLayer !== localPlayerId) continue;
    if (hasComponent(world, Avatar, eid)) continue; // avatars drawn in pass 3
    const sid = Renderable.spriteId[eid] as SpriteId;
    if (sid === SpriteId.HEX_ID_FLOOR || sid === SpriteId.HEX_SUPEREGO_FLOOR) continue;

    const q = Position.q[eid];
    const r = Position.r[eid];
    let color = ENTITY_COLORS[sid];
    let alpha = 1;

    if (sid === SpriteId.EXIT_NEXUS_A || sid === SpriteId.EXIT_NEXUS_B) {
      // Locked exit (P2's, pre-P1-exit) renders dim; active exit glows.
      if (hasComponent(world, Static, eid)) { color = 0x14401E; alpha = 0.9; }
    }
    if (hasComponent(world, APUnlock, eid) && APUnlock.triggered[eid] === 1) {
      color = 0x4A3E1A; // consumed unlock — burnt-out gold
    }

    if (color !== undefined) {
      renderCommandBuffer.push({
        cmd: 'drawHex', q, r, fillColor: (dimLayer << 24) | color, alpha,
      });
    }

    // Collectible plates: face-down "???" marker on top of the floor.
    if (hasComponent(world, Collectible, eid)) {
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      renderCommandBuffer.push({
        cmd: 'drawRect',
        x: screen.x - HEX_SIZE * 0.28, y: screen.y - HEX_SIZE * 0.28,
        width: HEX_SIZE * 0.56, height: HEX_SIZE * 0.56,
        fillColor: 0xD8CCAA, alpha: 0.9,
      });
    }
  }

  // ── Pass 3: avatars (always on top) ──────────────────────────────────────
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    const eid = avatars[i];
    if (Renderable.visible[eid] === 0) continue;

    const dimLayer = Dimension.layer[eid];
    if (dimLayer !== localPlayerId) continue;

    const q = Position.q[eid];
    const r = Position.r[eid];
    const screen = dimLayer === 0
      ? driver.hexToScreenA(q, r)
      : driver.hexToScreenB(q, r);

    const color = Avatar.playerId[eid] === 0 ? COLOR_AVATAR_P1 : COLOR_AVATAR_P2;

    renderCommandBuffer.push({
      cmd:       'drawCircle',
      x:         screen.x,
      y:         screen.y,
      radius:    HEX_SIZE * 0.45,
      fillColor: color,
      alpha:     1,
    });
  }

  // ── DNA Matrix ─────────────────────────────────────────────────────────────
  // Always visible on both screens — it is the shared workspace.
  const origin = driver.getMatrixOrigin();
  renderMatrix(world, renderCommandBuffer, origin.x, origin.y);

  // Flush commands to PixiDriver
  const cmds = renderCommandBuffer.drain();
  driver.executeBuffer(cmds);
}
