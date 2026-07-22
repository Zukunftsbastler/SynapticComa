// Shared symbol explanations — one place so LegendPanel.ts (the persistent
// map key) and HoverTooltip.ts (the per-hex mouseover) can never drift apart
// on what a sprite means (Till's ACHTUNG, 2026-07-22: "auch gern wieder ein
// erläuterndes Mouseover"). Covers only the sprites whose meaning is fixed
// regardless of instance state; avatars/exits depend on which board/lock
// state they're in and stay special-cased in each caller.

import { SpriteId, SPRITE_PATHS } from '@/registry/SpriteRegistry';
import { isSpriteLoaded } from '@/registry/TextureRegistry';

export const ENTITY_LABELS: Partial<Record<SpriteId, string>> = {
  [SpriteId.WALL_HEX_A]:           'Wall',
  [SpriteId.WALL_HEX_B]:           'Wall',
  [SpriteId.HAZARD_LOCKED_RED]:    'Red door — open while R is powered',
  [SpriteId.HAZARD_LOCKED_BLUE]:   'Blue door — open while B is powered',
  [SpriteId.HAZARD_FIRE_A]:        'Fire — lethal without ♨',
  [SpriteId.HAZARD_FIRE_B]:        'Fire — lethal without ♨',
  [SpriteId.HAZARD_LETHAL_A]:      'Lethal — never enter; ⇈ jumps across',
  [SpriteId.HAZARD_LETHAL_B]:      'Lethal — never enter; ⇈ jumps across',
  [SpriteId.HAZARD_PHASE_BARRIER]: 'Phase barrier — open while ◈ is powered',
  [SpriteId.AP_UNLOCK_NODE_A]:     'Shared Unlock — both wisps on it: +AP',
  [SpriteId.AP_UNLOCK_NODE_B]:     'Shared Unlock — both wisps on it: +AP',
  [SpriteId.PUSHABLE_BLOCK]:       'Pushable block — ▶ push to move it',
  [SpriteId.FOCUS_NODE]:           'Focus node — spends AP to open a bonus vault',
  [SpriteId.ECHO_TILE]:            'Echo tile — briefly reveals the far board',
};

// Small inline <img> for a promoted sprite, sized to match LegendPanel's
// existing 22x22 inline-SVG swatches. `image-rendering: pixelated` matches
// the `scaleMode: 'nearest'` PixiDriver.ts already sets on every texture, so
// the legend/tooltip thumbnail and the in-game sprite look the same.
export function spriteImgTag(path: string): string {
  return `<img src="${path}" width="22" height="22" alt="" ` +
    `style="object-fit:cover;image-rendering:pixelated;border-radius:3px;vertical-align:middle;" />`;
}

// Real sprite thumbnail once promoted+loaded, else the caller's flat-color
// SVG swatch — same fallback rule TextureRegistry/RenderSystem already use
// for the board itself, so legend/tooltip art availability never disagrees
// with what's actually drawn on the hex grid.
export function swatchFor(sid: SpriteId, fallback: string): string {
  return isSpriteLoaded(sid) ? spriteImgTag(SPRITE_PATHS[sid]) : fallback;
}
