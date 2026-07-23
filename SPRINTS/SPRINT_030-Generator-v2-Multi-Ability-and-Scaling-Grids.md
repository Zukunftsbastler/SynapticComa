# SPRINT 030: Generator v2 — Multi-Ability Chains + Scaling Grid Size

**Status:** ✅ Completed 2026-07-24
**Trigger:** Till, after SPRINT_029's Batch 1 (levels 30–39): "sie sollen gern zunehmend größer werden und mehr Mechaniken kombinieren" — his stated eventual goal (generating all ~100 levels with rising difficulty) needs exactly the two axes v1's Generator punted on. Batch 1 itself confirmed the concrete blocker: achieved difficulty plateaued around **D≈6.2**, since a short, single-gate level runs out of room to grow once the solver's AP-tightness term saturates. Confirmed via a full plan-mode research/design pass before implementation ("JA, setze diesen nächsten Sprint um").

---

## 1. What Was Built

`src/generation/LevelGenerator.ts` now chains **up to two** simultaneous required core abilities and scales `gridRadius` (3→5) with requested difficulty, reusing a proven pattern rather than inventing new hex geometry:

- **Two-gate shape, traced from `level_16.json` "Airlock"** (RED+BLUE, D=5.70, already shipped): a ring of walls near spawn and a second ring near exit, each gating **both dimensions** with the same hazard type — this is what forces both avatars through both gates, since abilities are global once powered. Exact wall/hazard offsets read directly off the shipped JSON, not re-derived by guesswork.
- **`computeAbilityCount(difficulty, eligibleCoreCount)`**: 2 abilities once `difficulty≥5` and at least 2 of `UNLOCK_RED`/`UNLOCK_BLUE`/`FIRE_IMMUNITY` are eligible; else falls back to exactly v1's original single-gate behavior — fully backward compatible.
- **`computeGridRadius(difficulty)`**: 3 below D=6, 4 for 6–8, 5 at D≥9 — confirmed via `LevelLoaderSystem.ts`/`MovementSystem.ts`/`LevelSolver.ts` that `gridRadius` has no hidden engine cap; 5 is simply the largest value this pass verified end to end.
- **Spawn/exit-relative anchoring**: every ring, the Shared Unlock, and the optional Focus Vault/Echo Tile positions are now offsets from the (variable) spawn/exit hexes instead of fixed absolute coordinates, so the whole shape scales automatically as radius grows.
- **A defensive collision guard**, not hand-proven geometry: after placing all entities, any attempt where two land on the same `(q,r,z)` is rejected and retried with a fresh seed. Cheaper and more honest than exhaustively proving every radius/ability-count/optional-extra combination never overlaps by inspection.
- **Everything else — the convergence loop, `Random.ts`, `DifficultyModel` usage, `scripts/generateLevel.ts`'s acceptance gate, `WitnessReplay.ts`, the Playwright e2e gate — unchanged.** All already generic over level complexity (already proven against the diverse hand-authored levels 16/17/20/21 in earlier full `validate:e2e` sweeps).

## 2. Result

Confirmed via an in-process smoke test across a difficulty spread before generating anything real: achieved D climbs from 3.35 up to **7.79**, well past Batch 1's 6.2 ceiling, with `gridRadius` and matrix-node count visibly rising alongside it. All 8 smoke-test cases and the full real batch below succeeded on the **first** seed — no retries needed.

**Batch 2 (levels 40–49)**, generated and registered exactly like Batch 1: difficulty targets 6–15, varied ability pairs (RED+BLUE, RED+FIRE, BLUE+FIRE) plus Resonance/Focus Vault/Echo Tile layered on top. Achieved D ranges 5.10–7.79 across the batch (not strictly monotonic with the request — same disclosed "achieved vs. requested" variance as Batch 1, driven by how the margin-convergence loop actually resolves for a given seed). All 49 levels (29 hand-authored + Batch 1 + Batch 2) pass `validate:levels`; all 50 (including `_candidate`) pass the real-browser `validate:e2e` gate — the largest levels now take up to ~35s per real-browser check (radius-5, two-gate levels are a genuinely bigger search/replay than anything shipped before), still well within the existing time budget already spent on heavy hand-authored levels like level_07/14.

## 3. Files Touched

- Modified: `src/generation/LevelGenerator.ts` (the extension described above — no other generation files touched).
- New: `src/levels/level_40.json`–`level_49.json` (Generator v2 output).
- Modified: `src/levels/levelIndex.ts` (`LEVEL_NAMES`/`LEVEL_ORDER`), `src/systems/LevelLoaderSystem.ts` (`LEVEL_MODULES`) — registered exactly like any other level.
- Docs: `docs/generative_levels.md` (status banner, §3.0 updated for v2), `docs/level_design.md` (Post-MVP section — Batch 2 entry, Post-MVP ranges shifted from 40+/45+ to 50+/55+), `docs/roadmap.md §5` item 4.
- No changes to `LevelSolver.ts`, `MatrixRoutingSystem.ts`, `LevelSchema.ts`, `WitnessReplay.ts`, `scripts/generateLevel.ts`, the Playwright e2e harness, or any of the 39 previously-shipped level JSONs.

## 4. Open / Next

- Arbitrary N-ability requirement graphs (beyond 2) and `gridRadius>5` — the two axes this sprint deliberately capped rather than solved in general.
- JUMP/PUSH/PHASE_SHIFT hex-layout support, and a proven 3rd physical gate ring (would unlock 3-ability chains, matching `level_17.json` "Signal Chain"'s hand-authored shape) — still genuinely different terrain code, not a natural extension of the two-ring pattern.
- Endless mode / "Daily Synapse"'s live delivery mechanism — still a separate, later decision (no backend server exists).
- 🔢 Chris's calibration of `computeMargin`/`computeAbilityCount`/`computeGridRadius`'s difficulty curves against real playtests — three disclosed heuristics now, not one.
- Andreas/Chris have not reviewed any of this — flagged here for their awareness, same convention as every scoped-down shape this project has shipped.
