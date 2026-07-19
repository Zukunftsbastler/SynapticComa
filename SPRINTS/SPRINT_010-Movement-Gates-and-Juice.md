# SPRINT 010: Movement Semantics, Level Gates, Legend & Game Feel

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's third playtest — the most consequential one yet. Report: movement skips a tile in Level 1 (goal unreachable, accidental exit), levels 5–9 solvable while ignoring the matrix entirely, Level 9/10 incomprehensible, no level indicator, no animation, no feedback on special events, matrix connections and gray fields unexplained, demand for a *graphical* legend.

---

## 1. The Two Root Causes

### 1.1 Level 1 was a jump-tutorial in disguise
Level 1's demo matrix connection powers **JUMP** from the first tick — and the movement rule flagged in SPRINT_007 ("a clear 2-hex jump *replaces* the 1-hex step") turned every keypress into a 2-hex skip. The gold node became unreachable, and the exit was hit by accident. **Playtest decides the flagged divergence: it was a bug.**

**New movement semantics** (recorded in `mechanics.md §5.1`):
- The 1-hex step is always the default and is never replaced.
- The 2-hex jump fires only (a) on explicit request — clicking a straight-line tile 2 hexes away — or (b) when the 1-hex step is blocked and the jump can bypass the obstacle.
- The intermediate hex is bypassed **entirely** (walls, doors, chasms, barriers — per the docs' original intent); only the landing hex is validated. The previous code wrongly required the intermediate hex to be passable, which made jump useless for its documented purpose.
- Solver mirrors both actions; all proofs re-run.

### 1.2 The matrix was globally optional — the board was too open
Every door sat on an open radius-3 board and could simply be walked around. The core loop (route abilities via the matrix) was never *required*. Fix: **gate walls** — each gated exit is ringed by walls sparing exactly the intended gate hex (door/chasm), with chokes where the mechanic demands it (L4 chasm, L6 double door, L10 double dimension).

The solver gained a `noMatrix` proof mode (`solveLevel(def, n, { noMatrix: true })`), and `validate:levels` now reports **`matrix=REQ/opt`** per level. Result: **levels 2–10 all REQ** (11–15 stay `opt` deliberately until the Threshold flip stops being an engine stub). The gates exposed real level-content defects the solver then pinned down:
- **L6** was pre-routed (door open at spawn) → initial plate now rotated off-power; one Rotate re-arms it.
- **L9 "Forced Rotation" could never work**: a CURVED plate physically cannot pass W→E (adjacent-face shapes only) and no plates were available. Rebuilt: a vertical STRAIGHT at the node's row — one Rotate turns it into the pass-through. The name finally means something.
- **L7/L10** became budget-impossible with gates → retuned from tuner data (L7: 11 AP, forced coordination, optimal 14; L10: 7 AP + unlock 2, slack 2 — genuinely tight).

## 2. Feedback & Readability (the rest of the report)

| Ask | Delivered |
|---|---|
| Graphical legend, "like a map key" | `LegendPanel` — collapsible panel with **inline-SVG swatches in the exact game colors** (imported palette; legend and board cannot drift), auto-populated from the current level's contents each second, covering board pieces *and* the matrix cell types incl. the ability glyph code |
| Matrix not understandable | Ability nodes now carry **glyphs** (⇈ ▶ R B ◈ ♨); the **insert arrows ▼/▲ are finally drawn** — they had click zones but no pixels (third invisible affordance found by playtesting); legend explains slots, plates, rotation and insertion |
| Current level not visible | HUD center shows `LEVEL NN — NAME` |
| Movement must be animated | Avatars ease 140 ms between hexes via `AnimationState.animateTo` + `TweenManager` (Decision 8 respected: tweens never write into ECS; state cleared on level reload because bitECS recycles entity ids) |
| Special events need a phenomenal effect | **ECS-native FX system**: `Fx { kind, age, duration }` component + `Position` + `Dimension`; `FxSystem` ages/expires; `RenderSystem` draws. Spawnable from any system via `spawnFx()` — exactly the reusability Till required. Emitters: Shared Unlock → triple gold shockwave + wide flash in *both* dimensions; P1 exit → green dissolve; level complete → white pulse |
| Inventory unclear (L9/L10) | Monitor strip announces held plates with the exact controls ([TAB]/[R]/▼▲ insert); legend explains the collect-by-walking rule |

## 3. Verification

- `tsc`, `vite build`, both smoke suites — clean/passing.
- `validate:levels`: **15/15 provably solvable** under the new movement rules and gates; **matrix REQ on 2–10**; difficulty curve D 0.6 → 6.4 with slack ≥ 1 everywhere.
- Not machine-verifiable: animation feel, FX impact, legend clarity — Till's next pass.

## 4. Decisions Recorded

- **Jump**: explicit-or-fallback, mid-hex fully bypassed (resolves the SPRINT_007 flag; `mechanics.md §5.1` updated).
- **Gates over bigger redesigns**: minimal wall sets that make existing mechanics mandatory, provable by `noMatrix` runs — levels keep their identity.
- **FX as ECS entities**, not render-layer one-offs — spawnable anywhere, aged by a system, drawn declaratively.
- L11–15 remain `matrix=opt` **on purpose** until the Threshold system is real; gating them now would tune against a stub.

## 5. Open

- Threshold flip implementation (the biggest remaining engine stub) — after it lands, gate and retune 11–15.
- Ability-scope divergence (global vs per-player, `mechanics.md §5.6`) still awaits the team ruling.
- Matrix insert preview (ghost of the column after the slide) would soften the L4 "column shift" learning curve.
