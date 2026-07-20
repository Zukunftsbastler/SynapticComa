# SPRINT 017: Levels 16–20 — Unconventional Mechanic Combinations

**Status:** ✅ Completed 2026-07-20
**Goal (Till):** Five new levels that recombine existing mechanics in unconventional ways and raise the challenge. Ideas first, then implementation — every level proven by all four validator gates (solvable, fair, interactive, witness-replayable).

---

## 1. The Five Designs

| # | Name | The unconventional twist |
|---|---|---|
| 16 | **Airlock** | *Shared mutation as a trap.* The second insert simultaneously kills RED and enables BLUE. Anyone still behind their red door when the switch happens is locked out (re-lock rule → one-way commitment). The Shared Unlock sits ON the corridor at (0,0) — zero detour, pure timing: P1 must wait for P2. |
| 17 | **Signal Chain** | *Three-stage dependency chain.* RED → a plate hidden ON the red door hex → its push-chain insert enables BLUE (L5's lesson, now load-bearing) → a T-plate ON the blue door → tier-2 Fire Immunity → both fire gates. Each stage unlocks the resource for the next. |
| 18 | **Phased Rendezvous** | *Inverted AP economy.* The Shared Unlock nodes sit UNDER phase barriers: the AP relief exists, but must be earned by routing tier-2 Phase Shift on a tight starting budget. Lasers serve as lethal walls. The unlock is mathematically required, therefore Phase Shift is too — the solver's ability-knockout proof confirms it. |
| 19 | **Dead Column** | *Ejection as transport; rotation as decoy.* Column 2 starts full but dead (Till's "all slots filled" case). Rotating the top plate for RED costs 1 AP and is a trap: the real line bottom-inserts P1's curved, which ejects the needed STRAIGHT into the scrap pool (pool size 1 → the blind draw is deterministic) and slides the buried T up to power RED. The drawn straight then bridges tier 2, where UNLOCK_BLUE sits — a tier-1 ability deliberately placed in tier 2. |
| 20 | **Synapse Toggle** | *Mode toggling on a static Splitter spine.* The Splitter (S+W+N, no East — a pure vertical distributor, never rotatable) anchors a pre-filled column with two exclusive states: initial/top-insert = JUMP mode, bottom-insert = RED mode. Both players jump early; toggle A buys RED (sacrificing JUMP), P1 exits through the red door; toggle B (draw the ejected plate back, top-insert) re-earns JUMP for P2's final leap. **The sequential-exit rule is what makes the toggle-back mandatory** — P2 could jump into the exit early, but it is locked until P1 is out. First level with **two mathematically required Shared Unlocks** (U1 sits under P2's red door). |

## 2. What Implementation Surfaced

1. **Master-Set rotation was unenforced (latent divergence).** `mechanics.md §4.4` declares Cross/Splitter static after insertion, but neither `MatrixRotateSystem` nor the solver rejected in-place rotation — harmless until now (no campaign level had a Master plate in the matrix), fatal for L20 (a rotated Splitter gains an East face and both modes at once, collapsing the level to 8 AP). Fixed at the shared source: `isRotatableInPlace()` in [ConduitFaceMask.ts](../src/utils/ConduitFaceMask.ts), enforced identically in [MatrixRotateSystem](../src/systems/MatrixRotateSystem.ts) (rejected before AP deduction) and the solver's ROTATE branch. Pre-insert orientation stays free, per the docs.
2. **JUMP's bypass rule makes single-thickness obstacles porous.** First L20 draft: both players jumped straight over their locked doors (the intermediate hex is irrelevant — by design, SPRINT_010). Doors/barriers on a straight line between two standable hexes are decoration while JUMP is up. L20's geometry is now *jump-proof by construction*: every straight line over a wall/door into a guarded area is broken by a laser on the launch hex or the board edge. This is a reusable design rule for the generator: **when JUMP is grantable, guarded regions need lethal launch cells or bent approaches.** (`level_design.md §16–20` note.)
3. **Search-space budget is a design constraint.** L19's first draft (5 junk plates, off-path unlock, optimal 15) exceeded the proof budget at 10M nodes. Trimming to 3 pre-placed plates and a zero-detour unlock (optimal 13) brought it back inside; the validator's `NODE_LIMIT` was raised to 15M for headroom. Rule of thumb recorded for the generator: pre-filled columns multiply rotate-branching — budget optimal cost ≤ ~15 and rotatable junk sparingly.

## 3. Proof Results (all four gates green)

| Level | optimal | slack | D | sync | coord | draws | matrix | needs |
|---|---|---|---|---|---|---|---|---|
| 16 Airlock | 12 | 2 | 5.70 | 2 | 1 | 0 | REQ | RED, BLUE |
| 17 Signal Chain | 14 | 2 | 5.92 | 3 | 1 | 0 | REQ | RED, BLUE, FIRE |
| 18 Phased Rendezvous | 14 | 2 | 6.00 | 2 | 1 | 0 | REQ | PHASE |
| 19 Dead Column | 13 | 2 | 7.42 | 5≤ | 1 | 1 | REQ | RED, BLUE |
| 20 Synapse Toggle | 15 | 3 | 7.45 | 3 | **2** | 1 | REQ | RED, JUMP |

Difficulty rises monotonically within the block (5.70 → 7.45), interaction demand exceeds the early campaign (sync 2–5 vs. 1), every level is matrix-required, and the required-ability proofs match each design's intent (L18's knockout proof confirms PHASE is load-bearing; L20 needs RED *and* JUMP — the two toggle modes).

Notable: L20 is the campaign's first `coord=2` level — both unlocks are individually load-bearing (U1-only and U2-only budgets are provably infeasible). L19's `draws=1` is deterministic in practice (pool of one), so the adversarial AND collapses — hidden information without unfairness. All five levels replay through the real system pipeline to `LEVEL_COMPLETE`.

## 4. Files

- New: `src/levels/level_16.json` … `level_20.json`
- Registered: [levelIndex.ts](../src/levels/levelIndex.ts), [LevelLoaderSystem.ts](../src/systems/LevelLoaderSystem.ts) (`LEVEL_MODULES`)
- Rule enforcement: `ConduitFaceMask.isRotatableInPlace`, `MatrixRotateSystem`, `LevelSolver`
- Docs: `level_design.md` (campaign table 16–20, MVP scope 1–20, Post-MVP now 21–40)
- Regenerated: `levelMeta.json` (UI shows the new levels' `⇄ SYNC` values automatically)

## 5. Open / Next

- **Difficulty-curve review (🔢 Chris):** the D score of 16–20 sits below L15's spike (11.27, driven by its triple adversarial draw). The new levels are harder *structurally* (dependency depth, mode toggling, double coordination) than D captures — the weight vector may need a term for dependency-chain length / toggle count.
- L11–15 still carry Threshold-era names ("Leap of Faith", "Critical Rotation") but their threshold tiles were removed in SPRINT_013 — a team pass on whether 11–15 should be re-themed now that 16–20 exist.
- The jump-proof-geometry rule and the search-budget rule belong in `generative_levels.md §3` (generator constraints) once the generator sprint starts.
