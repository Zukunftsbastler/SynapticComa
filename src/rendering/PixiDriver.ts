import { Application, Graphics, Container } from 'pixi.js';
import type { RenderCommand } from './RenderCommandBuffer';
import { axialToPixel, hexCorners } from './HexMath';
import { HEX_SIZE } from '@/constants';

// PixiDriver is NOT a bitECS system. It is a thin PixiJS adapter that consumes
// the RenderCommandBuffer output and calls PixiJS APIs.
// All game logic lives in RenderSystem; PixiDriver only knows how to draw.

export class PixiDriver {
  private app: Application;
  private gfx: Graphics;
  // Container offsets for each dimension's hex grid.
  private dimAOrigin: { x: number; y: number };
  private dimBOrigin: { x: number; y: number };
  // Origin for the DNA Matrix panel (centered between grids).
  private matrixOrigin: { x: number; y: number };

  constructor(app: Application) {
    this.app = app;

    // Layout: Dim A hex grid (left) | Matrix (center) | Dim B hex grid (right)
    // Canvas: 1280 × 720
    this.dimAOrigin   = { x: 220, y: 360 };   // center of left grid
    this.dimBOrigin   = { x: 1060, y: 360 };  // center of right grid
    this.matrixOrigin = { x: 620, y: 200 };   // top-left of matrix panel

    this.gfx = new Graphics();
    const stage = new Container();
    stage.addChild(this.gfx);
    this.app.stage.addChild(stage);
  }

  // Called once per frame by the game loop after RenderSystem has written its commands.
  executeBuffer(commands: RenderCommand[]): void {
    this.gfx.clear();

    for (const cmd of commands) {
      switch (cmd.cmd) {
        case 'clear':
          // already cleared above
          break;

        case 'drawHex': {
          const origin = cmd.q >= 0 && cmd.r === 0 && cmd.q === 0
            ? this.dimAOrigin
            : this.dimAOrigin; // RenderSystem passes the correct pixel coords via drawCircle/drawRect;
                               // drawHex carries q/r + a layer hint embedded in fillColor upper bits.
          // Decode dimension from the top byte of fillColor (0x00RRGGBB = Dim A, 0x01RRGGBB = Dim B)
          const dimBit = (cmd.fillColor >>> 24) & 0xFF;
          const color  = cmd.fillColor & 0x00FFFFFF;
          const o      = dimBit === 1 ? this.dimBOrigin : this.dimAOrigin;
          const px     = axialToPixel(cmd.q, cmd.r, HEX_SIZE);
          const cx     = o.x + px.x;
          const cy     = o.y + px.y;
          const corners = hexCorners(cx, cy, HEX_SIZE - 2); // -2px inset for visible gap
          this.gfx.beginFill(color, cmd.alpha);
          this.gfx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < 6; i++) this.gfx.lineTo(corners[i][0], corners[i][1]);
          this.gfx.closePath();
          this.gfx.endFill();
          break;
        }

        case 'drawCircle':
          this.gfx.beginFill(cmd.fillColor, cmd.alpha);
          this.gfx.drawCircle(cmd.x, cmd.y, cmd.radius);
          this.gfx.endFill();
          break;

        case 'drawRect':
          this.gfx.beginFill(cmd.fillColor, cmd.alpha);
          this.gfx.drawRect(cmd.x, cmd.y, cmd.width, cmd.height);
          this.gfx.endFill();
          break;

        case 'drawSprite':
          // Sprite loading deferred to Sprint 9 (asset pipeline).
          // For now, render a placeholder colored rectangle at the sprite position.
          if (cmd.visible) {
            this.gfx.beginFill(0xFFFFFF, 0.3);
            this.gfx.drawRect(cmd.x - 16, cmd.y - 16, 32, 32);
            this.gfx.endFill();
          }
          break;
      }
    }
  }

  // Pixel coordinate helpers used by RenderSystem when building commands.
  hexToScreenA(q: number, r: number): { x: number; y: number } {
    const px = axialToPixel(q, r, HEX_SIZE);
    return { x: this.dimAOrigin.x + px.x, y: this.dimAOrigin.y + px.y };
  }

  hexToScreenB(q: number, r: number): { x: number; y: number } {
    const px = axialToPixel(q, r, HEX_SIZE);
    return { x: this.dimBOrigin.x + px.x, y: this.dimBOrigin.y + px.y };
  }

  getMatrixOrigin(): { x: number; y: number } {
    return { ...this.matrixOrigin };
  }
}
