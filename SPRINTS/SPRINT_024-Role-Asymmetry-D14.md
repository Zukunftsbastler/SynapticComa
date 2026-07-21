# SPRINT 024: Role Asymmetry (D14, scoped Option C)

**Status:** ✅ Completed 2026-07-21
**Trigger:** 3rd of 5 roadmap-priority sprints. D14 explicitly names all three contributors as owner ("this reshapes the core loop") — flagged to Till before touching anything; Till chose to have Till decide alone, informed of that tension, mirroring the SPRINT_018 precedent for the level-3/4 swap.

---

## 1. The Decision: Why Not A, B, or Literal C

D14 proposed three options. All three were evaluated for real implementation cost before picking:

- **(A) Id gathers / Superego orders**, with a new synapse-buffer hand-off mechanic. Requires: forbidding P1 from Insert/Rotate and P2 from ever holding a floor collectible directly — which breaks the *majority* of the 23 existing levels' proven solutions (many rely on P1 performing an insert, e.g. level_03's and level_11's witnesses). Full re-leveling of the entire campaign, not just 1–15 as the original proposal (written when the campaign was 15 levels) assumed.
- **(B) Soft asymmetry** via differential AP costs for Collect/Insert per player. Collection is currently *always* 0 AP, full stop (`mechanics.md §3`) — introducing a per-player cost there is a strange fit (collection isn't a chosen action, it happens automatically on step-over), and every level's tuned `optimalCost`/`initialAP` assumed flat costs; changing them invalidates the tuning of some or all 23 levels. The proposal's own comparison paragraph doesn't even praise this option — tellingly, it's the only one of the three not credited with a strength.
- **(C) as literally written** ("abilities apply only to the player whose source row routes them") has no data model to hang on: matrix source nodes (column 1) carry **no player identity at all** — confirmed by reading `MatrixNodeFactory.createSourceNodes` directly, not assumed. Building true per-source-row ownership means inventing that concept from scratch and rewriting `MatrixRoutingSystem`'s flood-fill to propagate per-player bitmasks — a large, high-risk change to the single most safety-critical file in the codebase (a bug there silently corrupts every level's solvability proof).

**What shipped instead:** the same underlying idea as Option C — an ability's benefit can be restricted to one player — implemented one level down, at the **ability node** rather than the source row. `MatrixNode` gains `restrictedTo` (0/1/2, default 2=unrestricted). Routing (`MatrixRoutingSystem`) is **completely untouched** — a node is powered or not, exactly as before; the restriction is applied only at the moment an already-powered node's *effect* is read (movement, door-unlock, fire-resistance). This closes the long-flagged `mechanics.md §5.6` doc/code divergence (SPRINT_007) for real, without touching who may act.

**The safety property this buys:** every node in every level before this sprint defaults to `restrictedTo: 2`, which is provably identical to the old single-global-Set behavior. This is not an assumption — it was verified empirically (see §4).

## 2. What Was Built

- **`MatrixNode.restrictedTo: ui8`** (component), **`MatrixNodeDef.restrictedTo?: 0 | 1`** (level schema, optional), set by `MatrixNodeFactory.createAbilityNode` (default 2).
- **`AbilitySystem.ts` rewritten per-player.** `abilityFlags` is now `{0: {...}, 1: {...}}`. `isAbilityActiveFor(world, type, playerId)` replaces the old global `isAbilityActive`. `UNLOCK_RED`/`UNLOCK_BLUE` now key off each hazard's own dimension (`z ↔ playerId`, the existing invariant); `FIRE_IMMUNITY` keys off each avatar's own `playerId`.
- **Call sites updated:** `MovementSystem.ts` (jump/push/phase-shift checks now index by the mover's own dimension), `PushSystem.ts` (phase-shift check on push destination), `deadEnd.ts` (reachability BFS's phase-shift check), `HUD.ts`/`AbilityPanel.ts` (show the *viewed* player's own flags — a restricted node may be active for one avatar and not the other, so a shared display would be actively misleading now).
- **`LevelSolver.ts`:** `poweredAbilities()` now returns `{0: Set, 1: Set}` — the entire routing flood-fill (the actual complex, safety-critical math) is **byte-for-byte unchanged**; only the final step (mapping powered ability cells into the result) got a `restrictedTo` filter. `isBlocked`/`isPushDestinationBlocked` take the per-player structure and index by their own `z` parameter (already player-identified, no new parameter needed). The dfs search's two direct `abilities.has(...)` checks (PUSH, JUMP) now read `abilities[z]`.
- **`MatrixRenderer.ts`:** a restricted ability node gets a small violet (P1/Id) or cyan (P2/Superego) corner tab — legible without needing a stroke primitive the render command buffer doesn't have.
- **Level 24, "Crossed Wires":** JUMP restricted to P1, UNLOCK_RED restricted to P2 — and critically, **each player holds the plate that powers the *other's* node**. P2's own plate must be inserted to power P1's jump; P1's own plate must be inserted to power P2's door. Neither obstacle is solvable by routing for yourself alone.
- **Tutorial popup** (`ROLE_ASYMMETRY`, `TutorialPopups.ts`): fires on first encounter with any restricted node, explains the corner-tab convention and the "you may be routing for someone else, on purpose" framing.
- **`src/systems/__tests__/roleAsymmetry.test.ts`:** two tests — an unrestricted node (level 3) still benefits *both* players after one player's insert (the backward-compat property, asserted directly against `abilityFlags`, not just inferred from unchanged solver output), and a restricted node (level 24) benefits *only* the assigned player.

## 3. A Genuine Timing Gotcha (caught by the new test, not shipped)

The role-asymmetry test's first draft asserted `abilityFlags` immediately after the tick containing an insert and got `false` for both players — looked like a real bug. Root cause: `AbilitySystem` runs **before** `MatrixInsertSystem` in the pipeline (`systems/pipeline.ts`), so its flags reflect the matrix state as of the *start* of the tick, one tick behind any insert processed later in that same tick. A second tick (routing catching up) gives the correct value — exactly how two real animation frames would behave in actual play. Fixed in the test, not the system; noted here because it's a subtlety worth remembering for any future test that inserts-then-immediately-asserts within a single tick.

## 4. Verification

- **Full backward-compatibility proof:** `npm run validate:levels` re-run against all 23 pre-existing levels produced **numbers identical in every column** (`optimal`, `slack`, `D`, `sync`, `coord`, `draws`, `matrix`, `needs`) to the last known-good run before this sprint's changes — not just "still solvable," but provably the exact same proof. This is the empirical version of the "unrestricted = old behavior" argument, not just a logical inference from the code.
- **Level 24:** solver proves `optimal=10`, `matrix=REQ`, **both `JUMP` and `UNLOCK_RED` individually required** (the ability-knockout check unsolvable without either) — confirming the cross-dependency is real, not just plausible. Witness replays cleanly through the real system pipeline end-to-end (`WitnessReplay.ts`), exercising the new per-player `AbilitySystem` code live, not just in the solver's model.
- `npx vitest run`: 9/9 passing (7 from SPRINT_022's Guest-sync suite, unaffected; 2 new).
- `tsc --noEmit`, `npm run build`: clean throughout — checked after each major piece, not just at the end.

## 5. Governance Note

Per `decisions_needed.md`'s own rule, D14 needs Till, Andreas, and Chris to sign off — this sprint has only Till's authorization. Recorded plainly in `decisions_needed.md`'s D14 section and `docs/roadmap.md` for Andreas/Chris to review. The scoped-down shape was specifically chosen so that *if* the team wants something closer to full Option A or C later, or wants to revert this, neither requires touching the 23 pre-existing levels — the restriction is opt-in per level.

## 6. Open / Next

- Options A and B remain on the table if the team wants the *stronger* narrative forcing-function D14 originally envisioned — this sprint resolves the doc/code divergence and ships a real, working asymmetry mechanism, but is explicitly a lighter version than the maximal proposal.
- Two of five roadmap-priority sprints remain: one more cheap mechanic, and the Resonance/Threshold fate (also decision-requiring — will be raised the same way D14 was).
