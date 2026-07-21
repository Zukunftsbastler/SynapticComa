# SPRINT 020: Roadmap Part 1 + Two New Mechanics (Impulse Blocks, Focus Vault)

**Status:** ✅ Completed 2026-07-21
**Trigger:** Till: "Implementiere nun die genannten Punkte der Roadmap" (`mechanic_roadmap.md`, SPRINT_019). Scope was ambiguous between Part 1's four repair recommendations and Part 2's ten new-mechanic proposals — clarified via question: **Part 1 in full, plus the two lowest-risk Part 2 proposals** (Impulse Blocks #2, Focus Vault #8).

---

## 1. Part 1 — Repairing the Existing Campaign

**Recommendation 1 (Resonance/Push scope decision):** Resolved by the choices below — Push is now real (via Impulse Blocks); Neuro-Resonance is formally deferred, not built. `level_design.md`, `mechanics.md §4.5`, and `architecture.md`'s component table now say so explicitly instead of claiming it's "introduced."

**Recommendation 2 (level 11 redesign):** Added the standard wall funnel to `level_11.json` (the exact pattern used by a dozen other levels — walls at `(1,-2),(1,-3),(0,-3),(-1,-2),(-1,-1)` on P1's dimension) so the fire hazard is now the *only* path, and retuned `initialAP` 9→10. Before: `matrix=opt` (the only non-tutorial level where the matrix was provably skippable, per SPRINT_019 F4). After: **`needs=[FIRE]`, matrix=REQ, slack=4** — Fire Immunity is now genuinely load-bearing.

**Recommendation 3 (tutorial-popup coverage):** Added five popups to `TutorialPopups.ts` (`ROTATE`, `PHASE_SHIFT`, `FIRE_IMMUNITY`, `PUSH`, `FOCUS_VAULT`), each following the established `levelHasAbility()` first-encounter pattern (fires when the level's matrix contains the relevant node — before it's powered, so the player who can't route it themselves learns to ask). Popup coverage rises from 5 to 10 of `tutorial_design.md §2`'s registry.

**New level 18 "Ghost Step"** closes the gap SPRINT_019 flagged most sharply: Phase Shift had no teaching level anywhere before its first mandatory use (old level 18). Inserted between the existing 17 and 18; the three levels after it renumbered 18→19, 19→20, 20→21 (content unchanged, only the position and `id`/filename shifted — `levelIndex.ts` and `LevelLoaderSystem.LEVEL_MODULES` updated to match). Deliberately built to teach a lesson **no earlier level covers**: a Tier-2 ability needs power routed through *both* conduit columns (col2 **and** col4), not just one — proven via the ability-knockout check (`needs=[PHASE]`) and confirmed novel by checking no level 1–17 has ever required a column-4 route to a column-5 node. Clean and self-contained (P1 holds both needed plates), slack 6 matching the campaign's other single-ability teaching levels.

## 2. Part 2 — Two New Mechanics

### Impulse Blocks (`mechanic_roadmap.md` #2) → Level 22 "Clot"

**What shipped vs. proposed:** matches the roadmap's design with one deliberate cut — "push a block to bridge a chasm" was dropped in favor of the simpler, fully-supported "push a block out of the way" Sokoban move. Bridging needs bespoke semantics (`PushSystem` doesn't yet distinguish "solid obstacle" from "walkable once resting on a hazard tile"); scoped out rather than half-built.

**The real engineering was the solver, not the game code.** `PushSystem`/`MovementSystem` already implemented push correctly (confirmed by reading the source before touching anything — SPRINT_016's own audit trail). What was missing was purely a *content* gap: `LevelSchema.ts`'s `EntityType` union had no `'pushable_block'` variant, so no level JSON could ever place one. That's now `PushableBlockDef`, wired through `HazardFactory.createPushableBlock` (Position + Renderable + Dimension + **both** `Pushable` and `Static` — `Static` alone would make it permanent scenery, `Pushable` alone would let avatars walk straight through it whenever PUSH isn't routed; the pairing is what makes it "solid until shoved").

Because level 22 needed PUSH to be **provably required** (not just present), `LevelSolver.ts` needed a genuine extension — previously "Push and Threshold are not modeled" per the solver's own header comment (SPRINT_007). Added:
- `SState.pushables: {q,r,z}[]` — tracked in the search state, cloned and included in the memoization key (`stateKey`) like everything else that varies.
- `isBlocked` now treats any pushable-occupied hex as blocked (mirrors the entity's real `Static` component) — affects both the 1-hex step and jump-landing checks uniformly.
- A new push branch in the MOVE loop: when `PUSH` is routed and the adjacent hex holds a pushable, generates a push option (avatar stays, block relocates) via `isPushDestinationBlocked` (a faithful mirror of `PushSystem.isPushDestinationClear` — including its lack of a board-edge check; the solver mirrors the shipped code rather than silently fixing an unrelated gap, and level 22 was designed so that gap never matters). Failed pushes (destination blocked) are never generated — same AP cost as a no-op, can never be part of an optimal-cost proof, so omitting them only prunes the search.
- `WitnessReplay.ts` gained a `PUSH` case: synthesizes the *same* `MOVE_AVATAR` message a real push would be (there's no dedicated network message — a push is just a directional move interpreted by live game state, exactly like a real player), then asserts the avatar didn't move and the block did.

**Level 22 "Clot"** required careful hand-geometry: the first draft put the block directly in the exit's only approach, where a naive push would have shoved it onto the exit hex itself and permanently soft-locked the level (not caught by the automatic Dead-End detector, which only watches AP exhaustion — a real risk identified and designed around, not discovered by accident). Final geometry: a dedicated approach hex forces the *only* viable push direction, into a side alcove sealed on every other approach. Proven: `needs=[PUSH]`, `matrix=REQ`, slack=4. Witness replay passes end-to-end through the real systems.

### Focus Vault (`mechanic_roadmap.md` #8) → Level 23 "Second Thoughts"

**What shipped:** matches the proposal exactly — no scope cuts. New `FocusNode` component (`id, cost, triggered` — same shape as `APUnlock`) and `FocusVaultFactory.createFocusVaultPair` mirror the Shared Unlock pairing convention precisely. `FocusVaultSystem` mirrors `APUnlockSystem`'s trigger detection, inverted: **spends** `cost` AP instead of granting it (skipped entirely if unaffordable — no partial spend), and spawns the bonus plate dynamically via `createCollectible` at the moment of trigger, never pre-placed — so it cannot be collected, or even exist as a collision target, before the vault opens. Guest-side network sync got a new `FOCUS_VAULT` message (mirrors `AP_UNLOCK`'s pattern) so the mechanic works correctly in real networked play, not just locally.

**By design, the solver has zero awareness of Focus Vault** — no `LevelSolver.ts` changes were needed or made. The mechanic's entire safety property rests on that: an entity nothing in the required solution ever touches cannot affect a solvability proof either way, so "provably solvable" and "provably never required" hold simultaneously by construction rather than by extra checking.

**Bug found and fixed during implementation:** `FocusNode.id` is a `ui8` bitECS field (0–255). The first implementation offset Focus Vault ids by `1000 +` to "avoid colliding with `APUnlockNodes`' ids" — a defensive instinct solving a non-problem (the two component types have entirely separate queries; there was never a collision risk) while silently introducing a real one: `1001` wraps to `233` in an 8-bit field, and since both paired nodes wrapped identically the pairing *looked* consistent while the lookup into `FocusVaultState`'s spec map (keyed by the un-wrapped `1001`) silently missed, so the vault never triggered — no AP deducted, no plate spawned, and critically **no error or log line**, because the code's `if (!spec) continue` treated it as an unremarkable "unpaired/no data" case. Caught by hand-building a headless verification script and finding the AP pool didn't move; root-caused by instrumenting the actual field values (`id=233` on both nodes, immediately explaining the wrap). Fixed by dropping the unnecessary offset (`i + 1`, matching `ApUnlockFactory`'s own convention) — a reminder that "avoid a collision that can't happen" is itself a design decision worth questioning, not a free defensive add.

**Level 23 "Second Thoughts":** a level 2-style clean RED-door base puzzle (untouched by the vault) plus one Focus Vault pair reachable via a short detour, cost 3, rewarding a Cross (Master Set) plate. Verified twofold: the solver proves the *base* solution (`needs=[RED]`, matrix=REQ, slack=4, unaffected by the vault's presence — confirming it truly is invisible to the proof), and a hand-written headless script exercised the actual trigger end-to-end (AP 10→5, plate spawned at the vault hex, collected into P1's inventory, a second visit to the pair a no-op).

## 3. Verification

- `tsc` strict: clean throughout (checked after each major addition, not just at the end).
- `npm run build`: clean.
- `npm run validate:levels`: **23/23 levels pass all four gates** (solvability under worst-case draws, `apSlack ≥ 1`, `minSwitches ≥ 1`, witness replay through the real system pipeline). New `needs=[FIRE]` (L11), `needs=[PHASE]` (L18, L19), `needs=[PUSH]` (L22) confirm every targeted fix and new mechanic is genuinely load-bearing, not just present.
- Focus Vault's optional-content path (not exercised by the solver/replay pipeline by design) was verified separately via a dedicated headless script driving the real systems directly.

## 4. Open / Next

- Impulse Blocks' "bridge a chasm" variant (dropped from level 22) would need `PushSystem`/solver semantics distinguishing "permanently solid" from "solid, but crossable once resting on a hazard tile" — a real follow-up if a future level wants that flavor specifically.
- `mechanic_roadmap.md`'s remaining eight proposals are unchanged, unranked, awaiting team selection.
- Two pre-existing, unrelated documentation staleness issues were found and partially addressed while touching adjacent text (not full audits — flagged for whoever next owns these docs): `architecture.md §4`'s system pipeline diagram had drifted from `systems/pipeline.ts` well before this sprint (now corrected to match, with a pointer back to the source of truth) and still lacks `TutorialTriggerSystem`'s actual existence verified; `digital_implementation.md §5.4`'s canonical level-JSON example predates the current schema (`base` fields, a `solverProof` field) and wasn't fully rewritten, only annotated.
- Campaign is now 23 levels. `mechanic_roadmap.md`'s Part 1 audit describes the pre-SPRINT_019/020 campaign; a fresh audit pass once more Part 2 mechanics land would keep it current.
