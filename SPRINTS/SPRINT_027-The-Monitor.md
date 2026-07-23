# SPRINT 027: The Monitor

**Status:** ✅ Completed 2026-07-23
**Trigger:** Till, asked directly "was sind sinnvolle Inhalte des nächsten Sprints?" — picked from three roadmap-listed candidates (Monitor, Generator, post-MVP levels) after the art pass made the board worth pointing at; then confirmed two scope calls up front (see below).

---

## 1. What Existed vs. What Was Built

`docs/tutorial_design.md` specs a 5-file "Monitor" architecture — concept registry, ECS trigger system, sequencing director, dim/frame/arrow overlay, scripted Level-1 "Calibration" intro. Only 2 of 5 pieces existed (`TutorialState.ts`, and a simpler unspecced `TutorialPopups.ts` covering 12 concepts as center-screen "OK"-dismissed popups, no highlighting, no scripted intro).

Two scope calls confirmed with Till before starting (via `AskUserQuestion`, since both affect what ships, not just how):

1. Level 1 has no floor Collectible and no empty matrix slot — the doc's original Calibration script assumes both. **Scripted around `level_01.json`'s real content instead of redesigning the level** (no solver re-proof risk on a foundational level).
2. **All 12 existing popups converted to the new highlighting**, not just the new intro — the larger of two offered options.

## 2. What Was Built

- **`src/tutorial/concepts.ts`** — the registry: 17 `ConceptDef`s (the original spec's list minus `THRESHOLD`, cut from the game entirely in SPRINT_026, plus 5 new: `MOVE`, `AP_POOL`, `EXIT_SEQUENCE`, `DEAD_END`, `RESONANCE` — real gaps that had zero explanation before this sprint). Each entry is a trigger predicate, title/body, a `focus` target (what to highlight), and an optional `blocking` factory (state-diff completion check).
- **`src/tutorial/TutorialOverlay.ts`** — dim/frame/arrow presentation, pure DOM/SVG (not a Pixi layer): an SVG mask cuts a hole in a dimming rect at the target rect(s), a pulsing bordered rect frames them, a dashed line connects the explanation box. Targets resolve via `PixiDriver.hexToScreenA/B` (board hexes), `getBoundingClientRect` (DOM panels), or three new geometry helpers in `MatrixRenderer.ts` (`cellRect`, `insertArrowRect`, `matrixPanelRect`, mirroring the existing `scrapPileRect`). z-index above every other panel including `LevelCompleteScreen`/`NeuralCollapseScreen`.
- **`src/tutorial/TutorialDirector.ts`** — replaces `TutorialPopups.ts`. Picks Level-1 script mode vs. reactive mode, drives blocking (wait for the actual action) vs. non-blocking (8s timeout or Enter) per concept, and implements the doc's hold-ESC skip affordance. Runs from `main.ts`'s `uiHook`, same slot `TutorialPopups` occupied — deliberately not added to `pipeline.ts`'s `runCoreSystems` (read-only, per-client, presentation-only, same reasoning that already keeps `RenderSystem` outside the deterministic tick pipeline).
- **`src/tutorial/calibration.ts`** — the Calibration sequence as data (`ConceptId[]`), reusing `concepts.ts`'s own definitions rather than duplicating text: `MOVE → AP_POOL → UNLOCK_NODE → JUMP (already pre-routed in level_01) → EXIT_SEQUENCE`.
- **Completion detection is a state-diff snapshot/compare, not message interception.** Traced `pipeline.ts` + every consuming system (`MovementSystem`, `MatrixInsertSystem`, `MatrixRotateSystem`, `ScrapPoolSystem`): each splices its own message out of `pendingInputs` in the same tick it's processed, so there's no end-of-tick point where "an action was just processed" is observable as a message without touching all of them. Blocking concepts instead snapshot the relevant ECS/state value when the step starts (e.g. a conduit's `rotation`, an avatar's `Position`, inventory length, Scrap Pool count) and compare live each frame — zero changes to any core system. Blocking is used only where the local player alone completes the step; partner-dependent or anticipatory concepts (`UNLOCK_NODE`, `FOCUS_VAULT`, the four "ability exists in the matrix" briefings, etc.) stay non-blocking, per the doc's own 8-second timeout fallback — a hard block on either could stall waiting for something not yet imminent.
- Small additive instrumentation: `HUD.ts` gained two `data-tutorial-target` attributes on already-stable DOM nodes (the AP vial row, the Dead End indicator) — no structural change, since those nodes only get their `innerHTML`/`display` rebuilt each frame, never recreated.

## 3. Scope Cuts (disclosed)

- **No i18n.** Every other UI string in this codebase is hardcoded English; the tutorial isn't the exception this sprint. Text stays as plain data in `concepts.ts`/`calibration.ts`, already "data not code" per the doc's own §5.1 requirement — a future pass can retrofit key/value lookups.
- **No generic `TutorialTrigger` ECS component / level-JSON-driven triggers.** Every concept, old and new, is a plain TypeScript predicate against existing queries — exactly how all 12 original concepts already worked. The component would only pay for itself if a level designer needed ad-hoc JSON-authored triggers without code, which nothing today needs.
- **No true input-lock during blocking steps.** The overlay dims/frames and won't advance until the right thing happens, but stray input elsewhere isn't swallowed at the listener level (would mean touching `KeyboardInput.ts`/`MouseInput.ts`). Level 1's Calibration board is simple enough that this is harmless.
- **Narrative cutscene panels are untouched** — a separate, still-entirely-unbuilt system (`narrative.md §5`, needs real panel art + a cutscene player), not implied by anything in this sprint despite `tutorial_design.md`'s fiction referencing the same "Monitor" narrator.

## 4. Verification

- `npx tsc --noEmit`, `npm run build`: clean.
- `npx vitest run`: 18/18 (14 previous + 4 new — `src/tutorial/__tests__/concepts.test.ts` covers the MOVE/INSERT/ROTATE/SCRAP_DRAW blocking predicates against the real system pipeline, same pattern `resonance.test.ts`/`guestSync.test.ts` already use). Full DOM-rendering coverage intentionally not added, consistent with this codebase's existing convention of not unit-testing presentation classes.
- Found and fixed one test-only bug while writing these: `concepts.ts`'s predicates import `world` from `@/gameLoop` directly (same pattern `LegendPanel.ts` already uses, since UI-layer classes driven from `uiHook()` have no other way to reach the current world) — correct in the real app because `main.ts` calls `setWorld()` after every `loadLevel()`, but a test that calls `loadLevel()` directly must do the same or the static import stays stale. Fixed in the test helper, not the production code.
- `npm run validate:levels`: level_01.json is unchanged, run as the standing safety net regardless.

## 5. Post-Completion Fixes (from Till's own playthrough, same day)

- **Non-blocking boxes no longer time out.** The doc's 8-second auto-dismiss (§3.5) read as "disappears before I finish reading" in practice. Removed entirely — every box, blocking or not, now requires an explicit dismissal (the described action, or a click/Enter). `TutorialDirector.ts` dropped its `shownAt`/timeout tracking rather than just lengthening it.
- **Multiple simultaneous targets.** `EXIT_SEQUENCE` in local mode (both boards visible, both exits relevant) exposed a real gap: `TutorialOverlay.ts` was already framing every rect a concept's `focus` resolved to, but only drew ONE connector line, to the first — reading as "one thing explained, one unexplained." Fixed to draw a frame *and* a line per target. Generalized `UNLOCK_NODE`/`FOCUS_VAULT`/`ECHO_TILE` in `concepts.ts` to highlight ALL untriggered/present instances too, not just the first found (`level_21` needs two Shared Unlocks simultaneously — this was silently under-highlighting it before).

## 6. Open / Next

- The other 12 concepts' focus targets were assigned reasonable but not exhaustively play-tested positions (e.g. `RESONANCE`'s coarse "whole matrix panel" cue, since exact base-pair cells are dynamic). Worth a real playthrough pass once art/UI polish resumes.
- Decal/conduit-art gaps and the remaining post-MVP mechanic proposals (`mechanic_roadmap.md`) are unrelated to this sprint and still open.
