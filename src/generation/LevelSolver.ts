// LevelSolver: proves solvability of a level and computes the minimal AP cost
// (generative_levels.md §2). Pure TypeScript over LevelDef data — no bitECS,
// no DOM — so it runs in Node (validate:levels), at generation time, and in
// future in a worker at runtime.
//
// Semantics mirror the shipped systems exactly:
//   - Movement/passability: MovementSystem (incl. the jump-replaces-step rule).
//   - Matrix routing: MatrixRoutingSystem / MatrixGraph (East-only flow,
//     N/S flood inside conduit columns, ability nodes as pass-throughs).
//   - Abilities are GLOBAL (AbilitySystem) — both avatars share them.
//   - Shared Unlocks: APUnlockSystem (pair occupancy, one-time, +value AP).
//   - Column slide + ejection: MatrixInsertSystem. Rotate: 90° CW per 1 AP.
//   - Blind draws are adversarial: a DRAW action must succeed for EVERY
//     shape the pool might yield (AND-node). "Provably solvable" therefore
//     means: solvable under worst-case draw order.
//
// Search: iterative-deepening depth-first AND/OR search over total AP cost,
// with an admissible heuristic (hex distance with jump relaxation) and a
// failure cache. States are keyed by exact serialization — a proof tool must
// not risk hash collisions; Zobrist hashing is reserved for generator-scale
// search where approximate visited-sets are acceptable.
//
// Deliberate simplifications (documented in SPRINTS/SPRINT_007):
//   - Inventories of both players are merged into one multiset: either player
//     may insert and AP is shared, so ownership has no mechanical effect.
//   - Pre-insert orientation is free (0 AP) → inventory tracks shapes only.
//   - Push and Threshold are not modeled (no pushables in any level JSON;
//     the board-flip effect is still a stub in the engine).

import type { LevelDef } from '@/levels/LevelSchema';
import { computeFaceMask, facesConnect } from '@/utils/ConduitFaceMask';
import { HEX_DIRECTIONS } from '@/rendering/HexMath';
import { AbilityType, HazardType, ConduitShape } from '@/types';
import { MATRIX_ROWS } from '@/constants';

// ── Static level data (precomputed once per solve) ───────────────────────────

interface HexInfo {
  wall:         boolean;
  lockedRed:    boolean;
  lockedBlue:   boolean;
  phaseBarrier: boolean;
  fire:         boolean;
  alwaysLethal: boolean;   // CHASM, LASER — no counter-ability exists
}

interface StaticLevel {
  hexes:        Map<string, HexInfo>;         // "z:q,r" → info
  exits:        [{ q: number; r: number }, { q: number; r: number }];
  collectibles: { q: number; r: number; z: number; shape: number }[];
  unlocks:      { value: number; a: { q: number; r: number }; b: { q: number; r: number } }[];
  abilityCells: { col: 2 | 4; row: number; abilityType: number }[]; // 0-indexed cols 2/4 = matrix cols 3/5
  budget:       number;                        // initialAP + Σ unlock values
  gridRadius:   number;                        // board boundary (MovementSystem mirror)
}

// ── Mutable search state ─────────────────────────────────────────────────────

type Cell = { shape: number; rotation: number } | null;

interface SState {
  p1: { q: number; r: number } | null; // null = exited
  p2: { q: number; r: number };
  matrix: Cell[][];      // [2][MATRIX_ROWS] — conduit columns (matrix cols 2 & 4)
  inventory: number[];   // count per ConduitShape (merged across players)
  scrap: number[];       // count per ConduitShape (multiset; draws are blind)
  collectedMask: number;
  unlockMask: number;
}

export interface SolverAction {
  kind: 'MOVE' | 'INSERT' | 'ROTATE' | 'DRAW';
  detail: string;
}

export type SolverResult =
  | {
      solvable: true;
      optimalCost: number;
      solutionPath: SolverAction[];   // one witness (worst-case draw branch)
      coordinationSteps: number;      // unlock pairs the witness triggers
      drawSteps: number;              // blind draws the witness relies on
      nodesExpanded: number;
    }
  | { solvable: false; reason: 'exhausted' | 'node-limit'; nodesExpanded: number };

// ── Helpers ──────────────────────────────────────────────────────────────────

const hexKey = (z: number, q: number, r: number): string => `${z}:${q},${r}`;

function hexDistance(aq: number, ar: number, bq: number, br: number): number {
  const dq = aq - bq, dr = ar - br;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// Effective distinct rotations per shape (STRAIGHT repeats after 2, CROSS after 1).
function effectiveRotations(shape: number): number {
  if (shape === ConduitShape.STRAIGHT) return 2;
  if (shape === ConduitShape.CROSS)    return 1;
  return 4;
}

// ── Matrix routing (pure mirror of MatrixRoutingSystem) ──────────────────────

function poweredAbilities(level: StaticLevel, matrix: Cell[][]): Set<number> {
  // powered[colIdx][row]: colIdx 0 = conduit col A (matrix col 2),
  // 1 = tier-1 abilities (col 3), 2 = conduit col B (col 4), 3 = tier-2 (col 5).
  const powered: boolean[][] = Array.from({ length: 4 }, () =>
    new Array(MATRIX_ROWS).fill(false));

  const mask = (c: Cell): number =>
    c ? computeFaceMask(c.shape as ConduitShape, c.rotation) : 0;
  const receivesWest = (c: Cell): boolean => c !== null && ((mask(c) >> 2) & 1) === 1;
  const emitsEast    = (c: Cell): boolean => c !== null && ((mask(c) >> 0) & 1) === 1;

  const flood = (colIdx: number, cells: Cell[]): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let row = 0; row < MATRIX_ROWS; row++) {
        if (!powered[colIdx][row]) continue;
        if (row + 1 < MATRIX_ROWS && !powered[colIdx][row + 1] &&
            cells[row] && cells[row + 1] &&
            facesConnect(mask(cells[row]), mask(cells[row + 1]), 1)) {
          powered[colIdx][row + 1] = true; changed = true;
        }
        if (row - 1 >= 0 && !powered[colIdx][row - 1] &&
            cells[row - 1] && cells[row] &&
            facesConnect(mask(cells[row - 1]), mask(cells[row]), 1)) {
          powered[colIdx][row - 1] = true; changed = true;
        }
      }
    }
  };

  // Sources (all rows) → conduit column A where West face open.
  for (let row = 0; row < MATRIX_ROWS; row++) {
    if (receivesWest(matrix[0][row])) powered[0][row] = true;
  }
  flood(0, matrix[0]);
  // Conduit A → tier-1 abilities (East face open). Empty ability cells also
  // carry power (MatrixRoutingSystem powers Empty cells as pass-throughs).
  for (let row = 0; row < MATRIX_ROWS; row++) {
    if (powered[0][row] && emitsEast(matrix[0][row])) powered[1][row] = true;
  }
  // Powered tier-1 cells → conduit column B where West face open.
  for (let row = 0; row < MATRIX_ROWS; row++) {
    if (powered[1][row] && receivesWest(matrix[1][row])) powered[2][row] = true;
  }
  flood(2, matrix[1]);
  for (let row = 0; row < MATRIX_ROWS; row++) {
    if (powered[2][row] && emitsEast(matrix[1][row])) powered[3][row] = true;
  }

  const active = new Set<number>();
  for (const node of level.abilityCells) {
    const colIdx = node.col === 2 ? 1 : 3;
    if (powered[colIdx][node.row] && node.abilityType !== AbilityType.NONE) {
      active.add(node.abilityType);
    }
  }
  return active;
}

// ── Passability under a given ability set ────────────────────────────────────

function isBlocked(
  level: StaticLevel, abilities: Set<number>, state: SState,
  z: number, q: number, r: number, forLanding: boolean,
): boolean {
  if (hexDistance(0, 0, q, r) > level.gridRadius) return true; // board edge
  const info = level.hexes.get(hexKey(z, q, r));
  // P2's exit is Static until P1 has exited (sequential exit rule).
  if (z === 1 && q === level.exits[1].q && r === level.exits[1].r && state.p1 !== null) {
    return true;
  }
  if (!info) return false;
  if (info.wall) return true;
  if (info.lockedRed  && !abilities.has(AbilityType.UNLOCK_RED))  return true;
  if (info.lockedBlue && !abilities.has(AbilityType.UNLOCK_BLUE)) return true;
  if (info.phaseBarrier && !abilities.has(AbilityType.PHASE_SHIFT)) return true;
  if (forLanding) {
    if (info.alwaysLethal) return true;
    if (info.fire && !abilities.has(AbilityType.FIRE_IMMUNITY)) return true;
  }
  return false;
}

// ── State serialization (exact, collision-free memo keys) ────────────────────

function stateKey(s: SState): string {
  const m = s.matrix.map(col =>
    col.map(c => (c ? `${c.shape}${c.rotation}` : '.')).join('')).join('|');
  return [
    s.p1 ? `${s.p1.q},${s.p1.r}` : 'X',
    `${s.p2.q},${s.p2.r}`,
    m,
    s.inventory.join(''),
    s.scrap.join(''),
    s.collectedMask,
    s.unlockMask,
  ].join(';');
}

function cloneState(s: SState): SState {
  return {
    p1: s.p1 ? { ...s.p1 } : null,
    p2: { ...s.p2 },
    matrix: s.matrix.map(col => col.map(c => (c ? { ...c } : null))),
    inventory: [...s.inventory],
    scrap: [...s.scrap],
    collectedMask: s.collectedMask,
    unlockMask: s.unlockMask,
  };
}

// ── The solver ───────────────────────────────────────────────────────────────

export interface SolveOptions {
  /** Disable INSERT/ROTATE/DRAW — proves whether the matrix is *required*. */
  noMatrix?: boolean;
}

export function solveLevel(
  def: LevelDef, nodeLimit = 2_000_000, opts: SolveOptions = {},
): SolverResult {
  const level = buildStaticLevel(def);
  const start = buildStartState(def);

  let nodesExpanded = 0;
  let currentLimit  = 0;
  // Failure cache: stateKey → highest remaining budget for which the state was
  // proven unsolvable. Monotone across deepening iterations: reaching the same
  // state with the same remaining budget at a higher limit implies more AP
  // already spent, i.e. less available — strictly harder, so failures persist.
  const failCache = new Map<string, number>();

  const unlockCredit = (unlockMask: number): number => {
    let credit = 0;
    for (let i = 0; i < level.unlocks.length; i++) {
      if (unlockMask & (1 << i)) credit += level.unlocks[i].value;
    }
    return credit;
  };

  // Admissible heuristic: both avatars must reach their exits; one move covers
  // ≤ 2 hexes (jump). AP gains (unlocks) can only help, so ignoring them keeps
  // the bound admissible.
  const h = (s: SState): number => {
    const d1 = s.p1 ? hexDistance(s.p1.q, s.p1.r, level.exits[0].q, level.exits[0].r) : 0;
    const d2 = hexDistance(s.p2.q, s.p2.r, level.exits[1].q, level.exits[1].r);
    return Math.ceil(d1 / 2) + Math.ceil(d2 / 2);
  };

  // Depth-first proof: can `s` be won spending ≤ budget more AP?
  // Returns the witness path or null. Draw = AND node (all outcomes must hold).
  function dfs(s: SState, budget: number, path: SolverAction[]): SolverAction[] | null {
    if (s.p1 === null &&
        s.p2.q === level.exits[1].q && s.p2.r === level.exits[1].r) {
      return path;
    }
    if (h(s) > budget) return null;
    const key = stateKey(s);
    const knownFail = failCache.get(key);
    if (knownFail !== undefined && knownFail >= budget) return null;
    if (++nodesExpanded > nodeLimit) throw new Error('node-limit');

    // Live AP constraint: the pool never goes negative mid-run. Spending so
    // far is (currentLimit − budget); unlock grants credit the pool the moment
    // the pair triggers — exactly APUnlockSystem's behavior.
    const apAvail = def.initialAP + unlockCredit(s.unlockMask) - (currentLimit - budget);
    if (apAvail <= 0) {
      if (knownFail === undefined || budget > knownFail) failCache.set(key, budget);
      return null;
    }

    const abilities = poweredAbilities(level, s.matrix);

    // ── MOVE actions (cost 1) ────────────────────────────────────────────
    // SPRINT_010 semantics: the 1-hex step always exists when its target is
    // passable; with JUMP routed, the 2-hex jump is an *additional* option
    // whose intermediate hex is bypassed entirely (mechanics.md §5.1).
    for (const who of [0, 1] as const) {
      const pos = who === 0 ? s.p1 : s.p2;
      if (pos === null) continue;
      const z = who;
      for (const [dq, dr] of HEX_DIRECTIONS) {
        const targets: { tq: number; tr: number; jumped: boolean }[] = [];
        const t1q = pos.q + dq, t1r = pos.r + dr;
        if (!isBlocked(level, abilities, s, z, t1q, t1r, true)) {
          targets.push({ tq: t1q, tr: t1r, jumped: false });
        }
        if (abilities.has(AbilityType.JUMP)) {
          const t2q = pos.q + 2 * dq, t2r = pos.r + 2 * dr;
          if (!isBlocked(level, abilities, s, z, t2q, t2r, true)) {
            targets.push({ tq: t2q, tr: t2r, jumped: true });
          }
        }
        for (const { tq, tr, jumped } of targets) {
          const next = cloneState(s);
          applyArrival(level, next, who, tq, tr);
          const witness = dfs(next, budget - 1, [
            ...path, { kind: 'MOVE', detail: `P${who + 1}→(${tq},${tr})${jumped ? ' jump' : ''}` },
          ]);
          if (witness) return witness;
        }
      }
    }

    if (opts.noMatrix) {
      // Matrix actions disabled — used to prove the matrix is required.
      if (knownFail === undefined || budget > knownFail) failCache.set(key, budget);
      return null;
    }

    // ── INSERT actions (cost 2) ──────────────────────────────────────────
    if (budget >= 2 && apAvail >= 2) {
      for (let shape = 0; shape < s.inventory.length; shape++) {
        if (s.inventory[shape] === 0) continue;
        for (const colIdx of [0, 1] as const) {
          for (const fromTop of [true, false]) {
            for (let rot = 0; rot < effectiveRotations(shape); rot++) {
              const next = cloneState(s);
              next.inventory[shape]--;
              applyColumnSlide(next, colIdx, fromTop, { shape, rotation: rot });
              const witness = dfs(next, budget - 2, [
                ...path,
                { kind: 'INSERT', detail: `${ConduitShape[shape]} r${rot} col${colIdx === 0 ? 2 : 4} ${fromTop ? 'top' : 'bottom'}` },
              ]);
              if (witness) return witness;
            }
          }
        }
      }
    }

    // ── ROTATE actions (cost 1, 90° CW per action) ───────────────────────
    for (const colIdx of [0, 1] as const) {
      for (let row = 0; row < MATRIX_ROWS; row++) {
        const cell = s.matrix[colIdx][row];
        if (!cell || effectiveRotations(cell.shape) === 1) continue;
        const next = cloneState(s);
        const c = next.matrix[colIdx][row]!;
        c.rotation = (c.rotation + 1) % 4;
        const witness = dfs(next, budget - 1, [
          ...path, { kind: 'ROTATE', detail: `col${colIdx === 0 ? 2 : 4} row${row}` },
        ]);
        if (witness) return witness;
      }
    }

    // ── DRAW action (cost 1; adversarial AND over all possible shapes) ───
    const scrapTotal = s.scrap.reduce((a, b) => a + b, 0);
    if (scrapTotal > 0 && budget >= 1) {
      let allBranchesHold = true;
      let worstWitness: SolverAction[] | null = null;
      for (let shape = 0; shape < s.scrap.length; shape++) {
        if (s.scrap[shape] === 0) continue;
        const next = cloneState(s);
        next.scrap[shape]--;
        next.inventory[shape]++;
        const witness = dfs(next, budget - 1, [
          ...path, { kind: 'DRAW', detail: `worst-case ${ConduitShape[shape]}` },
        ]);
        if (!witness) { allBranchesHold = false; break; }
        if (!worstWitness || witness.length > worstWitness.length) worstWitness = witness;
      }
      if (allBranchesHold && worstWitness) return worstWitness;
    }

    // Record failure at this budget.
    if (knownFail === undefined || budget > knownFail) failCache.set(key, budget);
    return null;
  }

  // Iterative deepening over total cost — first success is the optimum.
  const lower = h(start);
  try {
    for (let limit = lower; limit <= level.budget; limit++) {
      currentLimit = limit;
      const witness = dfs(start, limit, []);
      if (witness) {
        const coordinationSteps = countUnlocks(level, witness, def);
        const drawSteps = witness.filter(a => a.kind === 'DRAW').length;
        return {
          solvable: true,
          optimalCost: limit,
          solutionPath: witness,
          coordinationSteps,
          drawSteps,
          nodesExpanded,
        };
      }
    }
  } catch (e) {
    if ((e as Error).message === 'node-limit') {
      return { solvable: false, reason: 'node-limit', nodesExpanded };
    }
    throw e;
  }
  return { solvable: false, reason: 'exhausted', nodesExpanded };
}

// ── State construction & mutation ────────────────────────────────────────────

function buildStaticLevel(def: LevelDef): StaticLevel {
  const hexes = new Map<string, HexInfo>();
  const info = (z: number, q: number, r: number): HexInfo => {
    const key = hexKey(z, q, r);
    let i = hexes.get(key);
    if (!i) {
      i = { wall: false, lockedRed: false, lockedBlue: false,
            phaseBarrier: false, fire: false, alwaysLethal: false };
      hexes.set(key, i);
    }
    return i;
  };

  const exits: StaticLevel['exits'] = [{ q: 0, r: 0 }, { q: 0, r: 0 }];
  const collectibles: StaticLevel['collectibles'] = [];

  for (const e of def.entities) {
    switch (e.type) {
      case 'wall':          info(e.z, e.q, e.r).wall = true; break;
      case 'phase_barrier': info(e.z, e.q, e.r).phaseBarrier = true; break;
      case 'hazard': {
        const i = info(e.z, e.q, e.r);
        if (e.hazardType === HazardType.LOCKED_RED)  i.lockedRed  = true;
        else if (e.hazardType === HazardType.LOCKED_BLUE) i.lockedBlue = true;
        else if (e.hazardType === HazardType.FIRE)   i.fire = true;
        else i.alwaysLethal = true; // CHASM, LASER
        break;
      }
      case 'exit':        exits[e.playerId] = { q: e.q, r: e.r }; break;
      case 'collectible': collectibles.push({ q: e.q, r: e.r, z: e.z, shape: e.shape }); break;
      default: break; // avatar (start state), threshold (not modeled)
    }
  }

  const unlocks = def.apUnlockNodes.map(u => ({
    value: u.value, a: { ...u.hexA }, b: { ...u.hexB },
  }));

  const abilityCells: StaticLevel['abilityCells'] = def.matrix.nodes
    .filter(n => n.column === 3 || n.column === 5)
    .map(n => ({ col: (n.column === 3 ? 2 : 4) as 2 | 4, row: n.row, abilityType: n.abilityType }));

  const budget = def.initialAP + unlocks.reduce((a, u) => a + u.value, 0);
  const gridRadius = def.gridRadius ?? 3;
  return { hexes, exits, collectibles, unlocks, abilityCells, budget, gridRadius };
}

function buildStartState(def: LevelDef): SState {
  const p = [{ q: 0, r: 0 }, { q: 0, r: 0 }];
  for (const e of def.entities) {
    if (e.type === 'avatar') p[e.playerId] = { q: e.q, r: e.r };
  }
  const matrix: Cell[][] = [
    new Array(MATRIX_ROWS).fill(null),
    new Array(MATRIX_ROWS).fill(null),
  ];
  for (const c of def.matrix.conduits) {
    matrix[c.column === 2 ? 0 : 1][c.row] = { shape: c.shape, rotation: c.rotation };
  }
  const inventory = new Array(5).fill(0);
  for (const c of def.initialInventory.player0) inventory[c.shape]++;
  for (const c of def.initialInventory.player1) inventory[c.shape]++;
  const scrap = new Array(5).fill(0);
  for (const s of def.scrapPool) scrap[s.shape]++;

  return { p1: p[0], p2: { ...p[1] }, matrix, inventory, scrap, collectedMask: 0, unlockMask: 0 };
}

// Applies collection, unlock triggers, and P1's exit when an avatar arrives.
function applyArrival(
  level: StaticLevel, s: SState, who: 0 | 1, q: number, r: number,
): void {
  if (who === 0) s.p1 = { q, r }; else s.p2 = { q, r };

  // Collect (free, automatic).
  for (let i = 0; i < level.collectibles.length; i++) {
    if (s.collectedMask & (1 << i)) continue;
    const c = level.collectibles[i];
    if (c.z === who && c.q === q && c.r === r) {
      s.collectedMask |= 1 << i;
      s.inventory[c.shape]++;
    }
  }

  // Shared Unlock pairs. Triggering is free and automatic on pair occupancy;
  // the AP credit is applied in dfs via unlockCredit(unlockMask), so the live
  // pool constraint (never spend below zero before a grant) is enforced
  // exactly as APUnlockSystem behaves in the game.
  for (let i = 0; i < level.unlocks.length; i++) {
    if (s.unlockMask & (1 << i)) continue;
    const u = level.unlocks[i];
    const p1On = s.p1 !== null && s.p1.q === u.a.q && s.p1.r === u.a.r;
    const p2On = s.p2.q === u.b.q && s.p2.r === u.b.r;
    if (p1On && p2On) s.unlockMask |= 1 << i;
  }

  // P1 exits on arrival at their Nexus Hex.
  if (who === 0 && s.p1 && s.p1.q === level.exits[0].q && s.p1.r === level.exits[0].r) {
    s.p1 = null;
  }
}

function applyColumnSlide(
  s: SState, colIdx: 0 | 1, fromTop: boolean, plate: { shape: number; rotation: number },
): void {
  const col = s.matrix[colIdx];
  if (fromTop) {
    const ejected = col[MATRIX_ROWS - 1];
    if (ejected) s.scrap[ejected.shape]++;
    for (let row = MATRIX_ROWS - 1; row > 0; row--) col[row] = col[row - 1];
    col[0] = plate;
  } else {
    const ejected = col[0];
    if (ejected) s.scrap[ejected.shape]++;
    for (let row = 0; row < MATRIX_ROWS - 1; row++) col[row] = col[row + 1];
    col[MATRIX_ROWS - 1] = plate;
  }
}

// Re-simulates the witness to count triggered unlock pairs.
function countUnlocks(level: StaticLevel, witness: SolverAction[], def: LevelDef): number {
  const s = buildStartState(def);
  for (const a of witness) {
    if (a.kind !== 'MOVE') continue;
    const m = /^P([12])→\((-?\d+),(-?\d+)\)/.exec(a.detail);
    if (m) applyArrival(level, s, (Number(m[1]) - 1) as 0 | 1, Number(m[2]), Number(m[3]));
  }
  let n = 0;
  for (let i = 0; i < level.unlocks.length; i++) if (s.unlockMask & (1 << i)) n++;
  return n;
}
