import { ConduitShape } from '@/types';

export interface ScrapPlate {
  shape:    ConduitShape;
  rotation: number; // 0–3; stored but hidden from render until drawn
  /** Neuro-Resonance base (mechanics.md §4.5); omitted = ConduitBase.NONE. */
  base?:    number;
}

// Shared Scrap Pool — ejected conduits go face-down here.
// The HUD shows only plates.length (count); contents are never revealed until drawn.
// Either player can draw blind for 1 AP via ScrapPoolSystem.
export const scrapPool: { plates: ScrapPlate[] } = { plates: [] };

export function clearScrapPool(): void {
  scrapPool.plates = [];
}
