# SPRINT 007: Level Solver, Difficulty Model & Campaign Validation

**Status:** ✅ Completed 2026-07-19
**Goal:** Build the mathematical core promised in `generative_levels.md` — a solver that *proves* level solvability and computes minimal AP cost — wire it into a `validate:levels` build gate, and use its output to replace the provisional AP values from SPRINT_005 with data-derived ones.

---

## 1. What Was Implemented

- **`src/generation/LevelSolver.ts`** — pure-TypeScript solver (no bitECS, no DOM; runs in Node/CI). Iterative-deepening AND/OR depth-first search over total AP cost with an admissible heuristic (hex distance with jump relaxation, `⌈d/2⌉` per player) and a monotone failure cache. Mirrors the shipped systems exactly: East-only matrix routing with N/S flooding (from `MatrixRoutingSystem`), global abilities, column-slide ejection, 90°-CW rotations, sequential exit, automatic collection, and Shared-Unlock pair triggering with the live pool constraint (spending never dips below zero before a grant — enforced via `initialAP + credited(unlockMask) − spent`).
- **Blind draws are adversarial:** a DRAW is an AND-node — the level must remain solvable for *every* shape the pool might yield. "Provably solvable" therefore means *solvable under worst-case draw order*, which is the honest reading of hidden information.
- **`src/generation/DifficultyModel.ts`** — difficulty score over solver outputs (solution length, coordination steps, AP tightness, hidden-info load; resonance weight reserved) plus the endless-mode target curve `D₁₅ + k·log₂(1 + n − 15)`.
- **`npm run validate:levels`** (`scripts/validateLevels.ts`) — proves all campaign levels and prints optimal cost, slack, tightness, difficulty, and witness stats; exits non-zero on any missing proof. `tsx` added as devDependency to run it.
- **`scripts/tuneInitialAP.ts`** — analysis tool: per level, computes the no-unlock optimum and the minimal viable `initialAP`, exposing the *forced-coordination range* (the `initialAP` window in which the Shared Unlock is mathematically required).

## 2. What the Solver Revealed (and the retuning it drove)

1. **The provisional SPRINT_005 budgets made Shared Unlocks globally optional** — every level solved with `coord=0`. The cooperative core mechanic was decorative.
2. **Forcing coordination on these small grids costs slack:** with a +4 unlock near spawn, `initialAP < optNoUnlock` inevitably lands at slack 0–2. Slack 0 (one wasted AP = Dead End) violates the fairness rule (`generative_levels.md §2.4`) — unacceptable in the learning phase.
3. **Final tuning** (all proven, per `validate:levels`):
   - Levels 1–5: slack 6–8, unlock optional (tutorial contract from `level_design.md §6.3`).
   - Levels 6–8, 11: slack 3–5, mixed.
   - **Forced coordination (`coord=1`) on levels 7, 9, 12, 13, 14, 15** — from mid-campaign on, the unlock is mathematically required.
   - Level 10 "Tight Budget": unlock value lowered to **2** (the only way to get real tightness while the pair sits near spawn); slack 2.
   - Difficulty curve: D ≈ 0.6 → 2–3.5 → 5–6. No level below slack 1.
4. Solver performance: all 15 proofs in < 300 ms each (≤ ~30k nodes) — comfortably fast enough for CI and future runtime use.

## 3. Decisions & Deliberate Deviations

- **Exact string state keys instead of Zobrist hashing.** A *proof* tool must not risk hash collisions; Zobrist (with Pcg32 seeding) moves to the generator sprint where approximate visited-sets are acceptable at scale. `generative_levels.md §2.3` still describes the generator-scale design.
- **Merged inventories.** AP is shared and either player may insert, so plate ownership has no mechanical effect — the solver tracks one shape-multiset (rotation-free: pre-insert orientation costs 0 AP).
- **Push and Threshold are not modeled:** no level JSON contains a pushable, and the engine's board-flip effect is still a stub (Sprint 9 note in `LevelTransitionSystem`).
- **Solver mirrors the code, and the code diverges from the docs in two places** (flagged for the team rather than silently "fixed"):
  1. `mechanics.md §5.6` says abilities apply per-player (scope = connected source); the code's `AbilitySystem` is **global**. The solver follows the code.
  2. With JUMP active, `MovementSystem` *replaces* the 1-hex step by the 2-hex jump whenever the jump path is clear — you cannot short-step in that direction. Mirrored; arguably a bug worth a team decision.

## 4. Verification

- `validate:levels`: **15/15 levels provably solvable**, worst-case draws included.
- `tsc`, `vite build`, SPRINT_005/006 smoke suites — all clean/passing.
- The solver's own correctness is cross-checked structurally (routing/face-mask logic reuses `ConduitFaceMask` verbatim; movement/unlock semantics were mirrored from the system sources reviewed in this sprint).

## 5. Open / Next

- **Chris:** weights in `DifficultyModel.DEFAULT_WEIGHTS`, the slack bands, and the two doc/code divergences above (🔢).
- **`deadEndDistance`** (perturbed-state re-solving) is specified but not yet computed — add when the generator needs its fairness gate.
- **Runtime reuse:** `deadEnd.ts`'s BFS could now delegate to the solver's reachability; deferred until the solver runs in a worker (avoid main-thread stalls).
- Next per plan: **Resonance** (SPRINT_008), then **The Monitor** (SPRINT_009), then the **Generator** (SPRINT_010).
