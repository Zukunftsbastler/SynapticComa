import { defineComponent, Types } from 'bitecs';

export const Renderable = defineComponent({
  spriteId:   Types.ui16, // maps to SpriteId enum
  visible:    Types.ui8,  // 0 = hidden, 1 = visible
  layer:      Types.ui8,  // PixiJS z-order layer index
  dirty:      Types.ui8,  // 1 = needs re-render this frame
  isTweening: Types.ui8,  // 1 = tween owns the sprite position; RenderSystem ignores ECS coords
});
