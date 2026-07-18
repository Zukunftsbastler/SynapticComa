# SPRINT 004: Design Integration — Andreas's Concept, Generative Levels & The Monitor Tutorial

**Status:** ✅ Completed 2026-07-18 (documentation sprint — no code changes)
**Trigger:** Till's decisions of 2026-07-18. Andreas confirmed **D1: the DDG is design input for the same game**, not a separate project. Till resolved the remaining open decisions to unblock development, with the stated goals: a demanding but mass-compatible game, mathematical elegance in the underlying algorithms, high replayability through generative content, a continuously rising difficulty curve, and a fine-grained, narrative-integrated tutorial.

---

## 1. Decisions Made & Why

### 1.1 Repository hygiene
- **Flattened the doubled directory** (`SynapticComa/SynapticComa/` → repo now lives at the workspace root). The nesting was an artifact of the initial clone and served no purpose.
- **README.md reduced to a lean entry point** (description, docs index, setup, controls, dev commands). It previously duplicated large parts of `docs/` — including a fully outdated description of the removed round-based AP system — making it a second, conflicting source of truth. The campaign table moved to `level_design.md §5`; the dev recipes moved to `project_overview.md §6`. **Why:** one source of truth per fact; the docs are the specification (`project_overview.md §7`).
- Removed 11 redundant `.gitkeep` placeholders from directories that contain real files.

### 1.2 SPRINT_003 completed (Tasks 3–7 + missed spots)
The persistent-AP documentation refactor was only half-applied (Tasks 1–2). Tasks 3–7 are now applied exactly as specified, plus fixes the sprint had missed — see the completion note in `SPRINT_003-AP-System-Refactor.md`. The docs are now **uniformly on the persistent-AP model**. The code still implements the old round system; that gap is closed by SPRINT_005 (see §4).

### 1.3 Integration of Andreas's concept (D1)
From `docs/Archive/Temp_DDG.md` / `Temp_Matrix_Art.md`, three ideas were judged the most promising and integrated; the rest was consciously set aside:

| Andreas's idea | Integrated as | Why this and not more |
|---|---|---|
| **Ordered base pairing** (AT ≠ TA; "order matters") | **Neuro-Resonance** (`mechanics.md §4.5`): every conduit plate carries one of four neurotransmitter bases; vertically adjacent plates in a conduit column form *ordered* pairs with distinct effects (Discharge +1 AP, Dampening, Clarity, Anchor). Introduced at Level 6. | It layers cleanly *on top of* the existing routing puzzle instead of replacing it — every insert becomes a two-layer decision (topology + chemistry). This is the "endorphin" mechanic: chained pair formations produce visible, immediate rewards. |
| **Shared mutation** ("every insertion reshapes everyone's DNA") | Already structurally present in the column slide; now amplified: a slide simultaneously re-routes power *and* rewrites the column's base sequence, re-evaluated by `ResonanceSystem` after every mutation. | The principle "no matrix action is ever local" is now explicit design language (`mechanics.md §4.5`). |
| **Abilities emerge from structure** | The two-layer model: routing grants abilities, pairing grants resonances. | Preserves Andreas's core vision inside the existing architecture. |
| *Set aside:* cell types (kidney/lung/…), literal A/T/C/G biology, 2×6 grid, x-player scaling | — | The coma/psyche narrative and the 5×5 dual-conduit matrix are further developed and mechanically richer; player scaling is deferred (D2). Bases are re-themed as neurotransmitters to fit the neural setting. |

### 1.4 Generative levels & algorithmic core (new: `docs/generative_levels.md`)
**Decision:** hand-crafted Levels 1–15 remain the narrative spine; beyond them, levels are generated with a **mathematical solvability guarantee** (endless "Deep Coma" mode + "Daily Synapse" shared daily seed).

Chosen algorithms — selected for elegance *and* reuse:
- **A\*/IDA\*** solver over the abstract game state with an admissible heuristic (relaxed hex distance + matrix lower bound); blind Scrap-Pool draws handled adversarially (worst-case order), so "provably solvable" is honest.
- **Zobrist hashing** for O(1) incremental state deduplication in the solver.
- **PCG32** with forkable streams for full determinism — the Host sends only a seed; both clients generate bit-identical levels.
- **Wave Function Collapse** for cosmetic terrain decoration only.
- **One reachability core, three consumers:** generation proof, build-time campaign validation (`validate:levels`), and the runtime Dead End check.

This also *resolves* D3 elegantly: `initialAP = optimalCost + margin(difficulty)` — the starting AP is computed from the solver's proof, not guessed. Difficulty is a weighted score over solver outputs with a logarithmic target curve for endless mode (`D_target(n) = D₁₅ + k·log₂(1 + n − 15)`): perceptibly rising, flattening into depth rather than size.

### 1.5 Tutorial layer (new: `docs/tutorial_design.md`)
**Decision:** a modular, trigger-driven tutorial called **The Monitor** — the hospital's bedside machine is the single voice allowed to use text ("the mind is wordless; the machine watching it is not"). This resolves the tension between the language-agnostic board and Till's requirement for explicit textual guidance: game pieces stay text-free; the diegetic CRT overlay is localizable.

Key properties, matching Till's requirements point by point:
- **Central elements defined** as a Concept Registry (15 concepts, each explained exactly once, re-readable).
- **Detection:** a read-only `TutorialTriggerSystem` (proximity triggers via a `TutorialTrigger` component + state predicates) fires when an explanation-worthy element first appears.
- **Highlighting:** screen dims, the target control gets an animated frame, an explanation box (what it is → what it does → what to do next) connects to the target with a drawn arrow; blocking steps advance only when the described action is performed.
- **Scripted guided passage:** Level 1 opens with "Calibration" — an extremely guided sequence exercising every core control, defined as a JSON step script (`tutorial_calibration.json`), so steps for future mechanics can be inserted without code changes.
- Tutorial state is local per client, persisted in `localStorage`, never networked.

### 1.6 Open decisions resolved (D2–D13)
All resolutions are recorded in the status block of `docs/decisions_needed.md`, including which numbers remain open for **Chris's balance review** (margin curve, unlock values, difficulty weights, resonance/AP interaction). Structures are fixed; numbers are Chris's.

---

## 2. Files Changed in This Sprint

| File | Change |
|---|---|
| `docs/mechanics.md` | §2 table row for Resonance; new §4.5 Neuro-Resonance; §5/§7 round-leftover fixes |
| `docs/level_design.md` | Campaign table (moved from README, levels 3/6/10 redefined); new §6 Generative Levels; wording fixes |
| `docs/generative_levels.md` | **New** — solver, generator, difficulty model spec |
| `docs/tutorial_design.md` | **New** — The Monitor tutorial spec |
| `docs/architecture.md` | `Conduit.base`, `TutorialTrigger`, `ResonanceSystem`, `TutorialTriggerSystem`, new §6 Non-ECS Modules |
| `docs/digital_implementation.md` | SPRINT_003 Task 3 + `/generation`, `/tutorial` structure, real level JSON schema (D11), sprint steps 14–16 |
| `docs/implementation_plan.md` | SPRINT_003 Task 4 (incl. Sprint 4b) + leftover fixes + D11 schema |
| `docs/communication_rules.md` | SPRINT_003 Task 5 |
| `docs/open_questions.md` | SPRINT_003 Task 6 |
| `docs/art_and_ui.md` | SPRINT_003 Task 7 |
| `docs/project_overview.md` | Pipeline fix, docs index, Common Recipes (from README) |
| `docs/decisions_needed.md` | Resolution status block (D1–D13) |
| `docs/narrative.md` | Neurotransmitter framing; §5.2b The Monitor |
| `README.md` | Rewritten as lean entry point |
| `SPRINTS/SPRINT_003-…` | Tasks 3–7 checked; completion note |

---

## 3. What This Sprint Did NOT Do

- **No code was changed.** `src/` still implements the round-based AP system (`RoundSystem`, `RoundState`, `PASS`, `AP_DEFAULT = 4`) and none of the new systems. The docs now lead the code by design — closing that gap is SPRINT_005.
- Andreas's multi-player scaling (D2) and the physical edition as a product (D12) are consciously deferred, not rejected.
- No balance numbers are final: every 🔢-flagged value awaits Chris.

---

## 4. Next Sprints (proposed order)

1. **SPRINT_005 — Code Refactor: Persistent AP.** Remove `RoundSystem`/`RoundState`/`PASS`; implement `APUnlockSystem`, `APUnlock`, Dead End detection (bounded solver reachability); level JSON migration to `initialAP`/`apUnlockNodes`; update all 15 levels.
2. **SPRINT_006 — Solver & Validation.** `src/generation/LevelSolver.ts`, `DifficultyModel.ts`, `validate:levels` build step; solver proofs for the campaign; calibration data for Chris.
3. **SPRINT_007 — Resonance.** `Conduit.base`, `ResonanceSystem`, base glyph art, levels 6+ base assignment.
4. **SPRINT_008 — The Monitor.** Tutorial layer + "Calibration" script for Level 1.
5. **SPRINT_009 — Generator.** Deep Coma endless mode + Daily Synapse.
