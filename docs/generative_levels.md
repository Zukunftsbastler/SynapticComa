# Generative Levels: Solver, Generator & Difficulty Model

> **Status (SPRINT_030, 2026-07-24):** the Generator now chains **up to two** simultaneous required core abilities and scales `gridRadius` (3→5) with requested difficulty — v1's single-ability template plateaued around D≈6.2 (confirmed empirically generating Batch 1, levels 30–39); v2 climbs past D≈7.8 by reusing the exact two-gate shape `level_16.json` "Airlock" already ships, mirrored across both dimensions and anchored relative to the (now variable) spawn/exit hexes instead of fixed absolute coordinates. A defensive collision check rejects any attempt where two entities would land on the same hex, rather than hand-proving every radius/ability-count/optional-extra combination never overlaps. Still capped at 2 abilities (not arbitrary N) and `gridRadius≤5` — both disclosed, tunable ceilings, not hard architectural limits. Full detail: `SPRINTS/SPRINT_030-...md`.
>
> **Status (SPRINT_029, 2026-07-23):** the Solver (§2) and Difficulty Scorer (§4) remain fully built and load-bearing. **The Generator (§3) is now built too, in a scoped-down v1** — `src/generation/LevelGenerator.ts` + `src/generation/Random.ts` (a real PCG32, per §3.1) + a CLI (`scripts/generateLevel.ts`, `npm run generate:level -- --difficulty=N --mechanics=... --seed=N`). Every candidate clears three gates before being accepted: the solver (`solveLevel`, in-process), the headless witness replay (`WitnessReplay.ts`, unchanged), and — newly added this same sprint, closing a real gap Till flagged unprompted — a **real-browser Playwright check** (`playwright.config.ts`, `e2e/`) that replays the witness via actual clicks/keys against a real rendered page. Neither prior gate touched the DOM at all; both said so in their own sprint docs. Disclosed scope cuts, not silent: (1) v1 reuses the proven single-hazard "gate-wall funnel" template (levels 2/3/8/20/23/25/26/27/28/29) rather than the full spec's arbitrary multi-ability hex topology — **one required core ability per generated level**, picked from UNLOCK_RED/UNLOCK_BLUE/FIRE_IMMUNITY; (2) JUMP/PUSH/PHASE_SHIFT are fully solver-modeled but need fundamentally different terrain (a missing-tile gap, a pushable block, a phase barrier — not a swapped hazard type) and aren't wired into the Generator's hex-layout step yet — requesting them alone fails cleanly rather than emitting something broken; (3) RESONANCE/FOCUS_VAULT/ECHO_TILE all layer on top of any core mechanic and are fully supported (Resonance always uses the safe, never-load-bearing Discharge pattern levels 26-29 established); (4) at the very tightest requested difficulty (margin=1, the floor) combined with RESONANCE, the retry loop's limited per-attempt variation may occasionally exhaust its budget rather than find a fit — a real, disclosed edge case, not a silent wrong answer. No live "Daily Synapse"/endless-mode delivery mechanism exists — this is the offline generate-and-verify pipeline only (this is a P2P-only client with no backend server, so a live daily challenge is a separate, later decision). Full detail: `SPRINTS/SPRINT_029-...md`.

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

The Solver and Difficulty Scorer live in `src/generation/` and are **plain TypeScript, not ECS systems**; they operate on `LevelDef` data (the JSON schema) and a lightweight abstract game state — never on the live bitECS world. The Generator is unbuilt (see status note above) — this diagram describes the intended pipeline, not the current one.

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
  minSwitches: number;          // interaction intensity — see below
  deadEndDistance: number;      // min APs a pair can waste before the level becomes unsolvable
}
```

`deadEndDistance` is computed by re-running the solver from perturbed states and is the key fairness metric: levels where a single early mistake locks the level (`deadEndDistance ≤ 1`) are rejected below difficulty tier "brutal".

**`minSwitches` — interaction intensity.** The minimal number of control hand-offs between the two players across *any* solution (matrix actions are player-agnostic; only avatar moves have a fixed actor). This is the level's measured demand for communication — the game's actual goal. Design reading: values may and should *grow* over the campaign; a level with `minSwitches = 0` would be single-player-solvable and is rejected by the build gate. Presentation rule: the value is shown to players as a **static property of the level** (like difficulty) — never as a par value, score, or live counter of their own hand-offs. Minimizing interaction is explicitly *not* a player goal; the metric exists so designers can steer it upward, not so players can optimize it downward.

Build-time campaign validation (`npm run validate:levels`) exports these proof metrics per level to `src/levels/levelMeta.json` (generated file — never hand-edited), which the UI reads for the interaction-intensity display. Four contracts are enforced as build gates:

1. **Fairness:** `apSlack ≥ 1` — slack 0 turns any wasted AP into a Dead End.
2. **Interaction:** `minSwitches ≥ 1` — a level one player could clear alone is a design error.
3. **UI reachability:** proofs may only use actions the input/UI layer can actually produce (static producer scan over `src/input` + `src/ui`). A level failing only under this restriction is a *code* bug (`UI-REACHABILITY`), not a level bug.
4. **Witness replay:** the solver's witness is replayed headless through the real system pipeline (`generation/WitnessReplay.ts` over `systems/pipeline.ts`) — every action must be accepted at its exact AP cost and the run must end in `LEVEL_COMPLETE`. This pins the solver's rule model to the shipped systems; any semantic divergence fails the build with the offending action named.

**Standing rule:** a new mechanic enters the solver only together with (a) its capability-map entry (`KIND_TO_MESSAGE` in `scripts/validateLevels.ts`), (b) its UI producer, and (c) its replay synthesis in `WitnessReplay.ts`. The gates then enforce the triple forever — this is what makes generated levels that stack many mechanics safe to ship.

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

### 3.0 As Shipped (SPRINT_029, extended SPRINT_030) vs. This Spec

`LevelGenerator.ts` implements steps 1-2-6 essentially as specced, and a **scoped-down** version of 3-4-5:

- **Step 1 (requirement graph):** narrowed to **up to two** required core abilities per generated level (`computeAbilityCount`, SPRINT_030 — v1 shipped with exactly one; still not an arbitrary multi-ability dependency chain), drawn from whichever of `UNLOCK_RED`/`UNLOCK_BLUE`/`FIRE_IMMUNITY` the caller allows. `JUMP`/`PUSH`/`PHASE_SHIFT` are accepted by the parameter type (so the interface matches the full spec) but not yet wired into hex-layout — see below.
- **Step 3 (hex paths):** rather than walking arbitrary terrain, the generator reuses two exact, already-proven templates. One required ability: the single-hazard "gate-wall funnel" shared by levels 2/3/8/20/23/25/26/27/28/29. Two required abilities (SPRINT_030): the two-gate shape `level_16.json` "Airlock" ships — one ring near spawn, one near exit, each mirrored across both dimensions, anchored relative to the (now difficulty-scaled, `computeGridRadius`) spawn/exit hexes rather than fixed absolute coordinates. A defensive collision check (`buildDraft`) rejects any attempt where two entities land on the same hex rather than hand-proving every radius/ability-count/optional-extra combination never overlaps by inspection. This is the real reason JUMP/PUSH/PHASE_SHIFT aren't wired up yet, and why ability count stops at two: each needs different terrain (a missing-tile gap, a pushable block, a phase barrier, or a proven 3rd physical gate ring), and laying that out safely is a bigger follow-up than fit either pass.
- **Step 4 (noise):** a decoy plate in the unused matrix column, solver-reconfirmed to never beat `optimalCost` — a much smaller decoy repertoire than the full spec's (alternate routes, red-herring locks), but exercising the same "propose then reconfirm" loop.
- **Step 5 (bases):** only ever assigns the safe, never-load-bearing **Discharge** pair (levels 26-29's own established pattern) when `RESONANCE` is requested — Anchor/Dampening's load-bearing variants would need to feed back into the difficulty/margin math this pass doesn't attempt to solve.
- **`FOCUS_VAULT`/`ECHO_TILE`** (not in the original spec's step list at all) are fully supported additions, placed exactly as in levels 23/25 — solver-invisible by construction, same as every hand-authored level using them.
- **A real acceptance gate, closing a gap the original spec didn't mention:** `scripts/generateLevel.ts` requires every candidate to clear the solver (in `LevelGenerator.ts`), the headless witness replay (`WitnessReplay.ts`, unchanged), *and* a real-browser Playwright check (`playwright.config.ts`, `e2e/`) before it's accepted — the first two never touch the DOM (both say so in their own sprint docs); the third does, closing a real blind spot Till flagged when this sprint started.

### 3.1 Determinism & RNG

All randomness flows from a single **PCG32** stream (`src/generation/Random.ts`, `forkStream(seed, streamId)`) seeded by the level seed — this exact algorithm/API now really exists, not just as a spec. v1 forks one sub-stream per generation attempt (`forkStream(seed, attempt)`); base assignment, WFC decoration, and the Scrap Pool's blind-draw shuffle drawing from further forked sub-streams remain future work as those pieces themselves get built out. The Host sends only the seed in the handshake; both clients generate bit-identical levels (confirmed: same seed ⇒ byte-identical `LevelDef`).

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
├── LevelGenerator.ts    # §3 pipeline (scoped v1, §3.0); emits LevelDef
├── LevelSolver.ts       # §2 A*/IDA*; SolverProof; reachability core
├── DifficultyModel.ts   # §4 scoring + target curve
├── Random.ts            # §3.1 PCG32 with forkable streams (real, not a stub)
└── WitnessReplay.ts     # Gate 4 — headless replay through the real ECS pipeline

scripts/
├── validateLevels.ts    # campaign-wide gates 1-4 over all hand-authored levels
└── generateLevel.ts     # CLI: generate → solve → replay → e2e-verify → accept/reject

e2e/
├── verifyLevel.spec.ts  # Gate 5 (new, SPRINT_029) — real-browser Playwright replay
├── actionToInput.ts     # SolverAction → real clicks/keys
└── global.d.ts          # ambient type for window.__e2e (main.ts, debugLevel-gated)
```

No `ZobristTable.ts` or `wfc/` exist yet — the solver's Zobrist hashing (§2.3) is inline in `LevelSolver.ts`, and terrain WFC decoration remains unbuilt (v1's generated levels reuse the existing `scatterDecals` cosmetic scatter, same as every hand-authored level).

Build-time validation (`npm run validate:levels`) runs `LevelSolver` against all hand-crafted campaign JSONs and fails the build if any level lacks a proof or its stored `optimalCost` drifts. `npm run validate:e2e` (new) runs the real-browser gate against the same campaign, plus `_candidate` when invoked by `generate:level`.

---

## 6. Rollout Order

1. **Solver first** (Sprint 14): it immediately pays for itself — campaign validation + runtime Dead End detection.
2. **Difficulty scorer** (Sprint 14): scores the existing 15 levels; calibration data for Chris.
3. **Generator v1** (SPRINT_029, 2026-07-23): the offline generate-and-verify CLI, scoped down per §3.0 — done. Still open: endless mode / Daily Synapse's live delivery mechanism (a separate, later decision — this client is P2P-only with no backend server), the remaining multi-ability/arbitrary-topology generality, JUMP/PUSH/PHASE_SHIFT hex-layout support, and 🔢 Chris's calibration of `computeMargin`/the difficulty curve against real playtests.
