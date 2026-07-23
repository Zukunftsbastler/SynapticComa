# SPRINT 028: Neuro-Resonance, Fully Demonstrated

**Status:** ✅ Completed 2026-07-23
**Trigger:** Till, after playtesting SPRINT_027's Monitor and reporting two fixes needed (below), asked what the next sprint should cover. Offered three options via `AskUserQuestion` (finish demonstrating Neuro-Resonance / Post-MVP levels 27–31 generally / the Generator); Till picked finishing Neuro-Resonance.

---

## 1. Post-Completion Fixes to SPRINT_027 (found via Till's own playthrough, done first)

- **Tutorial boxes no longer auto-dismiss.** The Monitor's 8-second non-blocking timeout read as "disappears before I finish reading." Removed entirely, not lengthened — `TutorialDirector.ts` dropped its `shownAt` field and timeout branch. Every box, blocking or not, now requires an explicit dismissal.
- **Multi-target highlighting.** `EXIT_SEQUENCE` in local mode shows both exits, but `TutorialOverlay.ts` was framing every target rect while drawing only ONE connector line (to the first). Fixed to draw a frame *and* a line per rect. Clarified with Till via `AskUserQuestion` that this was the only gap meant ("Walls" in the original report referred to the same general multi-highlight issue, not a new wall-teaching concept) — generalized `UNLOCK_NODE`/`FOCUS_VAULT`/`ECHO_TILE` in `concepts.ts` to highlight ALL present/untriggered instances, not just the first (level 21 needs two simultaneous Shared Unlocks; this was silently under-highlighting it).

## 2. What Existed vs. What Was Built

Neuro-Resonance (`mechanics.md §4.5`, SPRINT_026) defines four ordered base-pair effects — Discharge, Dampening, Anchor, Clarity — but only Discharge was demonstrated in the campaign (level 26 "First Spark"). `Conduit.base` defaults to `NONE` everywhere else, so no other level was affected by the mechanic at all. `level_design.md`'s own Post-MVP section flagged this gap verbatim.

No engine or mechanic code changes were needed — `ResonanceSystem.ts` and `LevelSolver.ts` already fully implemented all four effects from SPRINT_026. This sprint is level design + solver verification only, three new levels, one per remaining effect, mirroring exactly how level 26 introduced Discharge.

## 3. The Three Levels

- **Level 27 — "Steady Hand" (Anchor, `STAB→MOD`).** A `MOD`-based plate is pre-placed at column 2/row 0 (shape CURVED, deliberately — see the design note below); P1 holds a `STAB`-based plate. The first Insert forms the pair and powers RED; the AP budget is tight enough (`slack=1`) that the second Insert (BLUE) only fits at the Anchor-discounted 1 AP. `optimal=11 AP`, `sync=2`, `coord=1`.
- **Level 28 — "Muscle Memory" (Dampening, `IN→EX`).** An `EX`-based plate pre-placed at column 2/row 0; P1 holds an `IN`-based plate. A second pre-placed conduit at column 4 sits in the wrong rotation — the required Rotate only fits the budget at the Dampening-discounted 0 AP, so forming the pair first is mandatory groundwork. `optimal=10 AP`, `slack=1`, `sync=2`, `coord=1`.
- **Level 29 — "Second Sight" (Clarity, `MOD→STAB`).** A `STAB`-based plate pre-placed at column 4/row 0; P2 holds a `MOD`-based spare. Forming the pair reveals the Scrap Pool's top plate before a genuinely optional blind draw — but the solver's proven-optimal path never touches column 4, the pool, or the spare plate at all, confirming Clarity stays exactly as load-bearing as Focus Vault/Echo Tile: never. `optimal=10 AP`, `slack=1`.

All three reuse the existing gate-wall funnel pattern (5-wall cluster per dimension, as in levels 2/3/20/26) to force the matrix to matter, plus a single Shared Unlock, matching every prior level's structure.

**Design flaw found and fixed during solver verification (not user-reported):** Level 27's first draft used a STRAIGHT-shaped (not CURVED) pre-placed dummy plate. STRAIGHT is symmetric under 180° rotation (`E+W` at both rot0 and rot2), so the solver found a cheaper 11-AP path that just rotated the dummy into place directly — completely bypassing the intended Anchor-forming Insert. Switched the dummy to CURVED, whose four rotations never simultaneously open both East and West faces, forcing the only viable route through the intended fresh Insert.

## 4. Verification

- `npm run validate:levels` run after each level during design, then a final full 29-level pass: all green, including the three new levels — `level_27` (`slack=1, sync=2, coord=1`), `level_28` (`slack=1, sync=2, coord=1`), `level_29` (`slack=1, sync=2, coord=1`). Confirms the standing fairness (`slack≥1`) and interaction (`sync≥1`) gates, and (for 27/28) that the resonance pair is genuinely mandatory, and (for 29) that it genuinely isn't.
- `npx tsc --noEmit`, `npm run build`, `npx vitest run`: all clean (18/18 tests — unaffected by new levels, run as a sanity check).
- Registration confirmed in all three required places: `levelIndex.ts` (`LEVEL_NAMES` + `LEVEL_ORDER`), `LevelLoaderSystem.ts` (`LEVEL_MODULES`).
- No Playwright/browser automation exists in this project — solvability, fairness, and interaction are proven by the solver, but the actual play experience (especially whether Clarity's reveal feels like useful information in practice) hasn't been clicked through by me. Worth a real playtest.

## 5. Open / Next

- Chris's outstanding balance-review flag on Discharge/Anchor/Dampening's AP-economy impact now has three more concrete, solver-verified levels to evaluate against, not just level 26.
- Post-MVP levels 30+ (Spatial Complexity, remaining `mechanic_roadmap.md` proposals, Till's two concrete Post-MVP concepts from 2026-07-23) and the Generator remain unscheduled — no single item pre-selected for the next sprint.
