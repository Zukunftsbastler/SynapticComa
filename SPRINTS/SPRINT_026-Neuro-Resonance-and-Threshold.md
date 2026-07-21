# SPRINT 026: Neuro-Resonance Built, Threshold Cut

**Status:** ✅ Completed 2026-07-21
**Trigger:** 5th and final item of Till's 5-sprint roadmap-priority request (`docs/roadmap.md` §6) — "decide Resonance and Threshold's fate."

---

## 1. The Decision

`decisions_needed.md`'s own rule says campaign/mechanic decisions need sign-off from all three contributors (Till, Andreas, Chris), not a unilateral call. I flagged that tension via `AskUserQuestion` before touching any code. Till chose to decide alone — the same authorization pattern as D14 (SPRINT_024), not a standing blanket permission (each item gets asked fresh; SPRINT_024's note said as much and this sprint honored it).

Given that authorization, and informed by what the code actually looked like (checked before deciding, not assumed):

- **Neuro-Resonance: build it.** It's compatible with the game's core "shared mutation" philosophy (a matrix action changing more than just what it looks like it changes) and had been sitting as a complete, never-implemented spec since before this session started (`mechanics.md §4.5`, flagged unbuilt in SPRINT_019).
- **Threshold: cut it.** Investigated the code first (not just the docs) and found `ThresholdSystem` is a real, working trigger detector — but `LevelTransitionSystem`'s `executeBoardFlip` has been a `console.debug` call since Sprint 8, never implemented further. SPRINT_013 stripped every threshold hex from the shipped campaign eight sprints ago and no arc has been assigned to it since. Building it for real needs a new alt-hex-layout schema and multi-phase solver support — a bigger lift than fits alongside four other roadmap items in one sprint, for a mechanic with no home in the campaign. Till's own SPRINT_013 principle ("no dead mechanics on the board") argued for applying the same standard to the dead *code*, not just dead campaign content.

Recorded as **D15** in `decisions_needed.md`, mirroring D14's format exactly. Andreas and Chris have not signed off on either half — flagged for their review, not silently decided on their behalf.

---

## 2. Threshold: What Was Removed

Mapped every reference first (`Explore` agent pass) before deleting anything, since the mechanic touched: a component, an event component, a dedicated system, two queries, the core pipeline, `LevelTransitionSystem`'s event-consumption switch, `GameState`'s shape, the network message union (`ThresholdReadyMessage`, plus a shared `'THRESHOLD'` phase literal), `LevelSchema`'s types, `LevelLoaderSystem`'s switch, an entity factory, a sprite registry entry, and a legend UI line. Confirmed first: all 25 levels already had `thresholdEnabled: false` and zero `threshold`-type entities — the removal is pure code cleanup, no level content depends on any of it.

Deleted: `src/components/Threshold.ts`, `src/systems/ThresholdSystem.ts`, `BoardFlipEvent` (from `Events.ts`), `thresholdQuery`/`boardFlipQuery`, the pipeline wiring, `LevelTransitionSystem`'s `executeBoardFlip` stub, `GameState.thresholdEnabled`/`thresholdState` (and the now-impossible `'THRESHOLD'` phase literal), `ThresholdDef`/`thresholdEnabled` from `LevelSchema.ts`, `createThreshold` from `ExitFactory.ts`, `ThresholdReadyMessage` from `network/messages.ts`, the `THRESHOLD_HEX` sprite entry, and the legend line referencing it. Removed `"thresholdEnabled": false` from all 25 level JSON files. Nothing in `src/` references Threshold anymore (confirmed by a final grep pass).

---

## 3. Neuro-Resonance: What Was Built

Scoped down the same way D14 was, because the full spec as written applies to **any** two vertically-adjacent based plates — unlike every other mechanic added this session (Impulse Blocks, Focus Vault, Echo Tiles, Role Asymmetry), that isn't naturally opt-in. A naive implementation would have needed re-balancing every one of the 25 existing levels' AP economy.

- **`Conduit.base`** (new `ui8` field, `ConduitBase` enum: `NONE=0, EX=1, IN=2, MOD=3, STAB=4`). Defaults to `NONE` everywhere a plate predates this sprint — every existing level is unaffected, and `validate:levels` re-proves all 25 byte-identical.
- **`ResonanceSystem.ts`** (new, wired into `pipeline.ts` right after `MatrixInsertSystem`/`MatrixRotateSystem`): scans both conduit columns for vertically-adjacent based pairs, keyed by the exact ECS entity-id pair so a pair can only ever fire once regardless of how many later ticks re-scan it. Implements three of the four effects with real gameplay consequence:
  - **Discharge** (`EX→IN`): +1 AP to the shared pool, immediately.
  - **Dampening** (`IN→EX`): the next Rotate costs 0 AP (`resonanceState.dampeningActive`, consumed by `MatrixRotateSystem`).
  - **Anchor** (`STAB→MOD`): the next Insert costs 1 AP instead of 2 (`resonanceState.anchorActive`, consumed by `MatrixInsertSystem`).
  - **Clarity** (`MOD→STAB`): reveals the topmost Scrap Pool plate's shape until the next matrix mutation. Given a minimal, honest visual (a colored shape letter replacing the face-down `?` in `MatrixRenderer.ts`'s scrap pile) rather than skipping the UI entirely — the project's own hard-won rule from SPRINT_015/016 is that a mechanic without a UI producer is "rules-solvable, not playable."
- **Solver support** (`LevelSolver.ts`), because the project's standing rule is that no mechanic enters the game without it: `Cell` gained `base`; `SState.inventory`/`scrap` are now keyed by `(shape, base)` via `invIndex`; the INSERT branch checks the one new adjacency an insert creates and applies Discharge as a direct one-time bonus to the recursive search budget, Dampening/Anchor as new persistent `SState` flags (`dampeningActive`/`anchorActive`, included in `stateKey`/`cloneState`). Rotation can never form a pair (it doesn't change row position), so it needed no resonance-check hook, only the discount consumption.
- **Network sync**: `MatrixStateUpdateMessage.grid` and `InventoryUpdateMessage` both gained a `base`/`drawnBase` field; `GuestSyncSystem`'s `applyMatrixUpdate`/`applyInventoryUpdate` thread it through. Verified with a dedicated Guest-sync test (below).
- **Level 26, "First Spark"**: an ordinary RED-door puzzle (level-2 geometry) with one pre-placed IN-based plate at column 2 row 0. The player's only inventory plate is EX-based; inserting it (the level's only useful action) shifts the IN plate to row 1 directly beneath it, forming the pair and Discharging +1 AP, while the same insert powers the RED ability node. `initialAP=13` (slack=4 against the resonance-aware optimal of 9) — comfortable, not a razor-thin proof-of-concept.

### Deliberate scope cuts (disclosed, not silent)

- **Floor collectibles never carry a base.** Only plates defined directly in level JSON (pre-placed matrix conduits, starting inventory, Scrap Pool) can. Avoided touching `CollectionSystem`/`CollectedMessage`/`InventoryState`'s pickup path for a first cut.
- **Clarity and level-load-time pre-formed pairs are not modeled in the solver.** Clarity has no cost/solvability effect to model in the first place (information-only, same "can't be load-bearing" argument as Focus Vault/Echo Tile). Level-load pairs aren't evaluated by the solver because no shipped level uses that configuration — `ResonanceSystem` in the live game *does* handle it correctly (runs every tick, `firedPairs`-equivalent dedup via entity-id keys naturally covers pairs already adjacent at load), so this is a solver-only gap, not a live-game one.
- **No "same pair, re-armed slot" tracking.** The spec says breaking a pair and reforming it should re-trigger. The shipped version instead keys `firedPairs` by the literal two entity ids forever — simpler, and the existing AP economics (an ejection needed to break a pair costs a 2-AP insert) already prevent any exploitable farming loop, which was Chris's balance flag on the original spec.
- **`WitnessReplay.ts`'s INSERT-matching selects the source plate by shape only, not base** (pre-existing code, unmodified). A level must never have two simultaneously-held plates of the same shape with different bases, or replay could silently pick the wrong one. Level 26 respects this by construction (only ever one plate per shape in play).

---

## 4. Two Bugs Found and Fixed Mid-Sprint

**A performance regression.** The first solver implementation widened `SState.inventory`/`scrap` from 5 slots (per shape) to 25 (per shape × base) unconditionally, for every level. That's a 5× wider hot loop (INSERT and DRAW both iterate every slot at every search node) for levels that never use a base at all — i.e., all 25 existing levels. `npm run validate:levels` went from ~180s total to over 7 minutes before I killed it and diagnosed the cause.

Fix: `SState` gained a `baseCount` field (1 or 5), computed once per level via `levelUsesResonanceBase(def)` — a level with no based plate anywhere in its JSON gets `baseCount=1`, making `invIndex(shape, base, 1) === shape`, identical to the pre-SPRINT_026 array layout and loop bounds. Only a level that actually assigns a base (currently just level 26) pays the wider search cost.

**A level-design bug caught by the witness-replay gate, exactly as designed.** Level 26's first draft placed the pre-placed IN-based plate at column 2 row 0 with the SAME rotation as the plate meant to be inserted on top of it — which meant it was *already* routing power to the RED ability node from the moment the level loaded, making the "required" insert actually optional (`matrix=opt` in the solver output, a immediate tell). Fixed by rotating the pre-placed plate 90° (N/S open instead of E/W) so it's inert until shifted out of the way — the resonance pair still forms identically (rotation never affects `base` or adjacency), but RED now genuinely requires the insert.

**A gap in `WitnessReplay.ts`'s AP-cost assertion**, found only after fixing the above: the replay gate flat-asserts every `INSERT` costs exactly 2 AP and every `ROTATE` costs exactly 1, netting out Shared Unlock credits the same tick — but had no equivalent accounting for Discharge (an additive credit, like an unlock) or Anchor/Dampening (which change the cost of the *next* action directly, not a separate credit). Fixed by adding `resonanceState.totalDischargeCredit` (a running counter, netted out the same way `creditedUnlockAP()` already was) and reading `anchorActive`/`dampeningActive` *before* each step to compute that step's correct expected cost. This is exactly the kind of solver/shipped-system divergence this gate exists to catch (SPRINT_016) — it did its job.

---

## 5. Verification

- `npx tsc --noEmit`: clean.
- `npm run build`: clean.
- `npx vitest run`: 14/14 passing (10 previous + 4 new in `resonance.test.ts` — Discharge's net AP effect and its once-only firing, Guest-side `base` sync via `MATRIX_STATE_UPDATE`, Anchor's insert discount, Dampening's rotate discount).
- `npm run validate:levels`: all 26 levels (see attached run output).

## 6. Open / Next

- Andreas and Chris have not reviewed D15 — flagged in `decisions_needed.md` for both halves (Resonance's AP-economy impact; Threshold's removal, given Andreas's original concept helped inspire it per D1).
- Dampening, Anchor, and Clarity are fully implemented but not yet demonstrated in any shipped level — level 26 only exercises Discharge. Good candidates for the post-MVP levels 27+ range (`level_design.md §5`).
- This closes all five items of Till's roadmap-priority punch list (`roadmap.md` §6). Next planned work (per `SPRINTS/README.md`): The Monitor tutorial architecture, the Generator, or further post-MVP campaign content — no single next item is pre-selected.
