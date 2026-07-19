# SPRINT 009: Controls & Feedback — Second Playtest Findings

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's second playtest. Report: key mapping feels unintuitive (Q and D move to opposite tiles), no indication which key moves where, wish for mouse/touch control, no feedback about the other player in local mode, and no warning that the level had already become unwinnable after overspending AP.

**Design ruling recorded up front:** control confusion is **not** a design element of Synaptic Coma. The information asymmetry is *between players*, never between the player and their own controls.

---

## 1. Diagnosis → Fix

| Finding | Analysis | Fix |
|---|---|---|
| "Q and D move to opposite tiles — unintuitive" | The mapping is geometrically correct for the flat-top grid and mirrors the keyboard block (Q↖ W↑ E↗ / A↙ S↓ D↘ — Q/D *are* diagonal opposites, on the keyboard too). The real problem: nothing on screen showed the mapping. **Additionally, P2 was missing two directions entirely** — U/O were documented in the README but absent from the key map, leaving P2 with 4 of 6 moves. | **On-board key hints:** the controlled wisp's neighbor tiles now display the key letter that moves there (dimmed when the tile is blocked, hidden off-board). New `drawText` render command + pooled PIXI.Text layer in `PixiDriver`. U/O added; P2's block is now U↖ I↑ O↗ / J↙ K↓ L↘, exactly mirroring P1 |
| "Mouse/touch would help" | Nothing in the concept forbids it — silent execution restricts *communication*, not input modality. | **Click-to-move** (`MouseInput.ts`): clicking an adjacent tile moves the wisp (same message path as keyboard; works for host, guest, and local). The key-hint letters double as click affordances. `pixelToAxial` with cube rounding added to `HexMath` |
| "No feedback what the other player is doing" | In *networked* play that is the core design (dimensional asymmetry). In *local* single-machine play it is pure friction — the docs even specify a side-by-side debug layout (`digital_implementation.md §3`). | Local mode now renders **both dimensions side by side**; the controlled wisp carries a bright ring; `1`/`2` switches. Networked play keeps the strict mask — asymmetry untouched where it matters |
| "No warning the level is already unwinnable" | The Dead-End check only fired at AP = 0 *and* all unlocks triggered — an unreachable untriggered unlock silently blocked it forever. | **Early Dead-End proof:** each tick, if `AP + usableUnlockCredit < admissible lower bound of remaining cost`, the level is provably lost and the Dead End fires immediately. `usableUnlockCredit` counts only pairs whose *both* hexes each player can still reach with the entire remaining pool (sound: shared AP makes combined spending strictly harder). Lower bound: `⌈dist/2⌉` per un-exited wisp (jump-aware, relaxed — admissible). The Monitor explains: level can no longer be won, Enter restarts free |

## 2. Decisions

- **Controls are never a puzzle.** Recorded as a design principle above; the Monitor and on-board hints exist to eliminate exactly this class of confusion.
- **Local mode = revealed mode.** `GameState.revealBothDims` (local: true) — chosen over a "strict local" variant because local play is primarily testing/learning; the two-screen asymmetry is inherently a networked experience.
- **Early Dead-End detection uses proofs, not heuristics.** It only fires when the level is *mathematically* lost (admissible bound + sound credit rule) — no false alarms that would train players to ignore it. Cases that are lost but not provably so by this bound are caught later at AP = 0; the full solver can tighten this at runtime once it runs in a worker (SPRINT_007 §5).

## 3. Verification

- `tsc`, `vite build` — clean. `validate:levels` — 15/15 proofs unchanged.
- Smoke suites updated and passing, including a new check: AP below the lower bound with a triggered unlock → early Dead End fires; AP above it → no alarm.
- Not machine-verified: visual placement of key-hint letters and click hit-testing feel — **needs Till's eyes**.

## 4. Open

- Key hints could later fade out after N successful moves per concept (Monitor registry work).
- Click-to-move could extend to full path preview (A* path + AP cost projection) — natural once the solver runs client-side.
- Networked JOIN/HOST retest still outstanding from SPRINT_008.
