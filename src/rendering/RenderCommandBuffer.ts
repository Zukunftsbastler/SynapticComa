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

export type DrawSpriteCommand = {
  cmd:      'drawSprite';
  x:        number;
  y:        number;
  spriteId: number;
  visible:  boolean;
};

export type ClearCommand = { cmd: 'clear' };

export type RenderCommand =
  | DrawHexCommand
  | DrawCircleCommand
  | DrawRectCommand
  | DrawSpriteCommand
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
