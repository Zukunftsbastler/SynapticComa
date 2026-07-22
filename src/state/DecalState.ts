// Runtime placement of the cosmetic multi-hex decal overlay (see
// registry/DecalRegistry.ts for what these are and why). Purely a rendering
// concern — no ECS entity, no gameplay effect, never networked (each client
// re-rolls its own scatter independently; it's cosmetic, so Host/Guest
// disagreeing on exact decal placement is fine, unlike everything else in
// this game). Re-rolled on every level load so repeat playthroughs don't
// look identical (Till's ask, 2026-07-21).

import { HEX_SIZE } from '@/constants';
import { DECAL_PATHS_ID, DECAL_PATHS_SUPEREGO } from '@/registry/DecalRegistry';

export interface DecalInstance {
  dx: number;      // pixel offset from the dimension's origin
  dy: number;
  z: 0 | 1;
  path: string;
  width: number;
  height: number;
}

// Pulled back out, 2026-07-22: the decal scatter made the board noticeably
// harder to read ("machen das Feld deutlich schwerer lesbar" — Till). Kept
// the whole mechanism in place (registry, placement logic, rendering) rather
// than deleting it — this is "vorerst" (for now), pending the tile-border
// legibility work landing first. Flip back to true to re-enable; no other
// code needs to change either way.
const DECALS_ENABLED = false;

const DECALS_PER_DIMENSION = 3;
const DECAL_WIDTH = 200;   // px on screen — roughly 2.5 hex-widths
const DECAL_HEIGHT = 100;
// Rejection-sampling spacing: keeps decal centers apart so they don't stack
// on top of each other (found overlapping badly in practice, 2026-07-21).
const MIN_CENTER_DIST = Math.max(DECAL_WIDTH, DECAL_HEIGHT) * 0.9;
const PLACEMENT_ATTEMPTS = 20;

function pickDistinctPaths(paths: readonly string[], count: number): string[] {
  const shuffled = [...paths].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export let decals: DecalInstance[] = [];

export function clearDecals(): void {
  decals = [];
}

/** Re-rolls a fresh random scatter for the current level's grid radius. */
export function scatterDecals(gridRadius: number): void {
  if (!DECALS_ENABLED) { decals = []; return; }
  const maxDist = gridRadius * HEX_SIZE * 1.1; // stay within the visible disc, not right at the rim
  const next: DecalInstance[] = [];
  for (const [z, paths] of [[0, DECAL_PATHS_ID], [1, DECAL_PATHS_SUPEREGO]] as const) {
    // Distinct props per scatter (Till's ask: 3 different ones, not the same
    // one three times) — falls back to repeats only if the pool is smaller
    // than DECALS_PER_DIMENSION.
    const chosenPaths = pickDistinctPaths(
      paths, DECALS_PER_DIMENSION,
    );
    while (chosenPaths.length < DECALS_PER_DIMENSION && paths.length > 0) {
      chosenPaths.push(paths[Math.floor(Math.random() * paths.length)]);
    }

    const placedInThisDim: { dx: number; dy: number }[] = [];
    for (const path of chosenPaths) {
      let best: { dx: number; dy: number } | null = null;
      let bestMinDist = -Infinity;
      for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * maxDist;
        const candidate = { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
        const nearest = placedInThisDim.reduce(
          (min, p) => Math.min(min, Math.hypot(p.dx - candidate.dx, p.dy - candidate.dy)),
          Infinity,
        );
        if (nearest >= MIN_CENTER_DIST) { best = candidate; break; } // good enough, stop early
        if (nearest > bestMinDist) { bestMinDist = nearest; best = candidate; } // keep the least-bad fallback
      }
      const chosen = best!; // PLACEMENT_ATTEMPTS >= 1, so best is always set
      placedInThisDim.push(chosen);
      next.push({ ...chosen, z, path, width: DECAL_WIDTH, height: DECAL_HEIGHT });
    }
  }
  decals = next;
}
