// LevelGenerator: docs/generative_levels.md §3's reverse-design pipeline —
// sample which ability(ies) are required → build the matrix goal state that
// powers them → lay hex gates around them → add a decoy → optionally layer
// Neuro-Resonance/Focus Vault/Echo Tile → set initialAP from the difficulty
// target → verify. Every candidate is solver-checked before being returned;
// the CLI (scripts/generateLevel.ts) layers the headless witness-replay and
// real-browser Playwright checks on top before accepting one for real.
//
// v3 (SPRINT_031): chains up to **three** simultaneous required core
// abilities, and JUMP/PUSH/PHASE_SHIFT are now fully wired — the last
// disclosed gap from v1/v2 is closed; every mechanic the type system accepts
// is a real, generatable gate. Every gate (whatever mechanic) is a single
// row, fully sealed except the q=0 corridor hex where the gate itself sits:
//   - RED/BLUE/FIRE: a `hazard` of the matching type at the gate hex.
//   - PHASE_SHIFT: a `phase_barrier` at the gate hex — `level_18.json`
//     "Ghost Step" confirms it blocks passage identically to a hazard door.
//   - JUMP: a CHASM hazard (`alwaysLethal`, no ability neutralizes landing on
//     it) — traced from `level_03.json` "Column Shift".
//   - PUSH: a `pushable_block` at the gate hex, traced from
//     `PushSystem.ts`/`LevelSolver.ts`'s actual rule rather than
//     `level_22.json`'s bespoke hand-tuned maze (not safely parametrizable).
//     Push always happens in the party's fixed travel direction
//     (spawn→exit); at the exit-adjacent row specifically the gate sits one
//     row further out than usual so the push destination can never land on
//     the exit hex itself (LevelSolver.ts's push-blocking check has no
//     board-edge *or* exit awareness — placement has to guarantee this, not
//     rely on the solver to catch it).
//
// GEOMETRY, found empirically not by inspection: a fixed small wall "flank"
// around a gate (level_16.json's 5-wall funnel, level_03.json's 2-wall
// chasm flank) only blocks a detour when the board is narrow enough that the
// flanked hexes ARE the entire row — true at gridRadius=3's cramped boundary
// rows (where every hand-authored funnel-gate level ships), false at larger
// radii, where hex rows widen away from the poles and a fixed-width flank
// leaves the rest of the row open to walk around through. Every gate here
// instead seals its ENTIRE row (every q≠0 hex within gridRadius, computed
// from the hex-distance boundary, not a fixed offset list) — provably
// airtight at any radius, since crossing that row at all requires passing
// through q=0.
//
// JUMP is EXCLUDED from multi-ability combos (SolverAction still lets a
// solo JUMP-only level generate normally) — also found empirically: once
// powered, JUMP lets a player leap over ANY single hex exactly 2 rows away,
// not just its own chasm, because the solver's jump branch never checks the
// intermediate hex. On this generator's shared/mirrored-per-dimension gate
// template that means a powered JUMP can bypass every other row-gate on the
// same corridor too. Hand-authored levels combining JUMP with another
// ability (`level_24.json` "Crossed Wires") avoid this by putting them on
// DIFFERENT dimensions — a genuinely different, asymmetric-per-z template
// this pass doesn't build.
//
// SCOPE CUT (disclosed, not silent): still not an arbitrary N-ability
// requirement graph — capped at 3, using 3 evenly-spaced gate rows
// (spawn-adjacent, center, exit-adjacent) rather than arbitrary topology.
// `gridRadius` still caps at 5. RESONANCE/FOCUS_VAULT/ECHO_TILE unchanged
// from v2 — layer on top of any ability count/kind without new geometry.
//
// NEW acceptance check this pass: every candidate with gridRadius>3 is now
// re-solved once per required ability with that ability disabled
// (`SolveOptions.disabledAbility`, the same check `scripts/validateLevels.ts`
// already uses to compute `needs=[...]` for hand-authored levels) to confirm
// it's genuinely necessary, not just that *a* solution exists — this is what
// caught both the row-width and the JUMP cross-bypass problems above during
// development, and stays on as a permanent safety net. A bypassed gate fails
// this and the attempt retries with a fresh seed — same pattern as every
// other rejection in this file.

import type {
  LevelDef, EntityDef, MatrixConduitDef, MatrixNodeDef, InventoryConduitDef,
} from '@/levels/LevelSchema';
import { AbilityType, HazardType, ConduitShape, ConduitBase } from '@/types';
import { solveLevel } from './LevelSolver';
import type { SolverResult, SolverAction } from './LevelSolver';
import { scoreDifficulty } from './DifficultyModel';
import { forkStream } from './Random';
import type { PCG32 } from './Random';

export type CoreMechanic =
  | 'UNLOCK_RED' | 'UNLOCK_BLUE' | 'FIRE_IMMUNITY' | 'PHASE_SHIFT' | 'JUMP' | 'PUSH';
export type ExtraMechanic = 'RESONANCE' | 'FOCUS_VAULT' | 'ECHO_TILE';
export type MechanicId = CoreMechanic | ExtraMechanic;

export interface GeneratorParams {
  /** Target DifficultyModel score (same units as scoreDifficulty's output). */
  difficulty: number;
  /** Eligible mechanics — at least one core mechanic is required (the
   * Generator picks up to 3 per candidate, see computeAbilityCount);
   * RESONANCE/FOCUS_VAULT/ECHO_TILE layer on top if present. */
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

// Tagged union: which entity kind sits at a gate's center hex — every kind
// shares the same full-row seal (see sealRow/gateEntities below).
type GateSpec =
  | { kind: 'hazard'; hazardType: number; abilityType: number }
  | { kind: 'phase'; abilityType: number }
  | { kind: 'jump'; abilityType: number }
  | { kind: 'push'; abilityType: number };

const GATE_TABLE: Record<CoreMechanic, GateSpec> = {
  UNLOCK_RED:    { kind: 'hazard', hazardType: HazardType.LOCKED_RED,  abilityType: AbilityType.UNLOCK_RED },
  UNLOCK_BLUE:   { kind: 'hazard', hazardType: HazardType.LOCKED_BLUE, abilityType: AbilityType.UNLOCK_BLUE },
  FIRE_IMMUNITY: { kind: 'hazard', hazardType: HazardType.FIRE,        abilityType: AbilityType.FIRE_IMMUNITY },
  PHASE_SHIFT:   { kind: 'phase', abilityType: AbilityType.PHASE_SHIFT },
  JUMP:          { kind: 'jump',  abilityType: AbilityType.JUMP },
  PUSH:          { kind: 'push',  abilityType: AbilityType.PUSH },
};

const MAX_ATTEMPTS = 20;
// Generous placeholder while discovering optimalCost — the real value is
// mechanics-independent of AP (AP only gates whether a budget suffices, not
// which actions are needed), so one probe solve is enough to learn it.
const SOLVE_AP_CEILING = 40;

export function generateLevel(params: GeneratorParams): GeneratorResult {
  const coreOptions = params.mechanics.filter((m): m is CoreMechanic => m in GATE_TABLE);
  if (coreOptions.length === 0) {
    return {
      ok: false, attempts: 0,
      reason: 'no supported core mechanic in `mechanics` — need at least one of ' +
        'UNLOCK_RED, UNLOCK_BLUE, FIRE_IMMUNITY, PHASE_SHIFT, JUMP, PUSH',
    };
  }

  const abilityCount = computeAbilityCount(params.difficulty, coreOptions.length);
  const gridRadius = computeGridRadius(params.difficulty);

  // JUMP is excluded from multi-ability combos — found empirically, not by
  // inspection: once powered it lets a player leap over ANY single hex
  // exactly 2 rows away, including another gate's own hazard/phase_barrier
  // (the solver's jump branch never checks the intermediate hex — see the
  // file header). On this generator's shared/mirrored-per-dimension gate
  // template that means JUMP can bypass every other row-gate on the same
  // corridor, not just its own chasm — confirmed via a JUMP+UNLOCK_RED
  // candidate whose disabledAbility(RED) re-solve stayed solvable by
  // chaining three jumps straight past the RED gate. Hand-authored levels
  // avoid this by putting JUMP and the other ability on DIFFERENT
  // dimensions (level_24.json "Crossed Wires") — a genuinely different,
  // asymmetric-per-z template this pass doesn't build. JUMP alone (1-ability
  // mode) is unaffected and fully supported.
  const combinablePool = abilityCount > 1 ? coreOptions.filter(m => m !== 'JUMP') : coreOptions;
  const effectiveAbilityCount: 1 | 2 | 3 = combinablePool.length >= abilityCount ? abilityCount : 1;
  const pickPool = effectiveAbilityCount > 1 ? combinablePool : coreOptions;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rng = forkStream(params.seed, attempt);
    const cores = pickDistinct(rng, pickPool, effectiveAbilityCount);
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

    // Wider boards (gridRadius>3) have room for detours the original
    // radius=3 template's cramped boundary rows never permitted — confirm
    // every requested ability is genuinely necessary, not just that *a*
    // solution exists, the same disabledAbility re-solve
    // scripts/validateLevels.ts already uses for hand-authored levels.
    if (gridRadius > 3) {
      const allNecessary = cores.every(core => {
        const withoutAbility = solveLevel(final, undefined, { disabledAbility: GATE_TABLE[core].abilityType });
        return !withoutAbility.solvable;
      });
      if (!allNecessary) continue; // a gate was bypassable — fresh sub-seed next attempt
    }

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

/** Chains a 2nd/3rd required core ability once requested difficulty and the
 * caller's mechanics set both allow it — this is what let achieved
 * difficulty climb past v1's single-ability D≈6.2 plateau (Batch 1,
 * SPRINT_029) and v2's two-ability D≈7.8 ceiling (Batch 2, SPRINT_030).
 * 3-ability mode is gated to difficulty≥9, which is exactly where
 * computeGridRadius already returns 5, giving a 3rd gate row (see gateRows)
 * enough clearance from the other two. Falls back
 * gracefully when fewer core mechanics are eligible — fully backward
 * compatible with v1/v2 callers. 🔢 same disclosed-heuristic status as
 * computeMargin. */
function computeAbilityCount(difficulty: number, eligibleCoreCount: number): 1 | 2 | 3 {
  if (difficulty >= 9 && eligibleCoreCount >= 3) return 3;
  if (difficulty >= 5 && eligibleCoreCount >= 2) return 2;
  return 1;
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

// A fixed small "flank" of a gate's row (à la level_16.json's 5-wall funnel,
// or level_03.json's 2-wall chasm flank) only blocks a detour when the board
// is narrow enough that the flanked hexes ARE the entire row — true at
// gridRadius=3's cramped boundary rows (where every hand-authored gate-funnel
// level ships), false at larger radii: hex rows widen away from the poles,
// so a fixed-width flank leaves the rest of a wider row open to walk around
// through. Found empirically (a JUMP+UNLOCK_RED candidate at gridRadius=4
// deterministically failed the disabledAbility check on every attempt) —
// not a hypothetical.
//
// The robust fix, used for every gate kind uniformly: seal the gate's ENTIRE
// row except the q=0 corridor, computed directly from the hex-distance
// boundary rather than a fixed offset list. Since reaching the far side of
// that row from the near side requires crossing it at *some* q, and every
// q≠0 is now walled, the only crossing is through the gate hex itself — this
// holds for any gridRadius, not just 3, with no per-radius tuning needed.
function hexDistance(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

function sealRow(row: number, gridRadius: number, z: 0 | 1, idPrefix: string): EntityDef[] {
  const walls: EntityDef[] = [];
  for (let q = -gridRadius; q <= gridRadius; q++) {
    if (q === 0) continue; // the corridor — the gate hex itself lives here
    if (hexDistance(q, row) <= gridRadius) {
      walls.push({ type: 'wall', id: `${idPrefix}_seal_${z}_${q}`, q, r: row, z });
    }
  }
  return walls;
}

// Optional-extra anchors, relative to spawn, all at spawn's OWN row (offset
// r=0) — deliberately never a gate row (gates always sit at least 1 row away
// from spawn/exit), so they can never collide with a sealed row's walls.
const SHARED_UNLOCK_OFFSET: [number, number] = [-1, 0];
const FOCUS_VAULT_NODE_OFFSET: [number, number] = [1, 0];
const FOCUS_VAULT_PLATE_OFFSET: [number, number] = [2, 0];
const ECHO_TILE_OFFSET: [number, number] = [-2, 0];

/** N evenly-spaced gate rows between spawn and exit. 1 ability: exit-
 * adjacent only (v1's exact original shape, just as a full row-seal now
 * instead of a fixed 5-wall funnel). 2: spawn-adjacent + exit-adjacent
 * (v2's shape). 3: spawn-adjacent + center (r=0) + exit-adjacent. */
function gateRows(spawnR: number, exitR: number, n: 1 | 2 | 3): number[] {
  if (n === 1) return [exitR + 1];
  if (n === 2) return [spawnR - 1, exitR + 1];
  return [spawnR - 1, 0, exitR + 1];
}

function gateEntities(row: number, spec: GateSpec, gridRadius: number, z: 0 | 1, idPrefix: string): EntityDef[] {
  const centerEntity: EntityDef = spec.kind === 'hazard'
    ? { type: 'hazard', id: `${idPrefix}_hazard_${z}`, hazardType: spec.hazardType, q: 0, r: row, z }
    : spec.kind === 'phase'
    ? { type: 'phase_barrier', id: `${idPrefix}_phase_${z}`, q: 0, r: row, z }
    : spec.kind === 'jump'
    ? { type: 'hazard', id: `${idPrefix}_chasm_${z}`, hazardType: HazardType.CHASM, q: 0, r: row, z }
    : { type: 'pushable_block', id: `${idPrefix}_block_${z}`, q: 0, r: row, z };
  return [centerEntity, ...sealRow(row, gridRadius, z, idPrefix)];
}

function buildDraft(
  params: GeneratorParams, rng: PCG32, attempt: number, cores: CoreMechanic[], gridRadius: number,
  wantResonance: boolean, wantFocusVault: boolean, wantEchoTile: boolean,
): LevelDef | null {
  const spawn: Axial = { q: 0, r: gridRadius - 1 };
  const exit:  Axial = { q: 0, r: -(gridRadius - 1) };
  const rows = gateRows(spawn.r, exit.r, cores.length as 1 | 2 | 3);

  const entities: EntityDef[] = [
    { type: 'avatar', id: 'avatar_p1', playerId: 0, q: spawn.q, r: spawn.r, z: 0 },
    { type: 'avatar', id: 'avatar_p2', playerId: 1, q: spawn.q, r: spawn.r, z: 1 },
    { type: 'exit', id: 'exit_p1', playerId: 0, q: exit.q, r: exit.r, z: 0 },
    { type: 'exit', id: 'exit_p2', playerId: 1, q: exit.q, r: exit.r, z: 1, initiallyLocked: true },
  ];

  const matrixNodes: MatrixNodeDef[] = [];
  const conduits: MatrixConduitDef[] = [];
  const inventory: { player0: InventoryConduitDef[]; player1: InventoryConduitDef[] } = { player0: [], player1: [] };

  // Every gate row is sealed on BOTH dimensions — z:0 and z:1 each get their
  // own copy — which is what forces both avatars through it (level_16's
  // proven shape), since abilities are global once powered.
  cores.forEach((core, i) => {
    const spec = GATE_TABLE[core];
    const isExitAdjacent = i === cores.length - 1; // last row is always exit-adjacent (all n)

    // PUSH at the exit-adjacent row: pushing always happens toward exit (the
    // party's fixed travel direction), landing one row further than the
    // block itself. At the usual exit-adjacent row (exitR+1) that would push
    // the block exactly onto the exit hex — a Static pushable permanently
    // occupying it. One extra row of clearance (exitR+2) keeps the
    // destination short of the exit. No other row/mechanic combination needs
    // this (JUMP lands avatars, who aren't Static, directly on a hex is
    // harmless; spawn-adjacent pushes move away from spawn, never toward it;
    // the center row has clearance on both sides).
    // "Away from exit" is always +1 r (exit sits at the most negative valid
    // r on this corridor, spawn at the most positive) — not sign-dependent.
    const row = spec.kind === 'push' && isExitAdjacent ? rows[i] + 1 : rows[i];

    entities.push(...gateEntities(row, spec, gridRadius, 0, `gate${i}`), ...gateEntities(row, spec, gridRadius, 1, `gate${i}`));

    matrixNodes.push({ id: `node_c3r${i}`, column: 3, row: i, abilityType: spec.abilityType });
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

  // Defensive collision guard: rather than hand-proving every radius/
  // ability-count/optional-extra combination never overlaps, reject any
  // attempt where two entities land on the same (q,r,z) — cheap, and turns
  // a layout mistake into "try a different seed" instead of a broken or
  // silently-miswired level.
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
