# Generative Levels: Solver, Generator & Difficulty Model

This document specifies the procedural level pipeline. Design contract and player-facing rules live in `level_design.md §6`. Everything here is deterministic: **seed in → identical level out**, on every client, every time.

---

## 1. Pipeline Overview

```
        seed (uint64)
           │
           ▼
   ┌───────────────┐    candidate     ┌──────────────┐   proof:      ┌────────────────┐
   │   Generator   │ ───────────────► │    Solver    │ ────────────► │ Difficulty     │
   │ (reverse      │                  │ (A* over     │  optimalCost, │ Scorer         │
   │  design)      │ ◄─────────────── │  game states)│  solutionPath │                │
   └───────────────┘  reject/repair   └──────────────┘               └───────┬────────┘
                                                                             │ score in
                                                                             ▼ target band?
                                                                     accept → LevelDef JSON
```

The generator proposes, the solver proves, the scorer accepts. A level that cannot be proven solvable, or whose score misses the target difficulty band, is repaired or rejected. Because generation is offline-fast (worst case a few hundred milliseconds), rejection sampling is acceptable.

All three modules live in `src/generation/` and are **plain TypeScript, not ECS systems**. They operate on `LevelDef` data (the JSON schema) and a lightweight abstract game state — never on the live bitECS world.

---

## 2. The Solver

### 2.1 State Space

A search node is the tuple:

```typescript
interface SolverState {
  p1: { q: number; r: number } | 'EXITED';
  p2: { q: number; r: number };
  matrix: Uint8Array;          // packed: (shape, rotation, base) per conduit cell
  inventories: Uint8Array;     // packed multiset per player
  scrapPool: Uint8Array;       // packed multiset (order irrelevant — draws are blind)
  ap: number;
  unlocksTriggered: number;    // bitmask
  resonanceArmed: number;      // bitmask of armed pair slots
  thresholdCrossed: boolean;
}
```

Actions are exactly the player actions from `mechanics.md §2` (move, insert, rotate, draw, unlock trigger, threshold, exit) with their AP costs. Blind draws are handled adversarially: a state transition on `DRAW_SCRAP` branches over all distinct shapes remaining in the pool, and the solver requires solvability under the **worst-case draw order** — this is what makes "provably solvable" honest despite hidden information.

### 2.2 Algorithm: A* with an Admissible Heuristic

The solver is **A\*** over `SolverState`, minimizing total AP spent. The heuristic is the maximum of per-player relaxed costs:

```
h(s) = max( hexDistance(p1, exit1),  hexDistance(p2, exit2) )
     + matrixLowerBound(s)
```

* `hexDistance` is the axial hex distance ignoring walls and hazards — a strict relaxation, therefore admissible.
* `matrixLowerBound(s)` is the minimum number of matrix mutations (× their AP cost) required to power every ability that is *provably necessary* (an ability is necessary if every relaxed path for a player crosses a hazard only that ability neutralizes). Computing it is a small BFS on the matrix graph — the same `MatrixGraph` BFS the game already uses for routing, reused unchanged.

Both terms never overestimate, so A* returns the true `optimalCost`. For deep states (endless mode, large grids) the solver switches to **IDA\*** to bound memory; the heuristic is shared.

### 2.3 State Deduplication: Zobrist Hashing

Visited-state detection uses **Zobrist hashing**: every (cell, value) combination gets a fixed random 64-bit key at module load; a state's hash is the XOR of its active keys. A state transition updates the hash **incrementally** (XOR out the old cell value, XOR in the new) in O(1) instead of rehashing the full state. The existing djb2 `StateHasher` remains for network desync detection only — the solver's Zobrist table is seeded independently and identically on both clients.

### 2.4 What the Solver Exports

```typescript
interface SolverProof {
  solvable: true;
  optimalCost: number;          // minimal AP expenditure (worst-case draws)
  solutionPath: SolverAction[]; // one witness solution
  coordinationSteps: number;    // actions requiring both players (unlocks, threshold)
  deadEndDistance: number;      // min APs a pair can waste before the level becomes unsolvable
}
```

`deadEndDistance` is computed by re-running the solver from perturbed states and is the key fairness metric: levels where a single early mistake locks the level (`deadEndDistance ≤ 1`) are rejected below difficulty tier "brutal".

### 2.5 Runtime Reuse: Dead End Detection

The in-game Dead End check (`digital_implementation.md §7`) reuses the solver's reachability core in a bounded mode: `canEitherAvatarReachExit` is a plain A* reachability query on the current live state, budgeted at `ap` remaining. One algorithm, three consumers — generation proof, build-time campaign validation, runtime Dead End detection.

---

## 3. The Generator (Reverse Design, Automated)

The generator automates the human pipeline from `level_design.md §3` — it designs backward from the solution:

1. **Sample the ability requirement graph.** From the difficulty target, draw which abilities the level demands per player and in what dependency order (e.g., P2 needs UNLOCK_RED before P1 can reach the Shared Unlock that funds P1's PHASE_SHIFT route).
2. **Construct the matrix goal states.** For each required ability, compute a conduit configuration that powers it, and a legal insert/rotate sequence reaching that configuration from the initial matrix. Plates used by this sequence become the level's distributed conduit inventory.
3. **Lay the hex paths.** Walk the intended solution path per dimension; place hazards *on* the path exactly where the required ability neutralizes them; place collectible plates and unlock nodes at the coordination waypoints the requirement graph dictates.
4. **Add the noise.** Decoy hazards, inefficient alternate routes, and red-herring locks — then re-run the solver to confirm the decoys did not accidentally create a cheaper solution (if a decoy path beats `optimalCost`, the decoy is hardened or removed).
5. **Assign bases.** Distribute neurotransmitter bases (`mechanics.md §4.5`) over the plates so that the number of achievable Discharge pairs matches the AP budget the difficulty tier allows.
6. **Set `initialAP = optimalCost + margin(difficulty)`** and emit the `LevelDef`.

Terrain decoration (which floor variant, vein/circuit texture placement) is painted by a small **Wave Function Collapse** pass — purely cosmetic, seeded from the same RNG, zero mechanical impact.

### 3.1 Determinism & RNG

All randomness flows from a single **PCG32** stream seeded by the level seed. The generator, base assignment, WFC decoration, and the Scrap Pool's blind-draw shuffle all draw from forked sub-streams (`seed_child = pcg(seed, streamId)`) so that adding a new consumer never perturbs existing ones. The Host sends only the seed in the handshake; both clients generate bit-identical levels.

---

## 4. The Difficulty Model

Difficulty is a weighted score over solver outputs:

```
D(level) = w₁·len(solutionPath)
         + w₂·coordinationSteps
         + w₃·(1 − apSlack / initialAP)
         + w₄·hiddenInfoLoad          // plates that must transit the blind Scrap Pool
         + w₅·resonanceDepth          // pairs the solution must deliberately form/break
```

* The **target curve** for endless mode is `D_target(n) = D₁₅ + k·log₂(1 + n − 15)` — perceptibly rising but flattening, so late levels grow via *depth* (coordination, resonance) rather than raw size.
* `margin(difficulty)` (the AP slack granted over optimal) decreases stepwise along the same curve — see the tight-budget definition in `level_design.md §6.3`.
* The weight vector `w` and `k` are the primary balancing knobs. **🔢 Chris owns their calibration**; the solver gives him exact, reproducible numbers per level to regress against playtest outcomes.

---

## 5. File & Module Layout

```
src/generation/
├── LevelGenerator.ts    # §3 pipeline; emits LevelDef
├── LevelSolver.ts       # §2 A*/IDA*; SolverProof; reachability core
├── DifficultyModel.ts   # §4 scoring + target curve
├── ZobristTable.ts      # fixed-seed 64-bit key table
├── Pcg32.ts             # deterministic RNG with forkable streams
└── wfc/                 # cosmetic terrain decoration
```

Build-time validation (`npm run validate:levels`) runs `LevelSolver` against all hand-crafted campaign JSONs and fails the build if any level lacks a proof or its stored `optimalCost` drifts.

---

## 6. Rollout Order

1. **Solver first** (Sprint 14): it immediately pays for itself — campaign validation + runtime Dead End detection.
2. **Difficulty scorer** (Sprint 14): scores the existing 15 levels; calibration data for Chris.
3. **Generator** (Sprint 15): endless mode + Daily Synapse, gated on the scorer being calibrated.
