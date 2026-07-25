# SPRINT 032: Narrative Runtime — Cutscenes, Story Schedule, D16 Greenlit

**Status:** ✅ Completed 2026-07-25
**Trigger:** Till asked for a sprint sketch covering the storyline, the cutscenes and the body-part layer, with one explicit constraint: *"Achte darauf, dass das ECS genutzt wird!"* After reviewing the sketch he resolved the open governance question himself: *"In Anbetracht des begrenzten Zeitplans und der zu erwartenden Reaktionszeit entscheide ich zunächst selbst, auf die Gefahr hin, dass die Entscheidung später zurückgenommen und eine Neuentwicklung umgesetzt werden muss. Wir blockieren nichts, sondern setzen umfassend um."* — plus three scope decisions: **100 levels final**, **2–3 story variants**, **cutscene after the LevelComplete screen**.

---

## 1. The Decision (D16)

`decisions_needed.md` D16 had sat unresolved since 2026-07-23, and this project's own rule requires three-way sign-off for a content commitment this size. Till decided alone for the fourth time (after SPRINT_018, D14, D15) — but unlike those, he named the trade-off himself rather than being asked to weigh it: the decision is **explicitly provisional**, Andreas and Chris may still overturn it, and a rebuild is accepted as a possible cost of not waiting. Recorded as such in `decisions_needed.md`; the governance flag stays open in parallel with the implementation.

Still genuinely undecided and *not* silently assumed here: the Fork's mechanic commitments, and who authors the art.

## 2. Where the ECS Actually Belongs

Till's "use the ECS" instruction had already been interpreted once, in `body_awakening.md §10`, as "don't invent parallel infrastructure" — and that section concluded **zero** new components or systems. Re-examining it produced a sharper, three-way answer, with one decisive technical fact behind it:

> `LevelLoaderSystem.loadLevel()` calls `deleteWorld()` + `entityRegistry.clear()` on **every** level load.

So anything held in a bitECS component is destroyed at exactly the boundary this feature's state has to survive. That settles the split on evidence rather than taste:

| Layer | Home | Why |
|---|---|---|
| A beat coming due | **ECS event entity** (`NarrativeBeatEvent`) + `NarrativeSystem` | Ephemeral, one tick, produced by one system and consumed by another — precisely `architecture.md §4`'s event-entity pattern, identical in shape to `P1ExitedEvent` |
| In-world trigger hexes | **ECS component** (next sprint) | Lives exactly one level's lifetime |
| Story/region progress | `state/NarrativeState.ts`, **not** ECS | Must outlive `deleteWorld()`; same category as `ProgressionState` |
| Panels, Body screen | DOM overlay | Same convention as `LevelCompleteScreen` |

`body_awakening.md §10` has been corrected in place rather than quietly left standing: its state-side reasoning was right, its "zero new components" conclusion overreached because it only ever considered state, never triggers. Routing beats through an event entity is also what lets the planned in-world `NarrativeTrigger` hex emit the identical event later at no extra cost.

## 3. What Was Built

- **`src/narrative/beats.ts`** — the beat registry. Three kinds (`PROLOGUE`, `VIGNETTE`, `REGION_UNLOCK`) plus the one-off `FORK`. Panels carry no text; the Monitor's CRT line is the single sanctioned exception (`narrative.md §5.2b`). Story variants share panel art and differ only in Monitor text — `body_awakening.md §5`'s own recommended scope-down, so a variant costs writing, not illustration.
- **`src/narrative/beatIndex.ts`** — the schedule, **written against 100 levels, not the 59 that exist**. Levels 1–10 carry a beat each (D16's explicit no-silent-gaps window); cadence then widens to every ~5, then ~10–15. Entries for levels 60–100 are already in place and activate untouched as those levels ship — an unmatched key is inert, never an error. A static lookup keyed by level id, mirroring `levelIndex.ts`: **no new `LevelDef` field, so `LevelSchema.ts`, the solver, and all 59 shipped level JSONs are untouched.**
- **`src/narrative/CutscenePlayer.ts`** — the panel overlay. Click/Enter to advance, Escape or SKIP to leave, progress dots, no button labels (the arrow is universal). Panels render as a modest framed image, not a full-bleed splash (`body_awakening.md §7`, "eher kleine Bilder als zu große"). Deliberately presentational: it reports outcomes via `onDone` and never writes state itself.
- **`src/state/NarrativeState.ts`** — `storyVariant`, `seenBeats`, `unlockedRegions`, `forkChoice`; localStorage, own key so story and campaign progress reset independently. Beats never auto-replay: revisiting level 5 must not re-trigger its cutscene.
- **ECS** — `NarrativeBeatEvent` (`beatId: ui16`), emitted by `LevelTransitionSystem` on completion, drained by the new `NarrativeSystem` into `GameState.pendingBeats`. The system deliberately does not *show* anything: the beat plays after the LevelComplete screen, which is UI flow, not simulation. Same split as `APUnlockSystem` changing the pool and letting the HUD notice.
- **Co-op** — `CUTSCENE_ADVANCE` (Host → Guest), delegated to the campaign controller exactly like `LEVEL_LOAD` already is. The Host drives; the Guest displays and never advances on its own, matching the "WAITING FOR HOST…" behaviour its LevelCompleteScreen already had. The message carries the Host's `storyVariant` — without it the two players would read different Monitor logs over the same panel, since each machine picks its own variant at save creation.
- **The Fork (~L48)** is live: the only beat that asks for input rather than being watched. Emphasis, not exclusivity — the level order never branches; only which Act-3 region wakes differs, and the untaken one stays dormant as a replay hook.

## 4. Integration Risk, Handled Up Front

A full-screen overlay is exactly what broke the e2e gate in SPRINT_029 (a blocking tutorial box swallowing the witness's clicks) and again in SPRINT_031 (overlay clicks bleeding through to the board). So narrative is **suppressed under a bare `?debugLevel=`** — that harness verifies levels, not campaign flow — and `?narrative=1` opts back in, which is what the new narrative e2e spec uses. The 60 level-verification runs are therefore untouched by design, not by luck.

## 5. Verification

- **9 new unit tests** (`src/systems/__tests__/narrative.test.ts`): schedule lookup, the no-gaps guarantee for levels 1–10, Fork resolution not leaking into other slots, 100-level coverage, registry integrity (every scheduled beat exists, keys unique, every region beat names a real region), the event→`pendingBeats` hop with entity destruction, and a real level driven to completion through the full pipeline. **27/27 total.**
- **2 new e2e tests** (`e2e/narrative.spec.ts`): the opening sequence plays through all three panels and does *not* replay on reload; a level beat appears only *after* "NEXUS CLEARED", and skipping it continues into the next level.
- Full `validate:levels` (59/59) and `validate:e2e` (62/62 incl. the two new narrative tests) re-run green; `tsc`, `build`, `vitest` green.

## 6. Files Touched

- New: `src/narrative/{beats,beatIndex,regions,CutscenePlayer}.ts`, `src/state/NarrativeState.ts`, `src/systems/NarrativeSystem.ts`, `src/systems/__tests__/narrative.test.ts`, `e2e/narrative.spec.ts`.
- Modified: `src/components/Events.ts` + `index.ts`, `src/queries.ts`, `src/systems/pipeline.ts`, `src/systems/LevelTransitionSystem.ts`, `src/systems/GuestSyncSystem.ts`, `src/network/messages.ts`, `src/state/GameState.ts`, `src/main.ts`.
- Docs: `decisions_needed.md` (D16 resolution), `narrative.md §5/§5.2c`, `body_awakening.md` (status + §10 correction), `architecture.md` (§3 component list, §4 pipeline + responsibilities, §6 non-ECS modules), `roadmap.md §1`.
- **No changes** to `LevelSchema.ts`, `LevelSolver.ts`, `WitnessReplay.ts`, or any level JSON.

## 7. Open / Next

- **The Body screen** (`body_awakening.md §9`): one silhouette asset + a code-defined region-rect table + the `TutorialOverlay` mask technique. The state it reads already exists and is being written today.
- **In-world narrative triggers**: a `NarrativeTrigger` component + read-only system, emitting the same `NarrativeBeatEvent`. Builds the shape `architecture.md` specced as `TutorialTrigger` but never got. The only piece that touches `LevelSchema.ts` — must be proven solver-invisible, same as Focus Vault and Echo Tile.
- **Artwork** (the real cost driver, Andreas-owned and unconfirmed): cast reference sheet, opening panels, vignettes, region art. Dropping files in and setting `PanelDef.asset` needs no runtime change.
- **Beat schedule for levels 60–100** is written but unvalidated — those levels don't exist yet, and the Act 2–5 pacing stays a proposal.
- **Andreas and Chris have not signed off on D16.** Till's call was explicitly provisional; this may need reworking.
