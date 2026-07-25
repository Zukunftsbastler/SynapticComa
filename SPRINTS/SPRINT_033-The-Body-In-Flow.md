# SPRINT 033: The Body — Progress You Never Have to Go and Look At

**Status:** ✅ Completed 2026-07-25
**Trigger:** Till, continuing D16 after SPRINT_032 shipped the narrative runtime: *"Achte für eine lückenlose Integration in das bestehende Spielprinzip. Sorge dafür, dass es sich wie eine sauber integrierte Spielmechanik anfühlt, die nicht extra annavigiert werden muss, sondern sauber in den Spielprozess integriert ist."*

---

## 1. The Design Call: No Body Screen

`body_awakening.md §10` had specced a dedicated Body screen that auto-opens on a milestone, plus a "check on the patient" entry point in the level select. **Both were dropped**, because both fail Till's constraint on inspection: an auto-opening screen is still somewhere the player gets *sent*, and a menu entry is exactly the navigation this was supposed to avoid.

There is no Body screen in this build, and no button that opens one. The body appears at three points the player already passes through:

1. **Inside the region-unlock beat — the primary one.** A region waking is not "a cutscene, and then a body screen." The body *is* that beat's panel: the new region pulses, every previously-woken one is already lit, and the progress count sits beside it. Payoff and progress land in the same glance, inside the story moment the player is already watching. This works because of an ordering detail SPRINT_032 happened to get right: `unlockRegion()` runs when the beat is *dismissed*, so during the beat the region is genuinely mid-wake rather than retroactively shown.
2. **Every LevelComplete screen.** A 46px silhouette plus "N / 12 AWAKE" between the level name and the buttons. Every level now ends with the player seeing the patient — D16's original motivation ("give the puzzle-solving a visible *why*") delivered on a screen they already land on, at the cost of zero clicks.
3. **The level-select header**, beside "SELECT DESCENT", as context for picking a level.

None of the three is clickable and none carries controls: the body reads as a bedside monitor readout, consistent with the Monitor's established role as the one thing observing from outside the mind. Stated plainly — **there is nothing to open, so there is nothing to forget to open.**

## 2. Drawn, Not Generated

`body_awakening.md §9.1–9.2` proposed one AI-generated raster silhouette plus a hand-authored rect lookup. Shipped instead: a procedural SVG (`src/ui/BodyDiagram.ts`), one shape set per region over a fixed `0 0 100 210` coordinate space.

This follows §9.4's own argument rather than contradicting it — if this is "a HUD/diagram element like the Matrix panel, not a narrative image," then it should be built like the Matrix panel, and `MatrixRenderer.ts` draws from geometry, not from an asset. Concrete gains: regions highlight *exactly* instead of being approximated by bounding rects; the sprint shipped with **zero** art dependency (`public/cutscenes/` is still empty); and it stays crisp from 34px in the level-select header to 108px in a reveal. §9.3–9.5 shipped as written — state is attribute toggling, the reveal pulse is a CSS keyframe. Swapping in generated art later touches this one file.

**No ECS here, deliberately.** The reveal pulse is *not* an `Fx` entity: those carry `Position` + `Dimension` and are drawn by `RenderSystem` into the hex grid's coordinate space, which this diagram is not in. Forcing it through the ECS would be ceremony. SPRINT_032 established the honest split — ECS for events and in-world triggers, state modules for persistence, DOM for presentation — and a body diagram is squarely presentation. The ECS work in this feature area returns with the in-world `NarrativeTrigger` hex.

## 3. Two Real Fixes Found Along the Way

- **Contrast.** The first pass drew the dormant silhouette darker than the clinical-reality panel tints it renders over (`#1b2320` against `#16201c`) — on a screenshot check the body was essentially invisible. Dormant fill/stroke raised to `#33443d`/`#4e6459`, awake and waking brightened to match. Caught by looking at the rendered page, not by any test.
- **The wake pulse faded toward invisible.** It animated down to `opacity: 0.35`, so the region that just woke periodically became the *least* visible thing on screen — backwards for something whose entire job is drawing the eye. The trough is now `0.62`: it pulses brighter, never toward gone.
- **Guest body state.** On the Guest, `unlockRegion()` was never reached — only the Host's `playBeatQueue` commits story progress, so a Guest could play a whole co-op campaign and watch its own body stay dark. The Guest's `CUTSCENE_ADVANCE` close handler now commits the same beat and region locally.

## 4. Verification

- **3 new unit tests** (30/30 total): every `BodyRegion` has a shape entry — a region in the enum but missing from the table would silently never appear, its beat would fire, and the body would not change; the progress label counts against the full region set; and every region is actually reachable by some beat, with the two Fork branches as the deliberate exception.
- **1 new e2e test** (`the body is present in the normal flow and never has to be navigated to`): drives level_05 to completion, asserts the patient block is visible on the completion screen with `fingers_toes` still dormant, that clicking through shows the reveal with that exact region in `data-state="waking"`, and that after dismissal it persists as `awake` in the level-select header — reached without ever opening anything.
- Full `validate:levels` (59/59) and `validate:e2e` (63/63) re-run green; `tsc`, `build`, `vitest` green. Note that this sprint touches no simulation code at all — no system, no pipeline, no solver, no level JSON — so `levelMeta.json` stays byte-identical; `validate:levels` was re-run for the standing convention, not because anything could plausibly have moved.

## 5. Files Touched

- New: `src/ui/BodyDiagram.ts`.
- Modified: `src/narrative/CutscenePlayer.ts` (region-unlock beats render the reveal panel), `src/ui/LevelCompleteScreen.ts`, `src/ui/LevelSelectScreen.ts`, `src/main.ts` (passes `awakeRegions`; Guest commits region state), `src/systems/__tests__/narrative.test.ts`, `e2e/narrative.spec.ts`.
- Docs: `body_awakening.md` (status, §9 as-built note, new §12 on integration), this sprint doc, `SPRINTS/README.md`.

## 6. Open / Next

- **Artwork** remains the outstanding piece of D16 and the real cost driver — cast reference sheet, opening panels, vignettes. The body diagram no longer depends on any of it.
- **In-world `NarrativeTrigger` hexes** — the next genuinely-ECS piece, and the only one that touches `LevelSchema.ts`; must be proven solver-invisible like Focus Vault and Echo Tile.
- **Levels 60–100** don't exist; their beats and the Act 2–5 region cadence remain a written but unexercised schedule.
- **D16 still has no sign-off from Andreas or Chris.** Till's call was explicitly provisional and this sprint inherits that status.
