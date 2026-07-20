# SPRINT 018: Swap Levels 3 and 4 (Red Herring Sequencing)

**Status:** ✅ Completed 2026-07-20
**Trigger:** Till's playtest of level 3 (see prior session) surfaced real confusion — Till's own follow-up hypothesis: "Level 3 is like level 4, but with deceptions/red herrings; they should be swapped."

---

## 1. The Claim, Verified

Structural comparison confirmed Till's read exactly:

- **Level 4 "Column Shift"** (as it stood before this sprint) blocks the only path with a **Chasm** — a hazard type with no counter-ability (`alwaysLethal`, per `LevelSolver.ts`). There is no possible misreading: the tile must be jumped, full stop.
- **Level 3 "Scrap Pool"** (as it stood before this sprint) blocks the same relative path with a **Locked Red door** *plus* a fully-modeled `UNLOCK_RED` ability node in the matrix — an object that visibly invites the "conventional" reading (open it) while the efficient solution ignores it entirely and jumps over the still-locked door (proven: `needs=[JUMP]` only, `UNLOCK_RED` never appears in the solver's required-ability list).

So level 3 was structurally level 4's exact lesson (JUMP bypasses obstacle content) *plus* a decoy layer — landing the deception a level earlier than the campaign's own contract allows.

**This violated the documented design contract.** `level_design.md §1` reserves red herrings for "Levels 6–10 (The Shift)"; the MVP-scope section promised levels 1–5 get "exactly one new mechanic in isolation with **obvious** conduit placement." Level 3, unswapped, broke that promise in the tutorial phase — which is exactly what produced Till's confusion in the prior session (chasing `UNLOCK_RED` down three matrix rows for a door that was never meant to be opened).

**The solver's own numbers agreed independently, for a different reason:** difficulty was non-monotonic at that point in the campaign — old level 3 (D=4.52) was harder than old level 4 (D=2.23) despite coming first.

## 2. Governance Note

`docs/decisions_needed.md` establishes that campaign/level-design questions require sign-off from all three contributors (Till, Andreas, Chris), not a unilateral call — a rule Till himself authored (commit `d9c171e`). This swap is exactly the shape of decision that document exists to hold. Till, informed of this, explicitly chose to implement directly without opening a new `decisions_needed.md` entry — recorded here for the institutional-memory trail this SPRINTS log exists to keep; nothing was hidden or skipped, the choice was made knowingly.

## 3. What Changed

- **[level_03.json](../src/levels/level_03.json) ↔ [level_04.json](../src/levels/level_04.json):** full content swapped. `id`/`name` fields kept aligned with the filename position (`level_03` now holds the "Column Shift" chasm puzzle; `level_04` now holds the "Scrap Pool" locked-door-decoy puzzle) — every other file reference (`levelIndex.ts`, `LevelLoaderSystem.LEVEL_MODULES`, narrative-panel triggers keyed by position) needed no change, since positions/filenames didn't move, only content did.
- **[levelIndex.ts](../src/levels/levelIndex.ts):** `LEVEL_NAMES['level_03']` and `['level_04']` swapped to match.
- **[level_design.md](../docs/level_design.md):** campaign table rows 3/4 updated; MVP-scope paragraph for levels 1–5 now explicitly documents the one sanctioned early exception (level 4's decoy, placed deliberately *after* level 3's clean lesson so it reads as "trust what you learned" rather than as JUMP's first impression).
- `decisions_needed.md` intentionally **not** touched (Till's explicit choice, §2 above). D10's historical entry (which already discussed "does level 3 still teach the right lesson") is left as-is — it's a dated record of a prior, already-resolved review, not a live tracker for this swap.

## 4. Why the Swap Doesn't Need New AP Tuning

Both levels already satisfied the tutorial-tier contract (`generative_levels.md §2.4`, slack ≥ 6) independently of order:

| | optimal | slack | D | needs |
|---|---|---|---|---|
| "Column Shift" (now pos. 3) | 7 | 6 | 2.23 | JUMP |
| "Scrap Pool" (now pos. 4) | 9 | 6 | 4.52 | JUMP |

Swapping their *positions* changes nothing about either puzzle's own solvability proof — the JSON content moved, not the mechanics. Re-running `validate:levels` after the swap is a confirmation step, not a re-tuning step.

## 5. Verification

- `tsc` strict: clean.
- `npm run build`: clean.
- `npm run validate:levels`: all 20 levels re-proven under all four gates (solvability, fairness, interaction, witness-replay); `levelMeta.json` regenerated — new level_03/level_04 metadata reflects the swapped content correctly.

## 6. Open / Next

- Purely cosmetic follow-up (not addressed here, out of scope for this swap): level_04.json (now "Scrap Pool") carries a harmless pre-existing duplicate wall entity (`gate_wall_0_-1_-1` listed twice at the same hex) inherited from the original level_03.json. No mechanical effect (`EntityRegistry.register` silently overwrites); worth a one-line cleanup whenever that file is next touched.
- Unchanged from SPRINT_017: D14 role-asymmetry decision still open for full-team consensus; slack-band drift on levels 7/9/13/14/15 still flagged for Chris.
