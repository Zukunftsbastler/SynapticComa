# SPRINT 023: Mark Every Unbuilt-but-Documented System Explicitly

**Status:** ✅ Completed 2026-07-21
**Trigger:** Till: 2nd of the five roadmap-priority sprints (`docs/roadmap.md` §6). No design decision required — pure documentation-accuracy work implementing §0's own recommendation.

---

## What Was Done

Added an explicit "not yet implemented" status banner, matching the pattern already established for Neuro-Resonance (`mechanics.md §4.5`, SPRINT_019) and Threshold (`level_design.md`, SPRINT_019/020), to the three remaining systems `docs/roadmap.md` §0 identified as fully specified but unbuilt:

- **`tutorial_design.md`** — banner at the top names the gap precisely: 2 of the 5 architecture files exist (`TutorialState.ts`, plus a simpler unspecced `TutorialPopups.ts` standing in for `concepts.ts`/`TutorialTriggerSystem.ts`/`TutorialDirector.ts`/`TutorialOverlay.ts`), and the scripted Level-1 "Calibration" guided intro was never built. Points readers to `TutorialPopups.ts`'s own header comment as the accurate current-state source.
- **`narrative.md §5`** — banner notes no panel-display system or cutscene player exists (`public/cutscenes/` is empty) despite `decisions_needed.md` D13 already having decided which levels get panels. Also caught and flagged, while in the area: §5.2's "across all 15 MVP levels" is now stale (campaign is 23 levels as of SPRINT_020; the panel schedule was never revisited for 16–23).
- **`generative_levels.md`** — banner at the top and a second marker directly on the `## 3. The Generator` heading: the Solver and Difficulty Scorer (§2, §4) are real and load-bearing (`validate:levels` uses them every run), but the Generator (§3) — the reverse-design pipeline, "Deep Coma" endless mode, "Daily Synapse" — is entirely unbuilt; `src/generation/` holds only three files, none of them a generator. The pipeline diagram's claim "all three modules live in `src/generation/`" was directly false and corrected. Same status note mirrored onto `level_design.md §6`, which described the same unbuilt feature from the design-contract side.

## Scope Discipline

Documentation-only, as instructed. No code changed, no design decisions made — every edit describes what already exists (or doesn't) rather than deciding what should.

## Verification

N/A — no code touched; nothing to build or test.

## Open / Next

Three of five roadmap-priority sprints remain: D14 and the Resonance/Threshold fate both require a design decision and will be raised as such (see the next sprint entries); one more cheap mechanic (Static Field or Echo Tiles) is pure engineering, no decision needed.
