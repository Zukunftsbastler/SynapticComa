# SPRINT 011: Player-Sensitive UI & the Level-10 "Missing Plates" Bug

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's fourth playtest round: the legend shows elements irrelevant to the current player and should be as short as possible; Level 10 appeared unsolvable because the promised 3 plates "weren't there".

---

## 1. The Level-10 Mystery — a real bug, but not the suspected one

**Level 10 is provably solvable and the 3 plates exist** (P1's inventory; solver witness: one STRAIGHT inserted at the *bottom* of column 2 powers ⇈ JUMP on row 4, then both wisps jump their doors — 7 AP, an intended-mechanics shortcut past the RED/BLUE routing).

The actual bug: **`viewPlayerId` leaked across level loads.** When P1 exits, local mode auto-switches control to P2 — and that setting survived into the next level. Till started Level 10 *as P2*, looking at P2's empty inventory ("— empty —"), with no hint that P1 held everything.

**Fixes:**
- Every level load in local mode resets control to P1.
- The inventory panel is now titled **`P1 PLATES` / `P2 PLATES`** (color-coded) — it always says whose pockets you are looking at.
- Local mode: if the viewed wisp has no plates but the other one does, the Monitor says so explicitly: *"P1 HOLDS 3 PLATES — PRESS [1] TO SWITCH AND INSERT."*

## 2. Player-Sensitive Legend

The legend now behaves like the boards themselves:

- **Scans only the viewed player's dimension** — P2's hazards never appear in P1's legend and vice versa; switching wisps (1/2) refreshes it instantly.
- **As short as possible:** one wisp row ("You (ring = controlled)"), one exit row (state-aware: goal vs. sealed), hazards only if present on *your* board, consumed unlocks drop out entirely.
- **Matrix section is level-aware:** the ability glyph explanations list only the abilities that actually exist in this level's matrix (⇈ ▶ R B ◈ ♨ subset), and the plate row carries the full interaction summary (click = rotate 1 AP · ▼/▲ = insert 2 AP).

## 3. Verification

`tsc`, `vite build`, both smoke suites — clean/passing. Level-10 witness re-derived from the solver as part of the diagnosis. Visual brevity/relevance of the legend: Till's next pass.

## 4. Note for the campaign design (Chris 🔢)

The solver's Level-10 shortcut (JUMP over both doors with a single bottom insert) is legitimate and elegant — but if the *intended* lesson is triple-insert routing under pressure, the JUMP node needs to move off row 4 or the plate mix needs adjusting. Left as-is for now: the shortcut is exactly the kind of "aha" the game wants to reward.
