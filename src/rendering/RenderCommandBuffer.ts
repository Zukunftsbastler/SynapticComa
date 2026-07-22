// The RenderSystem writes commands into this buffer each tick.
// PixiDriver consumes the buffer once per frame and issues PixiJS API calls.
// Keeping the two decoupled makes RenderSystem testable without a DOM/WebGL context.

export type DrawHexCommand = {
  cmd:       'drawHex';
  q:         number;
  r:         number;
  fillColor: number;  // 0xRRGGBB
  alpha:     number;  // 0–1
};

export type DrawCircleCommand = {
  cmd:       'drawCircle';
  x:         number;  // pixel center x
  y:         number;  // pixel center y
  radius:    number;
  fillColor: number;
  alpha:     number;
};

export type DrawRectCommand = {
  cmd:       'drawRect';
  x:         number;
  y:         number;
  width:     number;
  height:    number;
  fillColor: number;
  alpha:     number;
};

// Outline-only hex stroke (no fill) — keeps tile boundaries legible over
// photographic sprite art. Two uses: a permanent low-contrast "grout" line on
// every floor hex, and a brighter highlight on whichever hex the pointer is
// currently over (uiState.hoveredHex).
export type DrawHexBorderCommand = {
  cmd:         'drawHexBorder';
  q:           number;
  r:           number;
  dim:         0 | 1;   // which board's origin (was packed into fillColor's top byte for drawHex; kept explicit here)
  color:       number;  // 0xRRGGBB
  lineWidth:   number;
  alpha:       number;
};

// Stroke-only circle (no fill) — concentric pulsing rings for "this tile is
// special" markers (AP unlock node, Focus node), distinct from
// DrawHexBorderCommand which is always hex-shaped and tied to a specific hex.
// Till's ask, 2026-07-22: "gelbe, konzentrische Ringe, die nach und nach
// verblassen" (yellow concentric rings, gradually fading).
export type DrawRingCommand = {
  cmd:       'drawRing';
  x:         number;
  y:         number;
  radius:    number;
  color:     number;
  lineWidth: number;
  alpha:     number;
};

export type DrawSpriteCommand = {
  cmd:         'drawSprite';
  x:           number;      // pixel center x
  y:           number;      // pixel center y
  width:       number;
  height:      number;
  spriteId:    number;
  alpha:       number;
  visible:     boolean;
  // Picks which visual variant to show when a SpriteId has more than one
  // (e.g. several hex_id_floor_N.webp files) — a stable per-instance value
  // (RenderSystem hashes hex q,r for floor tiles) so the same hex always
  // shows the same variant, not a new random one every frame. Ignored when
  // only one variant is loaded.
  variantSeed?: number;
  // Radians. Used for the avatar idle rotation (Till's ask, 2026-07-22: "soll
  // sich langsam drehen"). Omit for anything that shouldn't rotate — PixiDriver
  // always sets it explicitly (defaulting to 0) since pooled sprites are
  // reused across unrelated commands frame to frame.
  rotation?: number;
};

// Cosmetic multi-hex-spanning overlay (state/DecalState.ts) — keyed by asset
// path (string), not SpriteId, since decals aren't ECS entities/game pieces.
export type DrawDecalCommand = {
  cmd:    'drawDecal';
  x:      number;  // pixel center x
  y:      number;  // pixel center y
  width:  number;
  height: number;
  path:   string;
};

export type DrawTextCommand = {
  cmd:   'drawText';
  x:     number;  // pixel center x
  y:     number;  // pixel center y
  text:  string;
  color: number;
  size:  number;  // font size in px
  alpha: number;
  // Optional dark outline so text stays legible regardless of what's behind
  // it (needed once real background art replaced flat colors — a fixed text
  // color that read fine against one dimension's palette could read poorly
  // against the other's, Till's feedback 2026-07-21). Omit for UI text that
  // already sits on a known-dark panel (Matrix tray, HUD) and doesn't need it.
  strokeColor?: number;
  strokeWidth?: number;
};

export type ClearCommand = { cmd: 'clear' };

export type RenderCommand =
  | DrawHexCommand
  | DrawHexBorderCommand
  | DrawRingCommand
  | DrawCircleCommand
  | DrawRectCommand
  | DrawSpriteCommand
  | DrawDecalCommand
  | DrawTextCommand
  | ClearCommand;

export class RenderCommandBuffer {
  private commands: RenderCommand[] = [];

  clear(): void {
    this.commands.length = 0;
    this.commands.push({ cmd: 'clear' });
  }

  push(cmd: RenderCommand): void {
    this.commands.push(cmd);
  }

  drain(): RenderCommand[] {
    const out = this.commands;
    this.commands = [];
    return out;
  }
}

export const renderCommandBuffer = new RenderCommandBuffer();
