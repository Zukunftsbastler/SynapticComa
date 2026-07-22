// Tracks which SpriteIds currently have a real loaded PixiJS texture, without
// RenderSystem (pure ECS logic — no PixiJS import today, and this keeps it
// that way) needing to import pixi.js itself. PixiDriver populates this after
// attempting to load every path in SPRITE_PATHS; RenderSystem reads it to
// decide sprite-vs-procedural-color per entity each frame.
//
// Starts empty. Until a real asset file exists under public/sprites or
// public/ui for a given SpriteId, every check here returns false and
// RenderSystem's rendering is byte-identical to before this file existed —
// the whole point of the incremental-fallback design (docs/art_pipeline_roadmap.md §3).

const loaded = new Set<number>();

export function markSpriteLoaded(id: number): void {
  loaded.add(id);
}

export function isSpriteLoaded(id: number): boolean {
  return loaded.has(id);
}
