// DifficultyModel: turns a SolverResult into a reproducible difficulty score
// (generative_levels.md §4). The weight vector is the primary balancing knob —
// 🔢 Chris owns its calibration; these defaults exist so the pipeline emits
// comparable numbers from day one.

import type { SolverResult } from './LevelSolver';

export interface DifficultyWeights {
  solutionLength: number;   // w₁ — actions in the witness solution
  coordination:   number;   // w₂ — unlock pairs that must be triggered
  apPressure:     number;   // w₃ — 1 − slack/initialAP (tightness of the budget)
  hiddenInfo:     number;   // w₄ — blind draws the solution relies on
  resonance:      number;   // w₅ — reserved (ResonanceSystem lands in SPRINT_008+)
}

export const DEFAULT_WEIGHTS: DifficultyWeights = {
  solutionLength: 0.15,
  coordination:   1.0,
  apPressure:     4.0,
  hiddenInfo:     1.5,
  resonance:      0.0,
};

export interface DifficultyReport {
  score:       number;
  optimalCost: number;
  apSlack:     number;   // initialAP + Σ unlockValues − optimalCost
  tightness:   number;   // 1 − slack/initialAP, clamped to [0, 1]
}

export function scoreDifficulty(
  result: SolverResult,
  initialAP: number,
  totalUnlockValue: number,
  w: DifficultyWeights = DEFAULT_WEIGHTS,
): DifficultyReport | null {
  if (!result.solvable) return null;
  const budget  = initialAP + totalUnlockValue;
  const apSlack = budget - result.optimalCost;
  const tightness = Math.min(1, Math.max(0, 1 - apSlack / initialAP));
  const score =
    w.solutionLength * result.solutionPath.length +
    w.coordination   * result.coordinationSteps +
    w.apPressure     * tightness +
    w.hiddenInfo     * result.drawSteps;
  return {
    score:       Math.round(score * 100) / 100,
    optimalCost: result.optimalCost,
    apSlack,
    tightness:   Math.round(tightness * 100) / 100,
  };
}

/**
 * Endless-mode target curve (generative_levels.md §4): perceptibly rising,
 * flattening into depth rather than size. `d15` is the measured difficulty of
 * campaign level 15; `n` is the 1-based level number (n > 15).
 */
export function targetDifficulty(n: number, d15: number, k = 1.25): number {
  return d15 + k * Math.log2(1 + Math.max(0, n - 15));
}
