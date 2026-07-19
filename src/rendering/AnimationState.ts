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

import { tween, clearTweens } from './TweenManager';

export interface AnimatedPos {
  x: number;
  y: number;
  // Index signature keeps AnimatedPos assignable to TweenManager's TweenTarget.
  [key: string]: number;
}

const positions = new Map<number, AnimatedPos>();
const targets   = new Map<number, { x: number; y: number }>();

/** Get or create an animated position record for an entity. */
export function getAnimatedPos(eid: number, fallbackX: number, fallbackY: number): AnimatedPos {
  if (!positions.has(eid)) {
    positions.set(eid, { x: fallbackX, y: fallbackY });
  }
  return positions.get(eid)!;
}

/**
 * Declares the entity's current logical screen position. First sighting snaps;
 * any later change starts a short ease tween. Returns the position to draw at.
 */
export function animateTo(eid: number, x: number, y: number, durationMs = 140): AnimatedPos {
  const pos  = getAnimatedPos(eid, x, y);
  const prev = targets.get(eid);
  if (!prev) {
    targets.set(eid, { x, y });
    pos.x = x; pos.y = y;
  } else if (prev.x !== x || prev.y !== y) {
    targets.set(eid, { x, y });
    tween(pos, 'x', x, durationMs);
    tween(pos, 'y', y, durationMs);
  }
  return pos;
}

export function clearAnimationState(): void {
  positions.clear();
  targets.clear();
  clearTweens();
}
