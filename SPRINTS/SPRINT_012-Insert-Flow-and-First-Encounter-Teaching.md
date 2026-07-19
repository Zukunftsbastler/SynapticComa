# SPRINT 012: Intuitive Insert Flow & First-Encounter Teaching

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's Level-10 session: inserting plates from the inventory into the matrix is unintuitive; new mechanics MUST be explained the first time they appear; and the level seemed unsolvable within the given AP.

**Design rule now enforced in code:** *whenever a mechanic appears for the first time, the Monitor explains it — no exceptions.*

---

## 1. Was Level 10 really unsolvable? — Yes, for keyboard players

The solver's optimum (7 AP) requires an **explicit jump across open ground**, which only the mouse can request (click a straight-line tile 2 hexes away); the keyboard jumps only when the single step is blocked. Keyboard-optimal play needs **8 AP — one more than the 7 available**, and the Shared-Unlock detour costs more than its +2 grant. So with keys alone the level was genuinely impossible; Till overlooked nothing.

**Fixes:** `initialAP` 7 → **9** (keyboard route now has slack 1; solver slack 4 — 🔢 note for Chris: the formal slack metric assumes mouse-optimal play, so "tight ≤ 2" should eventually be measured against input-agnostic optima). The JUMP first-encounter popup (below) teaches the click-jump the moment ⇈ powers up.

## 2. The New Insert Flow (same costs, no hidden steps)

Single source of truth `src/ui/uiState.ts` (`selectedSlot`, `insertArmed`) shared by InventoryPanel, MatrixUI and MatrixRenderer — previously the panel and the matrix each kept their *own* selection, which could silently diverge.

1. **Click a plate** in the P-PLATES panel → it arms (gold border, "→ click a ▼/▲ arrow" hint).
2. The matrix **▼/▲ arrows enlarge and pulse gold** with a glow halo.
3. **Click an arrow** → insert (2 AP), arms off. Tab/R keyboard flow unchanged and now writes the same shared state.

## 3. First-Encounter Teaching (Monitor "Calibration" popups)

`src/tutorial/` begins, per `tutorial_design.md`: `TutorialState` (seen-set in `localStorage`, resettable) + `TutorialPopups` (CRT-styled Monitor boxes, one at a time, once per profile, dismissed by button/Enter). Concepts v1, trigger-driven — they fire in whatever level the mechanic *actually* first appears:

| Concept | Trigger | Teaches |
|---|---|---|
| `UNLOCK_NODE` | untriggered gold pair present | both-wisps-simultaneously rule, +AP, one-shot |
| `INSERT` | viewed player holds a plate | the full click-plate → click-arrow flow, column slide, top vs. bottom entry, scrap ejection, Tab/R |
| `JUMP` | ⇈ becomes powered | click-a-distance-2-tile jump, "intermediate tile is irrelevant", severed-path warning |

Deliberate v1 limits (recorded): dismissal by confirmation instead of act-to-advance, no highlight arrow/framing yet — that full presentation layer (`tutorial_design.md §3`) remains the dedicated Monitor sprint.

## 4. Verification

`tsc`, `vite build`, both smoke suites, `validate:levels` (L10: solvable, matrix=REQ, D 3.12) — all green. Feel of the armed-arrow flow and popup pacing: Till's pass.
