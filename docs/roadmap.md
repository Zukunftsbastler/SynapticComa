# Project Roadmap: Sensible Next Steps

**As of:** 2026-07-21 (SPRINT_020). **Purpose:** a single forward-looking view across the whole project — engineering debt, team decisions, content, and the larger unbuilt initiatives — gathered from this session's audits (`mechanic_roadmap.md`) and a fresh sweep of what's actually in the repo versus what the docs describe. **This is a planning document, not a build plan** — nothing here is implemented by writing it.

---

## 0. The Pattern Worth Naming First

Four separate times now, a system has turned out to be **fully specified in `docs/` and not built at all**, discovered only by checking the source directly rather than trusting the doc:

| System | Spec lives in | What actually exists |
|---|---|---|
| Neuro-Resonance | `mechanics.md §4.5` (found: `mechanic_roadmap.md` F1) | Nothing — no `Conduit.base`, no `ResonanceSystem` |
| Threshold (post-removal) | `mechanics.md §5.2`, `architecture.md §5.2`, `narrative.md §4` | Nothing shipped — stripped from every level in SPRINT_013 |
| The Monitor (tutorial) | `tutorial_design.md §3–5` — 5-file architecture, scripted Level-1 intro, dim/frame/arrow presentation | 2 of 5 files (`TutorialPopups.ts`, `TutorialState.ts`) — a simpler, working, but structurally different popup mechanism |
| Narrative delivery | `narrative.md §5` — opening panels, between-level panels at levels 1/3/5/8/11/15 (`decisions_needed.md` D13) | Nothing — no `CutsceneMod` player, no panel system, `public/cutscenes/` is empty |
| The Generator | `generative_levels.md §3` — full reverse-design pipeline for "The Deep Coma" endless mode + "Daily Synapse" | Nothing — `src/generation/` holds only the Solver, DifficultyModel, and WitnessReplay |

None of these are secrets — SPRINT logs and `decisions_needed.md` reference most of them as "next planned" going back to SPRINT_007. But a doc that describes unbuilt work in the present tense reads as done, and that's precisely how the Resonance/Threshold-table confusion happened (SPRINT_019). **Recommendation before anything else below:** a single pass marking every doc section describing an unbuilt system with the same explicit status note used for Resonance now (`mechanics.md §4.5`'s "specified, not yet implemented" banner) — cheap, and it stops the pattern from recurring a fifth time.

---

## 1. Foundational Gaps

**No automated tests exist anywhere in the project** (`find . -iname "*.test.ts"` — zero hits; `package.json` has no test runner dependency). The entire correctness story rests on one pipeline: the solver's proof + witness-replay through the real systems (`validate:levels`), which is excellent for *levels* but says nothing about `NetworkSystem`, `GuestSyncSystem`, UI components, or any system exercised only by a human clicking around. `WitnessReplay.ts` already proves headless Node execution of the full system pipeline works cleanly (`systems/pipeline.ts`) — the infrastructure to write real unit/integration tests already exists, unused for anything but level proofs. **Suggested first step:** a handful of tests reusing that exact pattern for the highest-risk untested surface — Guest-side network sync (see next point).

> **Status update (SPRINT_022):** Done for the highest-risk surface. `vitest` added (`npm test`), and `src/systems/__tests__/guestSync.test.ts` covers all six Host→Guest message types (`STATE_UPDATE`, `MATRIX_STATE_UPDATE`, `AP_UNLOCK`, `FOCUS_VAULT`, `COLLECTED` including the collection-privacy boundary, `INVENTORY_UPDATE`, `PHASE_UPDATE`) using the same headless-pipeline technique as `WitnessReplay.ts`. All seven tests passed against the *existing* Guest-sync code without finding a bug — a genuinely reassuring result, not just a clean bill of health by omission (every initial test failure traced back to arithmetic in the test itself, not the system under test). Still open: this covers the message-application logic, not real two-process/PeerJS transport, and no UI-layer code has any test coverage yet.

**Guest-side networking is effectively unverified.** Flagged in SPRINT_016 ("Replay currently exercises the Host path... Guest-side mirroring is untested here") and unchanged since. Every mechanic shipped this session (Impulse Blocks, Focus Vault) was hand-verified Host-side only; Focus Vault in particular ships a brand-new `FOCUS_VAULT` network message that has never been exercised end-to-end across two real clients. This is the single highest-risk gap for actual 2-player play breaking silently.

**Zero real art assets.** `public/sprites/` and `public/ui/` contain only `.gitkeep`; every visual is a hardcoded procedural color in `RenderSystem.ts`'s `ENTITY_COLORS` map (25 sprite IDs and counting). Not blocking further mechanic work — the placeholder-flats approach has scaled fine through 23 levels — but it's a growing, undifferentiated pile that will eventually need a dedicated pass, and `SpriteRegistry.SPRITE_PATHS` already points at asset paths nothing serves.

---

## 2. Team Decisions Still Waiting (not mine to make)

* **D14 — Role asymmetry** (`decisions_needed.md`): open since SPRINT_013, restated in SPRINT_017's notes, untouched since. This is the largest pending design fork in the project — it reshapes the core loop and needs Till, Andreas, and Chris together, per the document's own consensus rule.
* **🔢 Slack-band drift, levels 7/9/13/14/15** (SPRINT_014 finding): these sit at the "brutal" fairness floor (slack 1) rather than SPRINT_007's original 3–5 target. Never revisited.
* **🔢 Difficulty-model weight vector** (`DifficultyModel.DEFAULT_WEIGHTS`): flagged as needing Chris's review since SPRINT_007, sharpened by SPRINT_017 (D score likely underweights dependency-chain length and toggle mechanics) and now further complicated by Focus Vault (optional content the model doesn't — and by design *shouldn't* — see at all). Worth a real pass now that there's more data (23 levels) to calibrate against.
* **Resonance and Threshold: "deferred" is not a decision.** Both are formally marked unimplemented rather than silently claimed, which was the urgent fix — but *build it* vs. *cut it from the docs permanently* is still an open call sitting unmade. Cheap to keep deferring; expensive to keep re-explaining to whoever reads the docs next.

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
- **Echo Tiles** (#3) — pure information display (a temporary rendering of the far board's layout); doesn't change what's reachable or costly, so the solver never needs to model it, same as Focus Vault.
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
2. **The Threshold arc.** Fully speced, fully stripped, unassigned to any level since SPRINT_013. `level_design.md` already suggests this belongs as "a future dedicated arc rather than a retrofit" onto the existing levels 11–15 — a good candidate for levels 24+.
3. **Narrative delivery.** D13 already decided *which* levels get panels; nothing renders them. Lower urgency than the mechanics above (doesn't block gameplay), but it's the most-decided, least-built piece in the whole project — a design question that's already been answered and is just waiting on an implementer.
4. **The Generator ("Deep Coma" / "Daily Synapse").** The single largest unbuilt promise by volume of spec (`generative_levels.md §3` is a full reverse-design pipeline). Naturally sequenced *after* a few more of §4's mechanics ship, since the generator needs to know how to place whatever exists — but it's also the biggest standalone value unlock left (unbounded replayability vs. a fixed 23-level campaign). Worth scoping as its own multi-sprint arc once the mechanic set feels reasonably stable.

---

## 6. If Only Five Things Happen Next

In rough priority order, mixing urgency and low effort:

1. **Guest-side network test pass** (§1) — highest silent-failure risk, and the tooling to test it headlessly already exists.
2. **Mark every unbuilt-but-documented system explicitly** (§0) — an afternoon, prevents the next contributor from repeating the Resonance/Threshold confusion a fifth time.
3. **Resolve D14** (§2) — the team's own consensus rule says this blocks the biggest pending design fork; it's not getting easier by waiting.
4. **One more cheap mechanic** (§4: Static Field or Echo Tiles) — keeps content momentum without reopening the solver-extension cost of Push.
5. **Decide Resonance and Threshold's fate** (§2) — build or formally cut; either answer is fine, "still deciding" three sprints running is the actual problem.
