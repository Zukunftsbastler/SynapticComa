// AnimationState: per-entity tween bookkeeping for RenderSystem.
// Stores the current screen-position tween target for each entity so that
// RenderSystem can apply animated positions rather than raw ECS positions.
//
// Keyed by bitECS entity ID. Values are plain PixiJS-compatible objects
// with x/y properties that TweenManager writes into each frame.
//
// isTweening flag (Decision 8): when 1, RenderSystem uses the animatedPos
// instead of ECS Position coordinates, preventing visual stuttering on
// in-progress moves.

export interface AnimatedPos {
  x: number;
  y: number;
}

const positions = new Map<number, AnimatedPos>();

/** Get or create an animated position record for an entity. */
export function getAnimatedPos(eid: number, fallbackX: number, fallbackY: number): AnimatedPos {
  if (!positions.has(eid)) {
    positions.set(eid, { x: fallbackX, y: fallbackY });
  }
  return positions.get(eid)!;
}

export function clearAnimationState(): void {
  positions.clear();
}
