import type { ScrapPlate } from '@/state/ScrapPoolState';

// Neuro-Resonance runtime state (mechanics.md §4.5). Tracks which ordered
// eid-pairs have already fired (so re-forming the identical pair between the
// identical two plates never re-triggers — see ResonanceSystem.ts) and the
// two delayed-discount flags (Dampening/Anchor apply to the NEXT Rotate/
// Insert action, not the one that formed the pair) plus the Clarity reveal.
export interface ResonanceStateData {
  firedPairs: Set<string>;           // `${upperEid}:${lowerEid}`
  dampeningActive: boolean;          // next ROTATE costs 0 AP
  anchorActive: boolean;             // next INSERT costs 1 AP instead of 2
  clarityRevealedPlate: ScrapPlate | null; // revealed face-up until next mutation
  /** Set by MatrixInsertSystem/MatrixRotateSystem when they mutate the matrix
   *  this tick; consumed and reset by ResonanceSystem, which runs right after. */
  mutatedThisTick: boolean;
  /** Cumulative +1 AP grants from Discharge this level. Never decreases; lets
   *  WitnessReplay.ts net out Discharge's surge the same way it already nets
   *  out Shared Unlock credit, since it's an additive side-effect the acting
   *  system doesn't itself report (unlike Anchor/Dampening, which change the
   *  cost of the NEXT action directly rather than crediting a separate sum). */
  totalDischargeCredit: number;
}

export const resonanceState: ResonanceStateData = {
  firedPairs: new Set(),
  dampeningActive: false,
  anchorActive: false,
  clarityRevealedPlate: null,
  mutatedThisTick: false,
  totalDischargeCredit: 0,
};

export function clearResonanceState(): void {
  resonanceState.firedPairs.clear();
  resonanceState.dampeningActive = false;
  resonanceState.anchorActive = false;
  resonanceState.clarityRevealedPlate = null;
  resonanceState.mutatedThisTick = false;
  resonanceState.totalDischargeCredit = 0;
}
