# SPRINT 016: Insert Feedforward UI & the Witness-Replay Gate

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's playtest report — Level 5: "die blaue Tür in Zeile 2 kann ich nicht mit einem Plate ansteuern; erste und letzte Zeile erreiche ich per Pfeil-Klick, die dazwischen nicht." Suspected: another case of UI not matching assumed functionality; requested a systematic detector for *any* case where the UI blocks a solver solution.

---

## 1. Diagnosis: The Mechanic Works — It Was Illegible

This time the game logic was **correct**. `MatrixInsertSystem` implements the intended "Verrücktes Labyrinth" column slide exactly: plates enter only at the two ends; every insert shoves the whole chain one row deeper; the plate pushed past the far end drops face-down into the Scrap Pool. Middle rows are therefore *unreachable with a single insert* — **by design**. They are reached by pushing more plates in behind, and because either player may insert into the same column, reaching row 2–3 is usually a two-person maneuver. That constraint is the puzzle substrate the level design depends on (`level_design.md`), so the UI must **not** offer arbitrary placement or swapping.

Level 5's proven solution is exactly this: P2 inserts the STRAIGHT from the top (row 1: powers RED via the per-row source), then **P1's T-JUNCTION insert from the same end pushes P2's plate down to row 2**, where it powers BLUE. Verified end-to-end: the solver witness now replays through the real system pipeline to `LEVEL_COMPLETE` (see §3).

What failed was **legibility** (Norman: feedforward/visibility): nothing showed *what a push would do* before buying it for 2 AP, the pre-insert rotation ([R]) had no visual representation at all (a `console.debug`!), and no teaching text mentioned the push-chain. A player who has not seen "Das verrückte Labyrinth" cannot infer the mechanic from two static arrows.

## 2. Fix A — UI Concept: "Push Preview" (Feedforward, not freedom)

Design principles applied: **feedforward** (show consequences before commitment), **visibility of system status** (no invisible modes), **constraints made legible** (the four entry points are the *only* affordances — the preview explains *why* that's enough), **error prevention** (ejection warning before an irreversible 2-AP action), **recognition over recall**.

Implemented in [MatrixRenderer](../src/rendering/MatrixRenderer.ts) / [MatrixUI](../src/ui/MatrixUI.ts) / [uiState](../src/ui/uiState.ts) / [InventoryPanel](../src/ui/InventoryPanel.ts):

1. **Hover = full push preview.** While a plate is armed, resting the pointer on a ▼/▲ arrow renders the complete consequence: a gold ghost of the incoming plate (with its actual pipe faces at the chosen pre-rotation) on the entry cell, a gold shift marker on every plate in the column, and a **red ✕ ejection warning** on the plate that would drop into the Scrap Pool. The chain mechanic teaches itself: you *see* your plate landing at the end row and everything else moving deeper.
2. **Pre-rotation made visible.** `pendingRotation` moved from a private field into shared `uiState`; the InventoryPanel shows the effective angle in gold (`↻ 90°`) and the preview ghost renders the rotated face-mask. Arming a different plate resets it.
3. **Teaching.** The INSERT Monitor popup now states the core rule outright: *plates only enter at the ends; middle rows are reached by pushing more plates in behind — including your partner's; hover before clicking to preview.*
4. **Deliberately NOT added:** drag-and-drop onto arbitrary cells, plate swapping, direct middle-row placement — the constraint *is* the puzzle; the UI's job is to make it legible, not to remove it (Till's explicit requirement).

## 3. Fix B — The Witness-Replay Gate (the systematic detector)

Till's standing requirement: *whenever the UI/game blocks a solver solution, that must be identified automatically.* SPRINT_015's producer scan catches missing action kinds; this sprint closes the remaining gap — **semantic divergence** between the solver's rule model and the shipped systems.

- **[systems/pipeline.ts](../src/systems/pipeline.ts)** — the fixed-step system order extracted into one shared module (gameLoop appends only the PeerJS transport). Game and proof now run the *same* simulation.
- **[generation/WitnessReplay.ts](../src/generation/WitnessReplay.ts)** — replays a solver witness headless in Node: real `LevelLoaderSystem`, real pipeline, one action per tick. Each action is synthesized as the exact `GameMessage` the UI would produce, under UI producibility constraints (moves must be 1-hex steps or explicit straight-line 2-hex jumps; inserts must name a plate *the acting player actually holds* — the solver merges inventories, the game does not; blind draws are forced onto the witness's worst-case shape via a stubbed RNG). Assertions: every action accepted at its **exact AP cost** (Shared-Unlock surges netted out), positions match, phase ends in `LEVEL_COMPLETE`.
- **`validate:levels` Gate 4:** any replay failure fails the build naming the level, step, action, and reason.

Standing rule (now in `generative_levels.md §2.4`): a new mechanic enters the solver only together with its capability-map entry, its UI producer, **and its replay synthesis** — the gates enforce the triple permanently. This is the closure Till's generator goal needs: levels stacking many mechanics with arbitrarily many player switches stay provably *playable*, not merely rules-solvable.

## 4. Verification

- Smoke: level_03 (blind draw) and level_05 (push-chain) replay to `LEVEL_COMPLETE` through the real systems.
- Full `validate:levels`: 15/15 proofs, all four gates green, witness replay passing for every level; `levelMeta.json` unchanged. `tsc` strict + Vite build clean.

## 5. Open / Next

- The replay gate validates the message-level interface; the DOM click→message step remains covered only by the static producer scan. A Playwright-style end-to-end click test would close that last inch — low priority while the layout is in flux.
- Replay currently exercises the Host path (`localPlayerId = 0`). Guest-side mirroring (GuestSyncSystem) is untested here; the SPRINT_006 smoke suites still cover it manually.
- Unchanged: sync upper bounds L7/14/15; slack-band drift for team review (🔢 Chris); L12 lost forced coordination (SPRINT_014 §6).
