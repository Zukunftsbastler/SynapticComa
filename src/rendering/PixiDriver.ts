import { Application, Assets, Graphics, Container, Sprite, Text, Texture } from 'pixi.js';
import type { RenderCommand } from './RenderCommandBuffer';
import { axialToPixel, hexCorners } from './HexMath';
import { HEX_SIZE } from '@/constants';
import { SPRITE_PATHS } from '@/registry/SpriteRegistry';
import { markSpriteLoaded } from '@/registry/TextureRegistry';
import { DECAL_PATHS_ID, DECAL_PATHS_SUPEREGO } from '@/registry/DecalRegistry';

// PixiDriver is NOT a bitECS system. It is a thin PixiJS adapter that consumes
// the RenderCommandBuffer output and calls PixiJS APIs.
// All game logic lives in RenderSystem; PixiDriver only knows how to draw.

// '/sprites/hex_id_floor.webp' + n=2 → '/sprites/hex_id_floor_2.webp'
function variantPath(basePath: string, n: number): string {
  const dot = basePath.lastIndexOf('.');
  return `${basePath.slice(0, dot)}_${n}${basePath.slice(dot)}`;
}

export class PixiDriver {
  private app: Application;
  private gfx: Graphics;
  // Pooled PIXI.Text objects for drawText commands (labels, key hints).
  // Reused every frame; surplus instances are hidden, never destroyed.
  private textPool: Text[] = [];
  private textLayer: Container;
  // Pooled PIXI.Sprite objects for drawSprite commands (game-piece icons).
  // Simplification: sprites always render above every Graphics-drawn hex
  // (gfx is one immediate-mode batch, so true per-command z-interleaving
  // between Graphics and Sprites isn't practical) — fine today since no
  // per-entity icon has been promoted to a real asset yet (§3's whole point:
  // zero visual change until that happens); revisit if icon-vs-icon stacking
  // order ever matters once real assets land (docs/art_pipeline_roadmap.md Phase 2).
  private spritePool: Sprite[] = [];
  private spriteLayer: Container;
  // Each SpriteId may have several visual variants (e.g. hex_id_floor.webp,
  // hex_id_floor_2.webp, ...) — RenderSystem picks which one to show per
  // entity via a stable per-hex hash (DrawSpriteCommand.variantSeed), so
  // repeated floor tiles don't all look identical. Most SpriteIds only ever
  // have one variant; that's fine, index 0 is always used then.
  private textures = new Map<number, Texture[]>();
  // Cosmetic multi-hex decal overlay (state/DecalState.ts) — keyed by asset
  // path since decals aren't ECS entities/SpriteIds. Rendered in its own
  // layer, deliberately on TOP of spriteLayer (floor tiles AND entity/avatar
  // icons) rather than precisely between the two — a decal overlapping an
  // avatar is a rare coincidence given how sparse/randomly-placed decals are
  // and how much of a decal's own canvas is transparent; revisit if that
  // turns out to look wrong once seen running (same category of simplification
  // as spritePool's flat z-order below).
  private decalPool: Sprite[] = [];
  private decalLayer: Container;
  private decalTextures = new Map<string, Texture>();
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
    this.spriteLayer = new Container();
    this.decalLayer = new Container();
    this.textLayer = new Container();
    const stage = new Container();
    stage.addChild(this.gfx);       // procedural hexes/circles/rects
    stage.addChild(this.spriteLayer); // real game-piece/tile icons, once any exist
    stage.addChild(this.decalLayer); // cosmetic multi-hex decal overlay
    stage.addChild(this.textLayer); // text always on top
    this.app.stage.addChild(stage);

    void this.preloadTextures();
    void this.preloadDecalTextures();
  }

  // Best-effort: attempts every known asset path once at startup, including
  // per-tile floor art (HEX_ID_FLOOR/HEX_SUPEREGO_FLOOR) — tiles are ordinary
  // SpriteIds like any other game piece, each hex carrying its own sprite so
  // the board's shape is whatever hexes exist, not a fixed background frame
  // (Till's call, 2026-07-21 — supersedes the single-panorama-background idea
  // docs/art_pipeline_roadmap.md §1 originally proposed). Missing files (the
  // normal case until art is actually produced) are silently skipped — this
  // must never throw or block the game from starting.
  private async preloadTextures(): Promise<void> {
    const entries = Object.entries(SPRITE_PATHS) as [string, string][];
    let loadedCount = 0;
    for (const [idStr, path] of entries) {
      const variants: Texture[] = [];
      // Base path first, then numbered variants (hex_id_floor.webp,
      // hex_id_floor_2.webp, hex_id_floor_3.webp, ...) — stops at the first
      // gap, so variants must be numbered contiguously starting at 2.
      const candidatePaths = [path, ...Array.from({ length: 7 }, (_, i) => variantPath(path, i + 2))];
      for (const candidate of candidatePaths) {
        try {
          const texture = await Assets.load(candidate) as Texture;
          // Never smooth/blur these — assets are deliberately pixelated (a
          // handful of source detail then NEAREST-upscaled, see generate-sprite/
          // postprocess.py's --pixelate) precisely because the actual on-screen
          // hex size is small; re-smoothing with PixiJS's default linear
          // filtering would defeat the whole point (Till's feedback, 2026-07-21).
          texture.source.scaleMode = 'nearest';
          variants.push(texture);
        } catch {
          break; // stop at the first missing path (no base asset, or a gap in numbered variants)
        }
      }
      if (variants.length > 0) {
        this.textures.set(Number(idStr), variants);
        markSpriteLoaded(Number(idStr));
        loadedCount++;
      }
    }
    console.debug(`[PixiDriver] Loaded ${loadedCount}/${entries.length} sprite textures.`);
  }

  private async preloadDecalTextures(): Promise<void> {
    const paths = [...DECAL_PATHS_ID, ...DECAL_PATHS_SUPEREGO];
    for (const path of paths) {
      try {
        const texture = await Assets.load(path) as Texture;
        texture.source.scaleMode = 'nearest'; // same pixelated house style as tiles/icons
        this.decalTextures.set(path, texture);
      } catch {
        // No decal asset at this path yet — fine, just never scattered/drawn.
      }
    }
  }

  private acquireText(index: number): Text {
    let t = this.textPool[index];
    if (!t) {
      t = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 12, fill: 0xFFFFFF } });
      t.anchor.set(0.5);
      this.textPool[index] = t;
      this.textLayer.addChild(t);
    }
    return t;
  }

  private acquireSprite(index: number): Sprite {
    let s = this.spritePool[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5);
      this.spritePool[index] = s;
      this.spriteLayer.addChild(s);
    }
    return s;
  }

  private acquireDecalSprite(index: number): Sprite {
    let s = this.decalPool[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5);
      this.decalPool[index] = s;
      this.decalLayer.addChild(s);
    }
    return s;
  }

  // Called once per frame by the game loop after RenderSystem has written its commands.
  executeBuffer(commands: RenderCommand[]): void {
    this.gfx.clear();
    let textIndex = 0;
    let spriteIndex = 0;
    let decalIndex = 0;

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

        case 'drawHexBorder': {
          const o = cmd.dim === 1 ? this.dimBOrigin : this.dimAOrigin;
          const px = axialToPixel(cmd.q, cmd.r, HEX_SIZE);
          const cx = o.x + px.x;
          const cy = o.y + px.y;
          const corners = hexCorners(cx, cy, HEX_SIZE - 2); // matches drawHex's inset exactly
          this.gfx.lineStyle(cmd.lineWidth, cmd.color, cmd.alpha);
          this.gfx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < 6; i++) this.gfx.lineTo(corners[i][0], corners[i][1]);
          this.gfx.closePath();
          this.gfx.lineStyle(0); // reset — otherwise bleeds into later fill-only commands
          break;
        }

        case 'drawRing': {
          this.gfx.lineStyle(cmd.lineWidth, cmd.color, cmd.alpha);
          this.gfx.drawCircle(cmd.x, cmd.y, cmd.radius);
          this.gfx.lineStyle(0); // reset — otherwise bleeds into later fill-only commands
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

        case 'drawSprite': {
          // RenderSystem only ever emits this once TextureRegistry confirms a
          // real asset is loaded for cmd.spriteId (docs/art_pipeline_roadmap.md §3) —
          // the variants lookup below should always hit, but fail safe (hide) if not.
          const variants = this.textures.get(cmd.spriteId);
          const texture = variants && variants.length > 0
            ? variants[variants.length === 1 ? 0 : Math.abs(cmd.variantSeed ?? 0) % variants.length]
            : undefined;
          if (cmd.visible && texture) {
            const s = this.acquireSprite(spriteIndex++);
            s.texture = texture;
            s.position.set(cmd.x, cmd.y);
            s.width = cmd.width;
            s.height = cmd.height;
            s.alpha = cmd.alpha;
            s.rotation = cmd.rotation ?? 0; // explicit reset — pooled sprites are reused frame to frame
            s.visible = true;
          }
          break;
        }

        case 'drawDecal': {
          const texture = this.decalTextures.get(cmd.path);
          if (texture) {
            const s = this.acquireDecalSprite(decalIndex++);
            s.texture = texture;
            s.position.set(cmd.x, cmd.y);
            s.width = cmd.width;
            s.height = cmd.height;
            s.visible = true;
          }
          break;
        }

        case 'drawText': {
          const t = this.acquireText(textIndex++);
          t.text = cmd.text;
          t.style.fontSize = cmd.size;
          t.style.fill = cmd.color;
          // Pooled Text objects are reused across unrelated commands frame to
          // frame — always set (or explicitly clear) stroke, never leave a
          // previous command's outline bleeding onto this one's text.
          t.style.stroke = cmd.strokeColor !== undefined
            ? { color: cmd.strokeColor, width: cmd.strokeWidth ?? 2 }
            : { width: 0, color: 0x000000, alpha: 0 }; // explicit no-op — clears any prior command's outline
          t.position.set(cmd.x, cmd.y);
          t.alpha = cmd.alpha;
          t.visible = true;
          break;
        }
      }
    }

    // Hide surplus pooled texts/sprites from previous frames.
    for (let i = textIndex; i < this.textPool.length; i++) {
      this.textPool[i].visible = false;
    }
    for (let i = spriteIndex; i < this.spritePool.length; i++) {
      this.spritePool[i].visible = false;
    }
    for (let i = decalIndex; i < this.decalPool.length; i++) {
      this.decalPool[i].visible = false;
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
