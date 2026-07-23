// LevelGenerator: docs/generative_levels.md §3's reverse-design pipeline —
// sample which ability is required → build the matrix goal state that powers
// it → lay a hex gate around it → add a decoy → optionally layer Neuro-
// Resonance/Focus Vault/Echo Tile → set initialAP from the difficulty target
// → verify. Every candidate is solver-checked before being returned; the CLI
// (scripts/generateLevel.ts) layers the headless witness-replay and real-
// browser Playwright checks on top before accepting one for real.
//
// SCOPE CUT (disclosed, not silent): the full spec's step 1 ("sample the
// ability requirement graph") allows arbitrary multi-ability dependency
// chains across arbitrary hex topology. Reliably laying out arbitrary hex
// paths without risking a broken or trivially-bypassable level is a much
// bigger undertaking than fits this pass. v1 instead reuses the exact,
// already-proven "gate-wall funnel around one hazard" template shared by
// levels 2/3/8/20/23/25/26/27/28/29 — one required core ability per
// generated level, picked from whichever of UNLOCK_RED/UNLOCK_BLUE/
// FIRE_IMMUNITY are in `mechanics`. JUMP/PUSH/PHASE_SHIFT are fully
// solver-modeled (LevelSolver.ts) but need fundamentally different terrain
// (a missing-tile gap, a pushable block, a phase barrier respectively, not a
// swapped hazard type) — requesting them alone returns a clean, explicit
// failure rather than a broken level. RESONANCE/FOCUS_VAULT/ECHO_TILE (all
// three explicitly requested for v1, unlike the core three) layer on top of
// any core mechanic without needing new hex geometry: RESONANCE always uses
// the safe, never-load-bearing Discharge pattern levels 26-29 established
// (a bonus AP credit, never required — Anchor/Dampening's load-bearing
// variants would complicate the difficulty budget this pass doesn't need to
// solve); FOCUS_VAULT/ECHO_TILE are placed exactly as in levels 23/25,
// solver-invisible by construction, same as every hand-authored level using
// them.

import type {
  LevelDef, EntityDef, MatrixConduitDef, MatrixNodeDef, InventoryConduitDef,
} from '@/levels/LevelSchema';
import { AbilityType, HazardType, ConduitShape, ConduitBase } from '@/types';
import { solveLevel } from './LevelSolver';
import type { SolverResult, SolverAction } from './LevelSolver';
import { scoreDifficulty } from './DifficultyModel';
import { forkStream } from './Random';
import type { PCG32 } from './Random';

export type CoreMechanic = 'UNLOCK_RED' | 'UNLOCK_BLUE' | 'FIRE_IMMUNITY';
export type ExtraMechanic = 'RESONANCE' | 'FOCUS_VAULT' | 'ECHO_TILE';
export type UnsupportedMechanic = 'JUMP' | 'PUSH' | 'PHASE_SHIFT';
export type MechanicId = CoreMechanic | ExtraMechanic | UnsupportedMechanic;

export interface GeneratorParams {
  /** Target DifficultyModel score (same units as scoreDifficulty's output). */
  difficulty: number;
  /** Eligible mechanics — at least one of UNLOCK_RED/UNLOCK_BLUE/FIRE_IMMUNITY
   * is required (the Generator picks one per candidate); RESONANCE/
   * FOCUS_VAULT/ECHO_TILE layer on top if present; JUMP/PUSH/PHASE_SHIFT are
   * accepted by the type but never wired up (see the file header). */
  mechanics: MechanicId[];
  seed: number;
}

export interface GeneratorSuccess {
  ok: true;
  def: LevelDef;
  optimalCost: number;
  initialAP: number;
  slack: number;
  minSwitches: number;
  coordinationSteps: number;
  difficultyScore: number;
  attempt: number;
  /** The witness — scripts/generateLevel.ts feeds this to WitnessReplay.ts
   * and the Playwright e2e gate for the two checks LevelGenerator.ts itself
   * doesn't run (see the file header). */
  solutionPath: SolverAction[];
}
export interface GeneratorFailure {
  ok: false;
  reason: string;
  attempts: number;
}
export type GeneratorResult = GeneratorSuccess | GeneratorFailure;

const CORE_TABLE: Record<CoreMechanic, { hazardType: number; abilityType: number }> = {
  UNLOCK_RED:    { hazardType: HazardType.LOCKED_RED,  abilityType: AbilityType.UNLOCK_RED },
  UNLOCK_BLUE:   { hazardType: HazardType.LOCKED_BLUE, abilityType: AbilityType.UNLOCK_BLUE },
  FIRE_IMMUNITY: { hazardType: HazardType.FIRE,         abilityType: AbilityType.FIRE_IMMUNITY },
};

const MAX_ATTEMPTS = 20;
// Generous placeholder while discovering optimalCost — the real value is
// mechanics-independent of AP (AP only gates whether a budget suffices, not
// which actions are needed), so one probe solve is enough to learn it.
const SOLVE_AP_CEILING = 40;

export function generateLevel(params: GeneratorParams): GeneratorResult {
  const coreOptions = params.mechanics.filter((m): m is CoreMechanic => m in CORE_TABLE);
  if (coreOptions.length === 0) {
    return {
      ok: false, attempts: 0,
      reason: 'no supported core mechanic in `mechanics` — need at least one of ' +
        'UNLOCK_RED, UNLOCK_BLUE, FIRE_IMMUNITY (JUMP/PUSH/PHASE_SHIFT are solver-modeled ' +
        'but not yet wired into the Generator\'s hex-layout step — see LevelGenerator.ts header)',
    };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rng = forkStream(params.seed, attempt);
    const core = rng.pick(coreOptions);
    const wantResonance  = params.mechanics.includes('RESONANCE');
    const wantFocusVault = params.mechanics.includes('FOCUS_VAULT');
    const wantEchoTile   = params.mechanics.includes('ECHO_TILE');

    const draft = buildDraft(params, rng, attempt, core, wantResonance, wantFocusVault, wantEchoTile);

    const probe = solveLevel(draft);
    if (!probe.solvable) continue; // fresh sub-seed next attempt

    const totalUnlockValue = draft.apUnlockNodes.reduce((s, u) => s + u.value, 0);
    const margin = computeMargin(params.difficulty);

    // A tight initialAP doesn't just cap total spend — it can also make the
    // solver's own optimal ordering more expensive (e.g. a cheaper path needs
    // more AP mid-route, before the Shared Unlock's +value is earned, than a
    // tight starting pool allows), so a *lower* AP can imply a *higher*
    // optimalCost — and at the extreme, tight enough to make the level
    // genuinely UNSOLVABLE (not just costlier), since a fixed-overhead
    // template like this one's has a hard minimum AP no amount of clever play
    // gets under. Both cases climb `finalInitialAP` monotonically — costlier
    // implies a higher target directly; genuinely unsolvable bumps it by a
    // step and retries — and stop the moment a solved run's achieved margin
    // already meets the target. Always terminates (AP only ever rises) and
    // never oscillates; actual slack may end up more generous than the
    // requested `margin` when the template's own floor exceeds it, never less.
    let finalInitialAP = probe.optimalCost - totalUnlockValue + margin;
    let result: Extract<SolverResult, { solvable: true }> | null = null;
    let converged = false;
    for (let iter = 0; iter < 12; iter++) {
      if (finalInitialAP < 1 || finalInitialAP > SOLVE_AP_CEILING) break; // degenerate for this seed
      const attemptResult = solveLevel({ ...draft, initialAP: finalInitialAP });
      if (!attemptResult.solvable) { finalInitialAP += 2; continue; } // below this template's floor — bump and retry
      result = attemptResult;
      const impliedAP = attemptResult.optimalCost - totalUnlockValue + margin;
      if (impliedAP <= finalInitialAP) { converged = true; break; }
      finalInitialAP = impliedAP;
    }
    if (!converged || result === null || finalInitialAP < 1) continue;

    const final: LevelDef = { ...draft, initialAP: finalInitialAP };
    const slack = (finalInitialAP + totalUnlockValue) - result.optimalCost;
    if (slack < 1) continue;               // standing fairness gate
    if (result.minSwitches < 1) continue;  // standing interaction gate

    const diff = scoreDifficulty(result, finalInitialAP, totalUnlockValue);
    if (!diff) continue;

    return {
      ok: true, attempt, def: final,
      optimalCost: result.optimalCost, initialAP: finalInitialAP, slack,
      minSwitches: result.minSwitches, coordinationSteps: result.coordinationSteps,
      difficultyScore: diff.score, solutionPath: result.solutionPath,
    };
  }
  return {
    ok: false, attempts: MAX_ATTEMPTS,
    reason: `no valid candidate found within ${MAX_ATTEMPTS} attempts for ` +
      `difficulty=${params.difficulty}, mechanics=[${params.mechanics.join(',')}], seed=${params.seed}`,
  };
}

/** Simple, disclosed first-pass curve — higher requested difficulty means a
 * smaller AP margin over the proven optimum. Calibrating this against real
 * playtests is the same 🔢 Chris-owned job as DifficultyModel's own weight
 * vector (generative_levels.md §4) — a starting point, not a final tuning. */
function computeMargin(difficulty: number): number {
  return Math.max(1, Math.min(8, Math.round(8 - difficulty)));
}

function buildDraft(
  params: GeneratorParams, rng: PCG32, attempt: number, core: CoreMechanic,
  wantResonance: boolean, wantFocusVault: boolean, wantEchoTile: boolean,
): LevelDef {
  const { hazardType, abilityType } = CORE_TABLE[core];
  const holder: 0 | 1 = rng.nextInt(2) as 0 | 1;

  const entities: EntityDef[] = [
    { type: 'avatar', id: 'avatar_p1', playerId: 0, q: 0, r: 2, z: 0 },
    { type: 'avatar', id: 'avatar_p2', playerId: 1, q: 0, r: 2, z: 1 },
    { type: 'exit', id: 'exit_p1', playerId: 0, q: 0, r: -2, z: 0 },
    { type: 'exit', id: 'exit_p2', playerId: 1, q: 0, r: -2, z: 1, initiallyLocked: true },
    { type: 'hazard', id: 'door_gate', hazardType, q: 0, r: -1, z: 0 },
    ...gateWallCluster(),
  ];
  if (wantEchoTile) entities.push({ type: 'echo_tile', id: 'echo_a', q: 0, r: 1, z: 0 });

  const conduits: MatrixConduitDef[] = [];
  const routePlate: InventoryConduitDef = { entityId: 'inv_route_plate', shape: ConduitShape.STRAIGHT, rotation: 0 };

  if (wantResonance) {
    // Discharge (EX→IN) — the safe, never-load-bearing pattern levels 26-29
    // already established. A CURVED dummy (not STRAIGHT) at the entry row so
    // it can never be rotated into the route's own E-W orientation and
    // silently substitute for the real fresh insert (the exact rotate-bypass
    // flaw found and fixed during SPRINT_028's level 27).
    conduits.push({ id: 'prep_in_plate', column: 2, row: 0, shape: ConduitShape.CURVED, rotation: 0, base: ConduitBase.IN });
    routePlate.base = ConduitBase.EX;
  }

  const inventory: { player0: InventoryConduitDef[]; player1: InventoryConduitDef[] } = { player0: [], player1: [] };
  (holder === 0 ? inventory.player0 : inventory.player1).push(routePlate);

  const matrixNodes: MatrixNodeDef[] = [{ id: 'node_c3r0', column: 3, row: 0, abilityType }];
  const apUnlockNodes = [{ id: 'unlock_01', value: 4, hexA: { q: -1, r: 1 }, hexB: { q: -1, r: 1 } }];
  const focusVaultNodes = wantFocusVault ? [{
    id: 'vault_01', cost: 3,
    hexA: { q: 1, r: 1 }, hexB: { q: 1, r: 1 },
    vault: { q: 2, r: 0, z: 0 as const, shape: ConduitShape.CROSS, rotation: 0 },
  }] : undefined;

  return {
    id: '_candidate',
    name: `Generated ${core}${wantResonance ? '+RESONANCE' : ''}${wantFocusVault ? '+FOCUS_VAULT' : ''}${wantEchoTile ? '+ECHO_TILE' : ''} (seed=${params.seed}, attempt=${attempt}, D=${params.difficulty})`,
    initialAP: SOLVE_AP_CEILING, // replaced with the real value once optimalCost is known
    apUnlockNodes,
    focusVaultNodes,
    initialInventory: inventory,
    scrapPool: [],
    entities,
    matrix: { nodes: matrixNodes, conduits },
  };
}

/** The proven 5-wall funnel shared by levels 2/3/8/20/23/25/26/27/28/29 —
 * forces routing through the single gated hex at (0,-1) instead of around it. */
function gateWallCluster(): EntityDef[] {
  const offsets: [number, number][] = [[1, -2], [1, -3], [0, -3], [-1, -2], [-1, -1]];
  return offsets.map(([q, r]) => ({ type: 'wall', id: `gate_wall_${q}_${r}`, q, r, z: 0 }));
}
