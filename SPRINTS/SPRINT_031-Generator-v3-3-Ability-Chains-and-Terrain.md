# SPRINT 031: Generator v3 — 3-Ability Chains + JUMP/PUSH/PHASE_SHIFT Terrain

**Status:** ✅ Completed 2026-07-25
**Trigger:** Till, after seeing SPRINT_030's result (Generator v2, D≈7.8): "Was sind die nächsten Schritte?" → recommendation given → **"Ja, lass uns in 3-Mechaniken-Ketten und passendes Terrain investieren. Es darf mehr Aufwand kosten!"** — explicit authorization for the larger investment v1/v2 both disclosed as their remaining gap: `JUMP`/`PUSH`/`PHASE_SHIFT` were fully solver-modeled but never wired into the Generator's hex-layout step (each needs genuinely different terrain, not a swapped hazard type), and ability chaining was capped at two.

---

## 1. What Was Built

`src/generation/LevelGenerator.ts` now wires up **all six** core mechanics and chains **up to three** simultaneous required abilities, traced from shipped levels rather than invented:

- **Gate-kind union (`GateSpec`):** every core mechanic maps to one of two gate kinds. **Hazard-gate** (RED/BLUE/FIRE/PHASE) — a `hazard` or `phase_barrier` entity at the gate's center hex; `PHASE_SHIFT` slots in directly because `phase_barrier` blocks passage identically to a hazard door in `LevelSolver.ts`, including as a push-destination. **Terrain-gate** (JUMP/PUSH) — new: `JUMP` reuses a `hazard{hazardType:CHASM,alwaysLethal}` two hexes from the entry point along the travel axis (traced from `level_03.json` "Column Shift"); `PUSH` places a `pushable_block` at the gate center (traced from `PushSystem.ts`/`LevelSolver.ts`'s actual rule, not `level_22.json`'s bespoke hand-tuned maze), with push direction always toward exit since `LevelSolver.ts` never checks board edges for a push destination.
- **Full-row sealing (`sealRow`), replacing v1/v2's fixed-width wall flank:** every non-`q=0` hex at a gate's row is walled, computed directly from the hex-distance-from-origin boundary formula. Found necessary via a deterministic "gate bypassable" failure at `gridRadius=4`+ — hex rows *widen* away from the poles, so a fixed 2- or 5-wall flank leaves the rest of a wider row open to walk around. Full-row sealing is provably airtight at any radius, since crossing that row requires passing through the `q=0` corridor.
- **`JUMP` is solo-only** — a second, deeper empirical finding, surviving even after the full-row-seal fix: `LevelSolver.ts`'s jump branch never checks the intermediate hex of a 2-hex jump, so once `JUMP` is powered a player can leap over *any* single hex exactly 2 rows away — including a different gate's hazard or phase barrier. This makes `JUMP` structurally incompatible with sharing a corridor with other row-gated mechanics under this mirrored-per-dimension template (the hand-authored `level_24.json` avoids this via an asymmetric-per-dimension template the generator doesn't build). Fix: `JUMP` is filtered out of the multi-ability pool entirely, with a graceful fallback to 1-ability mode if the remaining pool can't fill the requested count — `JUMP` stays fully supported alone.
- **3-ability chaining via independent gate slots, not `level_17.json`'s shared-column trick:** `computeAbilityCount` now returns 1/2/3, and `generateLevel` places 1/2/3 evenly-spaced gate slots (exit-relative → + spawn-relative → + a new center slot at `r=0`), each mirrored across both dimensions with the same requirement. Each slot gets its own independent `col3row{i}` matrix node — column 3 has room for 5 stacked, independently-powered rows, so no shared-column pass-through dependency is needed the way `level_17.json` "Signal Chain" hand-built one.
- **Everything else unchanged:** the convergence loop, `Random.ts`, `DifficultyModel`, the defensive collision guard, `scripts/generateLevel.ts`'s acceptance gate, `WitnessReplay.ts`, the Playwright e2e gate.

## 2. A Real Input Bug, Found By the Gate It Exists To Catch

Generating Batch 3 needed a fallback spec for `level_59` (its original D=11/7-mechanic ask failed 5 retry seeds; a progressively less extreme fallback succeeded on attempt 3). That fallback path only ran the Generator's own solver check — not `WitnessReplay` or the real-browser Playwright gate. Running the full triple-gate afterward surfaced a genuine failure: `level_59` passed `solveLevel` and headless `replayWitness`, but failed `validate:e2e` with P1 seemingly frozen mid-level.

Diagnosis (via `window.__e2e`-exposed ECS state read at each replayed action, added temporarily and removed once resolved): P1's Position never updated after a click that should have been a valid adjacent move, immediately following an INSERT action. Root cause, in two parts:

1. **`MouseInput.ts`'s click listener had no check on `e.target`.** It's attached to `window` and reads raw client coordinates — so a click on any HTML overlay (an inventory slot, a matrix insert arrow) still bubbles to `window` and gets reinterpreted as a hex-board move whenever the overlay's on-screen position happens to alias a valid adjacent hex for the currently controlled avatar. One bogus move desyncs every subsequent click in the sequence (each targets a hex adjacent to where the witness expects the avatar to be, not where it actually is after the bogus move).
2. **`LegendPanel.ts`'s always-visible header had a genuinely large clickable hitbox** (`right:8px;top:150px;width:280px`) that overlaps the right hex board at high `gridRadius` — board hexes can render as high up as `y≈14` at `gridRadius=5`, well inside the panel's footprint. Even after fixing (1), `level_59`'s P2 exit hex happened to land exactly under the panel's header row.

Both were real, previously-latent bugs — invisible until Batch 3's higher `gridRadius` pushed board content far enough up-screen to collide with fixed UI chrome, and specifically caught by the real-browser gate SPRINT_029 built for exactly this class of DOM-only failure. Fixed: `PixiDriver` exposes a `canvasElement` getter; `MouseInput.ts`'s click listener now ignores any click whose target isn't the canvas. `LegendPanel.ts`'s outer container is `pointer-events:none`, with only a small dedicated toggle glyph (not the full header row) kept clickable.

## 3. Result

Generated **Batch 3** (levels 50–59, "Clean Leap" through "Everything, Carefully") — 9/10 on first-attempt specs, `level_59` via a fallback spec (see above). Levels 55/56/59 are the campaign's first genuine 3-ability levels (`needs=[BLUE,FIRE,RED]`, `needs=[RED,FIRE,PHASE]`, `needs=[BLUE,PHASE]` + Resonance). After the input-handling fix, the **full campaign** — all 59 levels (29 hand-authored + 3 generated batches) plus `_candidate` — passes `validate:levels` (solver proof) and `validate:e2e` (real-browser replay): 59/59 and 60/60 respectively.

## 4. Files Touched

- Modified: `src/generation/LevelGenerator.ts` (gate-kind union, full-row sealing, 3-slot chaining, JUMP solo-only exclusion — described above).
- Modified: `src/input/MouseInput.ts` (canvas-target guard on the click listener).
- Modified: `src/rendering/PixiDriver.ts` (new `canvasElement` getter).
- Modified: `src/ui/LegendPanel.ts` (pointer-events split — panel pass-through, toggle glyph clickable).
- New: `src/levels/level_50.json`–`level_59.json` (Generator v3 output).
- Modified: `src/levels/levelIndex.ts` (`LEVEL_NAMES`/`LEVEL_ORDER`), `src/systems/LevelLoaderSystem.ts` (`LEVEL_MODULES`).
- Docs: `docs/generative_levels.md` (status banner, §3.0, §6), `docs/level_design.md` (Post-MVP section — Batch 3 entry, ranges renumbered from 50+/55+ to 60+/65+), `docs/roadmap.md §5` item 4.
- No changes to `LevelSolver.ts`, `PushSystem.ts`, `MatrixRoutingSystem.ts`, `LevelSchema.ts`, `WitnessReplay.ts`, `scripts/generateLevel.ts`, or any of the 49 previously-shipped level JSONs.

## 5. Open / Next

- Arbitrary N-ability requirement graphs beyond 3, and `gridRadius>5` — the two axes this sprint deliberately capped.
- `JUMP` remains solo-only by design, not a temporary limitation — combining it with other row-gated mechanics would need a fundamentally different (asymmetric-per-dimension) template this generator doesn't build.
- Endless mode / "Daily Synapse"'s live delivery mechanism — still a separate, later decision (no backend server exists).
- 🔢 Chris's calibration of `computeMargin`/`computeAbilityCount`/`computeGridRadius`'s difficulty curves against real playtests — unchanged from SPRINT_030's note.
- Andreas/Chris have not reviewed any of this — flagged here for their awareness, same convention as every scoped-down shape this project has shipped.
