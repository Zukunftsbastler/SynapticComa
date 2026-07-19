# SPRINT 014: Campaign Solvability Audit & the Interaction Metric

**Status:** ✅ Completed 2026-07-19
**Goal:** Re-prove every campaign level solvable after the SPRINT_008–013 changes (gate walls, jump semantics, threshold-tile removal), and turn the solver's `minSwitches` value into a first-class, player-visible **interaction metric** — displayed as a property of the level, never as an optimization target.

---

## 1. Why This Sprint

Till's standing concern: the campaign levels were authored iteratively up to Level 15, with repeated mechanics changes along the way — some levels were suspected to have silently become unsolvable. Additionally, the design's core thesis (communication *is* the game goal) needs a trackable measure: the minimal number of control switches between the two players that any solution requires. High values late in the campaign are *desired*; the number exists so designers can steer interaction upward — not so players can optimize it downward.

## 2. Audit Result: 15/15 Solvable, One Fairness Regression

`validate:levels` re-proved all 15 levels solvable (worst-case blind draws included). One regression surfaced:

- **level_02 "Locked Door" had `apSlack = 0`.** The gate walls added in SPRINT_010 lengthened both players' paths; the direct route now costs 10 AP against `initialAP = 8`, forcing the Shared-Unlock detour — which consumed **exactly** the full 12-AP budget. Any single wasted AP ⇒ Dead End, in the second tutorial level (D = 6.65, wildly off the curve). This violates both the fairness rule (`generative_levels.md §2.4`) and the tutorial contract (L1–5: slack ≥ 6, unlock optional — SPRINT_007 tuning).
- **Fix:** `initialAP` 8 → 12. Restores the SPRINT_007 contract: optimal 10, slack 6, unlock optional, D = 3.35.

Post-fix campaign proof (sync = `minSwitches`; `≤` marks a search-budget upper bound):

| Level | optimal | slack | D | sync | coord | matrix | needs |
|---|---|---|---|---|---|---|---|
| 01 Tutorial: Movement | 4 | 8 | 0.60 | 1 | 0 | opt | — |
| 02 Locked Door | 10 | 6 | 3.35 | 1 | 0 | REQ | RED |
| 03 Scrap Pool | 9 | 6 | 4.52 | 1 | 0 | REQ | JUMP |
| 04 Column Shift | 7 | 6 | 2.23 | 1 | 0 | REQ | JUMP |
| 05 Shared Routing | 12 | 4 | 4.17 | 1 | 0 | REQ | RED,BLUE |
| 06 Insert Sequence | 6 | 4 | 2.08 | 1 | 0 | REQ | JUMP |
| 07 T-Junction Coordination | 14 | 1 | 6.44 | 5≤ | 1 | REQ | RED,BLUE |
| 08 Red Herring | 6 | 6 | 1.75 | 1 | 0 | REQ | JUMP |
| 09 Forced Rotation | 11 | 1 | 6.15 | 2 | 1 | REQ | RED |
| 10 Tight Budget | 7 | 4 | 3.12 | 1 | 0 | REQ | JUMP |
| 11 Convergence | 9 | 4 | 3.57 | 1 | 0 | opt | — |
| 12 Leap of Faith | 8 | 4 | 2.90 | 1 | 0 | REQ | JUMP |
| 13 Critical Rotation | 12 | 1 | 6.36 | 2 | 1 | REQ | RED,BLUE |
| 14 Low Reserves | 15 | 1 | 6.62 | 5≤ | 1 | REQ | RED,BLUE |
| 15 Master Set Teaser | 15 | 1 | 11.27 | 5≤ | 1 | REQ | RED |

Every level requires both players to act (sync ≥ 1), and interaction intensity rises exactly where the design wants it: the forced-coordination levels (7, 14, 15) demand at least 5 hand-offs.

## 3. What Was Implemented

1. **`scripts/validateLevels.ts` — two new design-contract build gates** (exit non-zero, same as a missing proof):
   - **Fairness gate:** `apSlack ≥ 1`. Would have caught the level_02 regression at SPRINT_010 time.
   - **Interaction gate:** `minSwitches ≥ 1` — a level one player could clear alone is a design error.
2. **`src/levels/levelMeta.json` — generated metadata export.** The validator now writes the per-level proof metrics (optimalCost, apSlack, difficulty, minSwitches + exactness, coordinationSteps, drawSteps, matrixRequired) to a committed JSON. Generated file — regenerate via `npm run validate:levels`, never hand-edit. Rationale: runtime solving is impossible (L7 needs ~60 s of search), so the UI reads the build-time proof.
3. **`src/levels/levelMeta.ts`** — typed accessor (`getLevelMeta(id)`), carries the presentation rule in its doc comment.
4. **UI display (`⇄ SYNC n`, `+` = upper bound):**
   - **HUD** ([src/ui/HUD.ts](../src/ui/HUD.ts)): small dim badge under the level name.
   - **Level Select** ([src/ui/LevelSelectScreen.ts](../src/ui/LevelSelectScreen.ts)): `⇄ n` on unlocked level cards — players see what interaction depth awaits before descending.
5. **`LevelSolver.ts`:** new `switchPhaseNodeBudget` option — the offline validator raises the switch-metric phase budget to 2 M nodes (default stays 400 k). This made level_05's sync exact (1, previously reported as ≤ 3).
6. **`docs/generative_levels.md §2.4`** — `minSwitches` added to the solver-export contract, with the presentation rule spelled out (see §4).

## 4. Decision: How the Metric Is Shown Without Becoming a Goal

Per Till's directive, the metric is a **measure of the level, not of the players**:

- Shown as a **static property** (like difficulty): a fixed badge in HUD and Level Select.
- **No live counter** of the players' own hand-offs, no par display, no post-level comparison ("you used X switches, minimum was Y"), no reward or penalty tied to it. The HUD element never changes during play.
- Framing: high sync = high interaction depth = the point of the game. Doc'd in `generative_levels.md §2.4` so the generator and future UI work inherit the rule.
- The display is intended at minimum for development time; whether it ships in the release UI (and in what visual form — number vs. icon scale) is a **team call** (→ `decisions_needed.md` candidate).

## 5. Verification

- `npm run validate:levels`: 15/15 proofs, both new gates green, `levelMeta.json` regenerated. Total runtime ~2.5 min (L7/14/15 dominate).
- `npm run build` (tsc strict + Vite): clean.

## 6. Open / Next

- **sync upper bounds:** L7/14/15 report `5≤` — exact values need either a larger offline budget or a solver refinement (e.g. switch-count-aware memoization). Fine for display (`5+`), imprecise for balancing.
- **Slack-band drift (team review, 🔢 Chris):** SPRINT_007 targeted L6–8 at slack 3–5; L7/9/13/14/15 now sit at slack 1 ("brutal" fairness tier) and L12 lost its forced coordination (coord = 0, SPRINT_007 had tuned it to 1). All levels are provably solvable and fair-gated, but whether the mid-campaign should be this tight — and whether L12 should force its unlock again — is a balance decision, not a bug.
- **`deadEndDistance`** (perturbed-state fairness metric) remains specified-but-not-computed; the slack ≥ 1 gate is the interim guard.
- Unchanged next per plan: Neuro-Resonance (`ResonanceSystem` + solver extension), The Monitor concept triggers, Generator.
