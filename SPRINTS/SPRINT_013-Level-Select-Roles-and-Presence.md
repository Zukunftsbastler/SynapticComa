# SPRINT 013: Level Select, Role Identity & Partner Presence

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's requests: a level-unlock system with progress reset; briefings at level *start* (ideally to the player who *cannot* power the ability — forcing communication); the ignorable, unexplained Threshold tile in L11; thematic role differentiation with narrative purpose; and visible partner activity without revealing the other screen.

---

## 1. Implemented

### Level-unlock system (`LevelSelectScreen`)
- Grid of all 15 levels: **✓ completed levels are freely replayable**, the next uncompleted level is unlocked, the rest locked (🔒).
- **RESET PROGRESS** (with confirmation) wipes campaign progress *and* tutorial memory (mechanics get re-explained on a fresh run).
- Wired everywhere: session start (host/local choose; the Guest follows via `LEVEL_LOAD`), the level-complete screen's LEVEL SELECT button, Neural Collapse, and **[ESC]** in-game. `LEVEL_NAMES` added to `levelIndex.ts`.

### Briefings at level start
The ⇈ JUMP explanation now fires **when a ⇈ node exists in the level's matrix** — not when it is finally powered. The box explicitly addresses the player who cannot route it: *"Hold no plates? Then you cannot power ⇈ yourself — tell your partner where you are stuck."* First-encounter teaching thus creates the conversation instead of following it. (Pattern generalized via `levelHasAbility()` for future concepts.)

### Threshold removed until it is real
The board-flip has been an engine stub since Sprint 8 — a visible tile with zero function, which Till rightly ignored. **Decision: no dead mechanics on the board.** Threshold tiles stripped from L11–15, `thresholdEnabled: false`, levels renamed where the old names referenced the flip (11 → *Convergence*, 12 → *Leap of Faith*, 14 → *Low Reserves*). All proofs re-run (matrix requirements unchanged). The Threshold returns as a dedicated sprint with real post-flip layouts, its own briefing, and gated levels 11–15.

### Role identity — first slice
- New **ROLES briefing** at first play: the split psyche, who is who, and the communication covenant ("talk about what you need, stay silent about what you hold").
- UI speaks in roles now: Monitor (*"YOU ARE THE ID (VIOLET)…"*), inventory panel (*"THE ID — PLATES"*), partner indicator.
- `narrative.md` §2 gains explicit **gameplay-role definitions** (Id = gatherer, Superego = orderer).

### Partner presence (the anti-"waiting in silence" feature)
HUD **partner pulse**: a color-coded dot + `ID/SUPEREGO ACTIVE|IDLE` label that pulses for ~2 s whenever the partner successfully acts (move, insert, rotate, draw, collect). Fed by `GameState.lastActionAt`, marked in every action system on the Host and derived from authoritative sync messages on the Guest. Deliberately coarse: it signals *that* the partner acts — usable as a limited information source (exactly as requested) — but never *what* they see.

## 2. The Big Open Decision — D14 (recorded in `decisions_needed.md`)

Till's core critique — "the puzzle is waiting, not communicating; roles must explain who does what" — needs a **rules-level answer**, not just labels. D14 proposes three variants for the team: **(A)** Id gathers / Superego orders (plates flow through a synapse buffer — every level a hand-off dialogue), **(B)** soft cost asymmetry, **(C)** per-player ability scope (simultaneously resolving the long-flagged `mechanics.md §5.6` doc/code divergence — each player routes for the *other*). A+C is the maximal version. All variants are solver-verifiable before committing. 🔢 Chris on economy impact; all three on the core-loop reshape.

## 3. Verification

`tsc`, `vite build`, both smoke suites, `validate:levels` (15/15, matrix requirements unchanged after threshold removal) — all green. Level-select UX, briefing pacing, and whether the partner pulse "feels alive": Till's pass.
