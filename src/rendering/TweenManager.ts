// TweenManager: lightweight tween pool for PixiJS display property animations.
// CRITICAL CONSTRAINT: tween state never feeds back into ECS component data.
// Called from PixiDriver.flush(), not from any ECS system.
//
// Supported properties: x, y, alpha, tint (number).
// Easing: cubic ease-in-out.

export type TweenTarget = {
  [key: string]: number;
};

interface Tween {
  target:   TweenTarget;
  prop:     string;
  from:     number;
  to:       number;
  duration: number; // ms
  elapsed:  number; // ms
  onDone?:  () => void;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

const pool: Tween[] = [];

/** Queue a tween on a PixiJS DisplayObject property. */
export function tween(
  target:   TweenTarget,
  prop:     string,
  to:       number,
  duration: number,
  onDone?:  () => void,
): void {
  // Cancel any existing tween on the same target+prop.
  const existing = pool.findIndex(t => t.target === target && t.prop === prop);
  if (existing !== -1) pool.splice(existing, 1);

  pool.push({ target, prop, from: target[prop] ?? 0, to, duration, elapsed: 0, onDone });
}

/** Advance all active tweens by deltaMs. Call from PixiDriver.flush(). */
export function tickTweens(deltaMs: number): void {
  for (let i = pool.length - 1; i >= 0; i--) {
    const tw = pool[i];
    tw.elapsed += deltaMs;
    const progress = Math.min(tw.elapsed / tw.duration, 1);
    tw.target[tw.prop] = tw.from + (tw.to - tw.from) * easeInOut(progress);
    if (progress >= 1) {
      tw.onDone?.();
      pool.splice(i, 1);
    }
  }
}

export function clearTweens(): void {
  pool.length = 0;
}
