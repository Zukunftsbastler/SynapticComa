# Project Roadmap: Sensible Next Steps

**As of:** 2026-07-21 (SPRINT_020). **Purpose:** a single forward-looking view across the whole project — engineering debt, team decisions, content, and the larger unbuilt initiatives — gathered from this session's audits (`mechanic_roadmap.md`) and a fresh sweep of what's actually in the repo versus what the docs describe. **This is a planning document, not a build plan** — nothing here is implemented by writing it.

---

## 0. The Pattern Worth Naming First

Four separate times now, a system has turned out to be **fully specified in `docs/` and not built at all**, discovered only by checking the source directly rather than trusting the doc:

| System | Spec lives in | What actually exists |
|---|---|---|
| ~~Neuro-Resonance~~ | `mechanics.md §4.5` (found: `mechanic_roadmap.md` F1) | **Built, SPRINT_026** — `Conduit.base`, `ResonanceSystem`, solver support; level 26 "First Spark" |
| ~~Threshold (post-removal)~~ | `mechanics.md §5.2`, `architecture.md §5.2`, `narrative.md §4` | **Cut, SPRINT_026** — dead code (`ThresholdSystem` et al.) deleted entirely, not just left unbuilt |
| The Monitor (tutorial) | `tutorial_design.md §3–5` — 5-file architecture, scripted Level-1 intro, dim/frame/arrow presentation | 2 of 5 files (`TutorialPopups.ts`, `TutorialState.ts`) — a simpler, working, but structurally different popup mechanism |
| Narrative delivery | `narrative.md §5` — opening panels, between-level panels at levels 1/3/5/8/11/15 (`decisions_needed.md` D13) | Nothing — no `CutsceneMod` player, no panel system, `public/cutscenes/` is empty |
| The Generator | `generative_levels.md §3` — full reverse-design pipeline for "The Deep Coma" endless mode + "Daily Synapse" | Nothing — `src/generation/` holds only the Solver, DifficultyModel, and WitnessReplay |

None of these are secrets — SPRINT logs and `decisions_needed.md` reference most of them as "next planned" going back to SPRINT_007. But a doc that describes unbuilt work in the present tense reads as done, and that's precisely how the Resonance/Threshold-table confusion happened (SPRINT_019). **Recommendation before anything else below:** a single pass marking every doc section describing an unbuilt system with the same explicit status note used for Resonance now (`mechanics.md §4.5`'s "specified, not yet implemented" banner) — cheap, and it stops the pattern from recurring a fifth time.

> **Status update (SPRINT_023):** Done — all five rows in the table above now carry an explicit status banner at their doc's relevant section (`tutorial_design.md`, `narrative.md §5`, `generative_levels.md` + its mirror in `level_design.md §6`; Resonance and Threshold were already marked in SPRINT_019/020). This closes the recommendation, not the underlying gaps — none of the five systems got any closer to existing, only more honestly described.

---

## 1. Foundational Gaps

**No automated tests exist anywhere in the project** (`find . -iname "*.test.ts"` — zero hits; `package.json` has no test runner dependency). The entire correctness story rests on one pipeline: the solver's proof + witness-replay through the real systems (`validate:levels`), which is excellent for *levels* but says nothing about `NetworkSystem`, `GuestSyncSystem`, UI components, or any system exercised only by a human clicking around. `WitnessReplay.ts` already proves headless Node execution of the full system pipeline works cleanly (`systems/pipeline.ts`) — the infrastructure to write real unit/integration tests already exists, unused for anything but level proofs. **Suggested first step:** a handful of tests reusing that exact pattern for the highest-risk untested surface — Guest-side network sync (see next point).

> **Status update (SPRINT_022):** Done for the highest-risk surface. `vitest` added (`npm test`), and `src/systems/__tests__/guestSync.test.ts` covers all six Host→Guest message types (`STATE_UPDATE`, `MATRIX_STATE_UPDATE`, `AP_UNLOCK`, `FOCUS_VAULT`, `COLLECTED` including the collection-privacy boundary, `INVENTORY_UPDATE`, `PHASE_UPDATE`) using the same headless-pipeline technique as `WitnessReplay.ts`. All seven tests passed against the *existing* Guest-sync code without finding a bug — a genuinely reassuring result, not just a clean bill of health by omission (every initial test failure traced back to arithmetic in the test itself, not the system under test). Still open: this covers the message-application logic, not real two-process/PeerJS transport, and no UI-layer code has any test coverage yet.

**Guest-side networking is effectively unverified.** Flagged in SPRINT_016 ("Replay currently exercises the Host path... Guest-side mirroring is untested here") and unchanged since. Every mechanic shipped this session (Impulse Blocks, Focus Vault) was hand-verified Host-side only; Focus Vault in particular ships a brand-new `FOCUS_VAULT` network message that has never been exercised end-to-end across two real clients. This is the single highest-risk gap for actual 2-player play breaking silently.

**Zero real art assets.** `public/sprites/` and `public/ui/` contain only `.gitkeep`; every visual is a hardcoded procedural color in `RenderSystem.ts`'s `ENTITY_COLORS` map (25 sprite IDs and counting). Not blocking further mechanic work — the placeholder-flats approach has scaled fine through 23 levels — but it's a growing, undifferentiated pile that will eventually need a dedicated pass, and `SpriteRegistry.SPRITE_PATHS` already points at asset paths nothing serves.

---

## 2. Team Decisions Still Waiting (not mine to make)

* **D14 — Role asymmetry** (`decisions_needed.md`): ~~open since SPRINT_013~~ **resolved 2026-07-21, SPRINT_024** — Till, informed that the document's own rule names all three as owner, chose to decide alone (precedent: SPRINT_018). Shipped a scoped-down Option C (per-ability-node restriction, not per-source-row) rather than any option as originally written, specifically because a full A/B/C would have required re-verifying or redesigning all 23 existing levels — the scoped version is provably backward-compatible instead. Andreas and Chris have not signed off; flagged in `decisions_needed.md` for their review.
* **🔢 Slack-band drift, levels 7/9/13/14/15** (SPRINT_014 finding): these sit at the "brutal" fairness floor (slack 1) rather than SPRINT_007's original 3–5 target. Never revisited.
* **🔢 Difficulty-model weight vector** (`DifficultyModel.DEFAULT_WEIGHTS`): flagged as needing Chris's review since SPRINT_007, sharpened by SPRINT_017 (D score likely underweights dependency-chain length and toggle mechanics) and now further complicated by Focus Vault (optional content the model doesn't — and by design *shouldn't* — see at all). Worth a real pass now that there's more data (23 levels) to calibrate against.
* ~~**Resonance and Threshold: "deferred" is not a decision.**~~ **Resolved 2026-07-21, SPRINT_026** (D15, `decisions_needed.md`) — Till decided alone, same authorization pattern as D14. Resonance built (scoped down: `Conduit.base` defaults to NONE, byte-identical for all 25 pre-existing levels); Threshold cut entirely (dead code removed, not just left unbuilt). Andreas/Chris have not signed off; flagged for their review.

---

## 3. Small, Well-Scoped Engineering Debt (no design decision needed)

* Harmless duplicate-entity bugs in a few level JSONs (walls/hazards placed twice at identical coordinates — `EntityRegistry.register` silently overwrites, so no runtime effect, just sloppy source). Flagged across SPRINT_017/019, never cleaned up. A 20-minute pass.
* `LevelSolver.ts`'s `isPushDestinationBlocked` has no board-edge check, faithfully mirroring a real gap in `PushSystem.isPushDestinationClear` (SPRINT_020) — level 22 was designed around never triggering it, but the underlying engine gap is real and would matter the moment a level pushes a block toward the board boundary.
* `architecture.md §4`'s pipeline diagram was corrected in SPRINT_020 to match `systems/pipeline.ts`, but `TutorialTriggerSystem`'s listed existence was never independently verified (and per §1 above, likely doesn't exist as described). `digital_implementation.md §5.4`'s canonical level-JSON example still predates the schema (annotated, not rewritten).

---

## 4. Content: The Remaining 8 Mechanics

`mechanic_roadmap.md` Part 2 proposed ten; two shipped (Impulse Blocks, Focus Vault — SPRINT_020). Having now actually built one solver-invisible mechanic (Focus Vault: cheap) and one that needed real solver extension (Impulse Blocks: expensive), the remaining eight can be re-ranked with real information instead of a guess:

**Likely cheap** (probably solver-invisible or UI-only, following the Focus Vault pattern):
- **Static Field** (#9) — a chat-suppression zone touches nothing about passability, hazards, or AP; purely a UI-layer restriction. Possibly the cheapest item on the entire original list of ten.
- ~~**Echo Tiles** (#3)~~ — **done, SPRINT_025** (level 25 "Thin Place"). Turned out cheaper than estimated: reused the existing `revealBothDims` local-testing flag instead of a new renderer.
- **Short Circuit** (#7) — if shipped as a single scripted set-piece with generous AP margin around it (never the *only* path to solving), it can stay outside the solver's model entirely, same reasoning as Focus Vault.

**Genuinely need solver work** (something about passability, cost, or timing changes):
- **Bruised Fragments** (#6) — `Health.max` already exists in the component, but a level where "you can survive one hit" is part of the *required* solution needs the solver's `isBlocked` to model a health/retry state, not just instant-fail on `alwaysLethal`. Shippable cheaply as *non-load-bearing* flavor first (a safety margin nobody's forced to use), same trick as Focus Vault, deferring the expensive version.
- **Pulse Gates** (#4) and **Synaptic Fatigue** (#1) — both introduce a genuinely new axis (elapsed-time/tick-based state) the solver has never modeled. Comparable in kind to the Push extension (SPRINT_020) but a new dimension, not a reuse of it — expect similar effort to what Impulse Blocks took.
- **Scar Tissue** (#5) — one-way persistent world mutation; cheap if shipped decorative/optional, expensive the moment a level requires "this hex only unseals once, on purpose."
- **Convergence Nodes** (#10) — needs `MatrixRoutingSystem` to recognize a node fed by two different ability sources and the solver's `poweredAbilities()` to match; a real but bounded extension, roughly comparable to adding a new ability type.

**Recommendation:** Static Field or Echo Tiles as the next pick — same "cheap, safe, ships fast" logic that made Impulse Blocks/Focus Vault the right first two, still unranked beyond that per the roadmap's original note (a taste call for the team).

---

## 5. Bigger Structural Initiatives (multi-sprint)

Roughly in the order they unblock each other, not a strict sequence:

1. **A real Tutorial "Monitor" system, or a formal descope.** Every mechanic shipped this session got a hand-written ad-hoc popup (`TutorialPopups.ts`) rather than the generic, data-driven concept registry `tutorial_design.md` describes. That's worked so far (10 concepts, still readable) but doesn't scale forever, and the scripted Level-1 "Calibration" guided intro — meant to teach the core loop before any level-specific mechanic — was never built at all. Decide: invest in the real architecture now (it *is* the more maintainable long-term shape), or formally shrink the spec to match the popup-list reality.
2. ~~**The Threshold arc.**~~ **Moot — cut, SPRINT_026.** Formally removed rather than built; see D15 in `decisions_needed.md`.
3. **Narrative delivery.** D13 already decided *which* levels get panels; nothing renders them. Lower urgency than the mechanics above (doesn't block gameplay), but it's the most-decided, least-built piece in the whole project — a design question that's already been answered and is just waiting on an implementer.
4. ~~**The Generator ("Deep Coma" / "Daily Synapse").**~~ **v1 done (SPRINT_029), v2 done (SPRINT_030, 2026-07-24)** — `LevelGenerator.ts` + `scripts/generateLevel.ts`, now chaining up to two simultaneous required core abilities with a scaling `gridRadius` (`generative_levels.md §3.0` discloses the cuts vs. the full spec), genuinely solver/replay/real-browser-verified end to end. SPRINT_029 also closed a real, self-flagged gap: neither prior solvability gate touched the DOM at all — a new Playwright-based real-browser check (`e2e/`) now does, wired into the Generator's own acceptance gate. Batch 1 (v1, levels 30-39) plateaued around D≈6.2; Batch 2 (v2, levels 40-49) reaches D≈7.8 by breaking past the single-ability ceiling. Still open: endless mode/Daily Synapse's live delivery (separate decision, no backend server exists), arbitrary N-ability topology beyond 2, `gridRadius`>5, JUMP/PUSH/PHASE_SHIFT hex-layout support, 🔢 Chris's calibration of the margin/difficulty curve.
5. **The Body — a meta-progression layer (concept, 2026-07-23, rescaled to 100 levels 2026-07-23b).** `docs/body_awakening.md` — the patient's body wakes up region-by-region as levels are completed (dense, guaranteed story beats in the first 10 levels; ~13 regions total across a planned 100-level campaign), with a late-game soft fork (Id/motor vs. Superego/perception) gating the final Head/Consciousness unlock. Proposed as D16 in `decisions_needed.md`, unresolved. Biggest cost drivers are story-variant art volume and the 29→100 level content jump itself, not engineering — the design reuses existing patterns end to end (plain `ProgressionState`-style state, existing DOM-overlay UI convention, `MatrixRenderer`/`TutorialOverlay`'s rect+mask pattern for region highlighting, zero new ECS components).

---

## 6. If Only Five Things Happen Next

In rough priority order, mixing urgency and low effort:

1. **Guest-side network test pass** (§1) — highest silent-failure risk, and the tooling to test it headlessly already exists.
2. **Mark every unbuilt-but-documented system explicitly** (§0) — an afternoon, prevents the next contributor from repeating the Resonance/Threshold confusion a fifth time.
3. ~~**Resolve D14**~~ Done (SPRINT_024) — Andreas/Chris review still outstanding.
4. ~~**One more cheap mechanic**~~ Done (SPRINT_025, Echo Tiles) — Static Field remains a candidate, though note it currently has no observable effect in-game: `ChatUI` is a complete, working class that's simply never instantiated in `main.ts` (found while scoping this item) — worth fixing before Static Field would be visible to anyone.
5. ~~**Decide Resonance and Threshold's fate**~~ Done (SPRINT_026) — Resonance built (scoped down), Threshold cut. Andreas/Chris review still outstanding (D15).

All five items of this list are now done. `SPRINTS/README.md` and the next planned-work note there are the place to look for what comes after it.
