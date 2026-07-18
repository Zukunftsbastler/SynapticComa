# SPRINT 005: Code Refactor — Persistent AP, Shared Unlock & Dead End

**Status:** ✅ Completed 2026-07-18
**Goal:** Close the docs/code gap left by SPRINT_003/004 — remove the round-based AP system from `src/` and implement the persistent pool, Shared Unlock nodes, and Dead End detection exactly as the docs specify (`mechanics.md §1/§2/§7`, `architecture.md §3/§4`, `digital_implementation.md §5.4/§7`).

---

## 1. What Was Implemented

### Removed (the round system)
- `src/systems/RoundSystem.ts` and `src/components/RoundState.ts` deleted; pipeline in `gameLoop.ts` updated (`APUnlockSystem` now runs after `ThresholdSystem`, matching `architecture.md §4`).
- `PassMessage` removed from the network protocol; the spacebar Pass handler removed from `KeyboardInput.ts`.
- `GameState.roundNumber` removed (replaced by `GameState.deadEnd: boolean`); the board-flip stub no longer "advances a round".
- HUD: round counter replaced by a Dead End indicator; the AP vial row now grows with the pool's high-water mark (a Shared Unlock surge can push the pool above the starting value — never a reset refill, per `art_and_ui.md §5`).

### Added
- **`src/components/APUnlock.ts`** — `{ id, value, triggered }` (ui8), per `architecture.md §3`.
- **`src/entities/ApUnlockFactory.ts`** — one JSON definition creates a *pair* of hex entities (Dim A + Dim B) linked by numeric id (decision D4, option C).
- **`src/systems/APUnlockSystem.ts`** — Host: detects both avatars on an untriggered pair in the same tick → grants `value` AP, marks both halves triggered, broadcasts the new `AP_UNLOCK` message. Guest: consumes `AP_UNLOCK` from `pendingInputs` (the codebase's established "each system filters its own message types" pattern) and mirrors pool + triggered state locally.
- **`src/systems/deadEnd.ts`** — `canAvatarReachExit()` (budget-bounded BFS over the hex grid honoring Static, PhaseBarrier vs. Phase Shift, Lethal vs. Resistances, and P2's locked exit) and `isDeadEnd()` (AP = 0 ∧ no untriggered unlock ∧ neither exit reachable). Evaluated read-only at the end of `LevelTransitionSystem` on **both** clients; sets `GameState.deadEnd` for the HUD.
- **Level schema migration** — `LevelDef` gains required `initialAP` and `apUnlockNodes[]` (D11); `LevelLoaderSystem` seeds the persistent pool from `initialAP` and spawns unlock pairs. New `SpriteId.AP_UNLOCK_NODE` (22).
- **HUD wiring** — `main.ts` now instantiates the HUD via a new `setUiHook()` per-frame callback in `gameLoop.ts` (the HUD class existed but was never mounted). The dev bootstrap world gets a test unlock pair at `(-1, 1)`.

### All 15 level JSONs migrated
Every level now carries `initialAP` and one Shared Unlock pair at `(-1, 1)` in both dimensions — verified free of entities in every level, one hex off the main path so the unlock is a deliberate cooperative detour, not a freebie.

| Levels | initialAP | Unlock value |
|---|---|---|
| 1–9 | 14 | 4 |
| 10 (Tight Budget) | 12 | 4 |
| 11–13, 15 (Threshold) | 16 | 4 |
| 14 (Threshold at Low AP) | 14 | 4 |

> **🔢 Provisional values.** Deliberately generous (safe side: solvable but slack-rich) until the Sprint-14 solver computes `optimalCost` per level and `initialAP = optimalCost + margin` per `level_design.md §6.1`. Chris calibrates the margin curve; the JSON structure is final.

## 2. Decisions Made During Implementation

- **Guest sync via the pending-inputs pattern, not a new applier layer.** The codebase has no generic Guest-side `STATE_UPDATE` consumer yet (pre-existing gap, flagged below). Rather than invent one for this sprint, `AP_UNLOCK` follows the documented convention that each system filters `pendingInputs` for its own message types.
- **Dead End check runs on both clients.** It is read-only and deterministic on synced state (pool via `STATE_UPDATE`/`AP_UNLOCK`, world populated identically at load), so the Guest gets the indicator without extra network traffic.
- **The BFS is the solver's contract.** `canAvatarReachExit(world, state, playerId, budget)` is deliberately shaped like the reachability core in `generative_levels.md §2.5`; Sprint 14 swaps the implementation, not the callers. It is conservative (evaluates the current tick's routing state only) — sufficient because the Dead End condition only binds at AP = 0.
- **`AP_DEFAULT` (4) survives** solely as the dev-bootstrap fallback in `main.ts`/initial `GameState`; real levels always override from `initialAP`.

## 3. Verification

- `npx tsc --noEmit` and `npm run build` — clean.
- Behavioral smoke test (bitECS in Node, no DOM): 12 checks covering no-grant/partial-occupancy/full-trigger (+4 AP, `apMax` high-water, `AP_UNLOCK` queued), one-time-activation guard, reachability with/without budget, P2's locked exit, and the full Dead End condition — **all pass**.
- Vite dev server smoke: module graph for `main.ts`, `APUnlockSystem.ts`, `deadEnd.ts` transforms without errors.
- Not verified: full two-client browser session (no headless browser tooling in this environment). Recommended before the next release: manual two-tab test of an unlock trigger and Guest HUD sync.

## 4. Known Gaps / Deferred (with owners)

- **Free-restart action on Dead End** — the indicator shows, but the restart input waits on the campaign-flow wiring (level reload from `main.ts` is itself still unwired; the dev bootstrap world predates `loadLevel`). → next code sprint.
- **Guest `STATE_UPDATE` consumer missing** (pre-existing, not introduced here): the Guest currently never applies Host position/AP updates. `AP_UNLOCK` handling is in place; the general applier belongs in the networking hardening sprint.
- **Resonance (`Conduit.base`, `ResonanceSystem`)** → SPRINT_007 per plan.
- **Solver replaces the BFS core; level values tightened** → Sprint 14 (`validate:levels`).
