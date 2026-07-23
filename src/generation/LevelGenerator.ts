// LevelGenerator: docs/generative_levels.md §3's reverse-design pipeline —
// sample which ability(ies) are required → build the matrix goal state that
// powers them → lay hex gates around them → add a decoy → optionally layer
// Neuro-Resonance/Focus Vault/Echo Tile → set initialAP from the difficulty
// target → verify. Every candidate is solver-checked before being returned;
// the CLI (scripts/generateLevel.ts) layers the headless witness-replay and
// real-browser Playwright checks on top before accepting one for real.
//
// SCOPE CUT (disclosed, not silent): the full spec's step 1 ("sample the
// ability requirement graph") allows arbitrary multi-ability dependency
// chains across arbitrary hex topology. v2 (SPRINT_029 follow-up, after
// Batch 1 confirmed a single-ability template plateaus around D≈6.2) chains
// up to **two** simultaneous required core abilities and scales gridRadius
// with difficulty — still short of arbitrary N-ability graphs, but reusing
// the exact, already-proven "two gate-wall funnels, one near spawn and one
// near exit, each mirrored across both dimensions" shape `level_16.json`
// "Airlock" (RED+BLUE) already ships. `JUMP`/`PUSH`/`PHASE_SHIFT` still need
// fundamentally different terrain (a missing-tile gap, a pushable block, a
// phase barrier respectively, not a swapped hazard type) and a 3rd physical
// gate ring is still unbuilt — both stay explicit follow-ups, not silent
// gaps: requesting JUMP/PUSH/PHASE_SHIFT alone still fails cleanly.
// RESONANCE/FOCUS_VAULT/ECHO_TILE layer on top of any core-ability count
// without needing new hex geometry, same as v1: RESONANCE always uses the
// safe, never-load-bearing Discharge pattern levels 26-29 established;
// FOCUS_VAULT/ECHO_TILE are placed solver-invisible by construction, same as
// every hand-authored level using them — just re-anchored relative to the
// (now variable) spawn hex instead of fixed absolute coordinates, backed by
// a defensive collision check (see buildDraft) rather than hand-proving
// non-overlap for every radius/ability-count combination by inspection.

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
   * is required (the Generator picks one or two per candidate, see
   * computeAbilityCount); RESONANCE/FOCUS_VAULT/ECHO_TILE layer on top if
   * present; JUMP/PUSH/PHASE_SHIFT are accepted by the type but never wired
   * up (see the file header). */
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

  const abilityCount = computeAbilityCount(params.difficulty, coreOptions.length);
  const gridRadius = computeGridRadius(params.difficulty);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rng = forkStream(params.seed, attempt);
    const cores = pickDistinct(rng, coreOptions, abilityCount);
    const wantResonance  = params.mechanics.includes('RESONANCE');
    const wantFocusVault = params.mechanics.includes('FOCUS_VAULT');
    const wantEchoTile   = params.mechanics.includes('ECHO_TILE');

    const draft = buildDraft(params, rng, attempt, cores, gridRadius, wantResonance, wantFocusVault, wantEchoTile);
    if (!draft) continue; // collision in this attempt's layout — fresh sub-seed next time

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

/** Chains a 2nd required core ability once requested difficulty and the
 * caller's mechanics set both allow it — this is what lets achieved
 * difficulty climb past the ~D=6.2 plateau v1's single-ability levels hit
 * (Batch 1, SPRINT_029). Falls back to 1 (today's exact v1 behavior) when
 * only one core mechanic is eligible — fully backward compatible. 🔢 same
 * disclosed-heuristic status as computeMargin. */
function computeAbilityCount(difficulty: number, eligibleCoreCount: number): 1 | 2 {
  return difficulty >= 5 && eligibleCoreCount >= 2 ? 2 : 1;
}

/** Scales the board with difficulty — a longer walk between gates, not just
 * a tighter AP budget, contributes to raising D past the single-radius
 * plateau. Capped at 5: gridRadius has no hidden engine cap (confirmed via
 * LevelLoaderSystem.ts/MovementSystem.ts/LevelSolver.ts — it only widens
 * floor-tile scatter and the movement/solver boundary check), but 5 is the
 * largest value this generator has actually verified end-to-end so far. */
function computeGridRadius(difficulty: number): number {
  if (difficulty >= 9) return 5;
  if (difficulty >= 6) return 4;
  return 3;
}

function pickDistinct<T>(rng: PCG32, items: readonly T[], n: number): T[] {
  return rng.shuffle([...items]).slice(0, n);
}

type Axial = { q: number; r: number };
const add = (a: Axial, [dq, dr]: [number, number]): Axial => ({ q: a.q + dq, r: a.r + dr });

// The proven two-ring shape, traced from level_16.json "Airlock" (RED+BLUE,
// D=5.70) — one ring near spawn, one near exit, each mirrored across both
// dimensions. Offsets are relative to spawn/exit respectively so the whole
// shape scales automatically as gridRadius (and therefore spawn/exit
// distance from origin) grows.
const SPAWN_RING_WALLS: [number, number][] = [[1, 0], [1, -1], [0, 1], [-1, 1], [-1, 0]];
const SPAWN_RING_HAZARD: [number, number] = [0, -1];
const EXIT_RING_WALLS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1]];
const EXIT_RING_HAZARD: [number, number] = [0, 1];
// Optional-extra anchors, relative to spawn — reproduce v1's exact absolute
// positions at gridRadius=3 (spawn=(0,2)) for backward compatibility, and
// scale sensibly for larger radii. Chosen to avoid the spawn-side ring above
// by inspection; the collision guard in buildDraft is the real safety net.
const SHARED_UNLOCK_OFFSET: [number, number] = [-1, -1];
const FOCUS_VAULT_NODE_OFFSET: [number, number] = [1, -1];
const FOCUS_VAULT_PLATE_OFFSET: [number, number] = [2, -2];
const ECHO_TILE_OFFSET: [number, number] = [-2, 0];

function ringEntities(
  center: Axial, wallOffsets: [number, number][], hazardOffset: [number, number],
  z: 0 | 1, idPrefix: string, hazardType: number,
): EntityDef[] {
  const hazardHex = add(center, hazardOffset);
  return [
    { type: 'hazard', id: `${idPrefix}_hazard_${z}`, hazardType, q: hazardHex.q, r: hazardHex.r, z },
    ...wallOffsets.map((off, i) => {
      const hex = add(center, off);
      return { type: 'wall' as const, id: `${idPrefix}_wall_${z}_${i}`, q: hex.q, r: hex.r, z };
    }),
  ];
}

function buildDraft(
  params: GeneratorParams, rng: PCG32, attempt: number, cores: CoreMechanic[], gridRadius: number,
  wantResonance: boolean, wantFocusVault: boolean, wantEchoTile: boolean,
): LevelDef | null {
  const spawn: Axial = { q: 0, r: gridRadius - 1 };
  const exit:  Axial = { q: 0, r: -(gridRadius - 1) };

  const entities: EntityDef[] = [
    { type: 'avatar', id: 'avatar_p1', playerId: 0, q: spawn.q, r: spawn.r, z: 0 },
    { type: 'avatar', id: 'avatar_p2', playerId: 1, q: spawn.q, r: spawn.r, z: 1 },
    { type: 'exit', id: 'exit_p1', playerId: 0, q: exit.q, r: exit.r, z: 0 },
    { type: 'exit', id: 'exit_p2', playerId: 1, q: exit.q, r: exit.r, z: 1, initiallyLocked: true },
  ];

  const matrixNodes: MatrixNodeDef[] = [];
  const conduits: MatrixConduitDef[] = [];
  const inventory: { player0: InventoryConduitDef[]; player1: InventoryConduitDef[] } = { player0: [], player1: [] };

  // Exit-side ring always exists (v1's original single-gate shape); the
  // spawn-side ring only when a 2nd ability was chained. Both rings gate
  // BOTH dimensions — z:0 and z:1 each get their own copy of the same
  // hazard type/wall cluster — which is what forces both avatars through
  // both gates (level_16's proven shape), since abilities are global once
  // powered.
  cores.forEach((core, i) => {
    const { hazardType, abilityType } = CORE_TABLE[core];
    const isSpawnRing = cores.length === 2 && i === 0;
    const center = isSpawnRing ? spawn : exit;
    const wallOffsets = isSpawnRing ? SPAWN_RING_WALLS : EXIT_RING_WALLS;
    const hazardOffset = isSpawnRing ? SPAWN_RING_HAZARD : EXIT_RING_HAZARD;
    const idPrefix = `gate${i}`;
    entities.push(
      ...ringEntities(center, wallOffsets, hazardOffset, 0, idPrefix, hazardType),
      ...ringEntities(center, wallOffsets, hazardOffset, 1, idPrefix, hazardType),
    );

    matrixNodes.push({ id: `node_c3r${i}`, column: 3, row: i, abilityType });
    const routePlate: InventoryConduitDef = { entityId: `inv_route_plate_${i}`, shape: ConduitShape.STRAIGHT, rotation: 0 };
    if (wantResonance && i === 0) {
      // Discharge (EX→IN) — the safe, never-load-bearing pattern levels
      // 26-29 already established. A CURVED dummy (not STRAIGHT) at the
      // entry row so it can never be rotated into the route's own E-W
      // orientation and silently substitute for the real fresh insert (the
      // exact rotate-bypass flaw found and fixed for SPRINT_028's level 27).
      conduits.push({ id: 'prep_in_plate', column: 2, row: 0, shape: ConduitShape.CURVED, rotation: 0, base: ConduitBase.IN });
      routePlate.base = ConduitBase.EX;
    }
    const holder: 0 | 1 = rng.nextInt(2) as 0 | 1;
    (holder === 0 ? inventory.player0 : inventory.player1).push(routePlate);
  });

  const unlockHex = add(spawn, SHARED_UNLOCK_OFFSET);
  const apUnlockNodes = [{ id: 'unlock_01', value: 4, hexA: { q: unlockHex.q, r: unlockHex.r }, hexB: { q: unlockHex.q, r: unlockHex.r } }];

  const focusVaultNodes = wantFocusVault ? (() => {
    const vaultHex = add(spawn, FOCUS_VAULT_NODE_OFFSET);
    const plateHex = add(spawn, FOCUS_VAULT_PLATE_OFFSET);
    return [{
      id: 'vault_01', cost: 3,
      hexA: { q: vaultHex.q, r: vaultHex.r }, hexB: { q: vaultHex.q, r: vaultHex.r },
      vault: { q: plateHex.q, r: plateHex.r, z: 0 as const, shape: ConduitShape.CROSS, rotation: 0 },
    }];
  })() : undefined;

  if (wantEchoTile) {
    const echoHex = add(spawn, ECHO_TILE_OFFSET);
    entities.push({ type: 'echo_tile', id: 'echo_a', q: echoHex.q, r: echoHex.r, z: 0 });
  }

  // Defensive collision guard (plan §4): rather than hand-proving every
  // radius/ability-count/optional-extra combination never overlaps, reject
  // any attempt where two entities land on the same (q,r,z) — cheap, and
  // turns a layout mistake into "try a different seed" instead of a broken
  // or silently-miswired level.
  const seen = new Set<string>();
  for (const e of entities) {
    const key = `${e.q},${e.r},${e.z}`;
    if (seen.has(key)) return null;
    seen.add(key);
  }

  return {
    id: '_candidate',
    name: `Generated ${cores.join('+')}${wantResonance ? '+RESONANCE' : ''}${wantFocusVault ? '+FOCUS_VAULT' : ''}${wantEchoTile ? '+ECHO_TILE' : ''} (seed=${params.seed}, attempt=${attempt}, D=${params.difficulty}, R=${gridRadius})`,
    initialAP: SOLVE_AP_CEILING, // replaced with the real value once optimalCost is known
    apUnlockNodes,
    gridRadius,
    focusVaultNodes,
    initialInventory: inventory,
    scrapPool: [],
    entities,
    matrix: { nodes: matrixNodes, conduits },
  };
}
