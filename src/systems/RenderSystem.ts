import type { IWorld } from 'bitecs';
import { Position, Renderable, Dimension, Avatar } from '@/components';
import { renderableQuery, avatarQuery } from '@/queries';
import { renderCommandBuffer } from '@/rendering/RenderCommandBuffer';
import { renderMatrix } from '@/rendering/MatrixRenderer';
import type { PixiDriver } from '@/rendering/PixiDriver';
import { HEX_SIZE } from '@/constants';

// Art palette — Medical Macabre Diorama (docs/art_and_ui.md)
// Dim A (The Id): bruised purples, sickly crimson
const COLOR_DIM_A_FLOOR = 0x2A1A2E; // deep bruised purple (velvet)
const COLOR_AVATAR_P1   = 0x8B2FC9; // obsidian-violet
// Dim B (The Superego): cold clinical steel, icy blue
const COLOR_DIM_B_FLOOR = 0x0D1F2D; // near-black steel
const COLOR_AVATAR_P2   = 0x3AAED8; // surgical cyan

export function RenderSystem(world: IWorld, driver: PixiDriver, localPlayerId: 0 | 1): void {
  renderCommandBuffer.clear();

  // ── Hex Grid ──────────────────────────────────────────────────────────────
  // Draw all renderable entities whose dimension matches the local player.
  // Dim A = layer 0 (Player 1 / The Id)
  // Dim B = layer 1 (Player 2 / The Superego)
  const renderables = renderableQuery(world);
  for (let i = 0; i < renderables.length; i++) {
    const eid = renderables[i];

    if (Renderable.visible[eid] === 0) continue;

    // Dimension visibility mask — each player only sees their own grid.
    const dimLayer = Dimension.layer[eid];
    if (dimLayer !== localPlayerId) continue;

    const q = Position.q[eid];
    const r = Position.r[eid];

    // Encode dimension in the upper byte so PixiDriver knows which origin to use.
    // (0x00RRGGBB = Dim A, 0x01RRGGBB = Dim B)
    const baseColor = dimLayer === 0 ? COLOR_DIM_A_FLOOR : COLOR_DIM_B_FLOOR;
    const encoded   = (dimLayer << 24) | baseColor;

    renderCommandBuffer.push({ cmd: 'drawHex', q, r, fillColor: encoded, alpha: 1 });
  }

  // ── Avatars ────────────────────────────────────────────────────────────────
  // Draw avatar circles on top of hex tiles. Each player only sees their own avatar.
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
