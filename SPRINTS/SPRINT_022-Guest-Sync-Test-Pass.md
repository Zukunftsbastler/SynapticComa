# SPRINT 022: Guest-Side Network Sync Test Pass

**Status:** ✅ Completed 2026-07-21
**Trigger:** Till: "Implementiere die fünf Punkte [aus `docs/roadmap.md` §6] sukzessive in fünf Sprints." First of five — chosen as the opener because it carried the roadmap's own "highest silent-failure risk" label and required no design decision.

---

## 1. What Was Missing

Zero automated tests existed anywhere in the project (`find . -iname "*.test.ts"` — no hits, no test runner in `package.json`). The correctness story rested entirely on `validate:levels`' solver-proof + witness-replay pipeline — excellent for *level* correctness, silent about `NetworkSystem`, `GuestSyncSystem`, or any Guest-side message-application logic. Flagged first in SPRINT_016, restated unchanged in `docs/roadmap.md` §1.

## 2. What Was Built

- **`vitest`** added as the test runner (Vite-native, near-zero config given the project already has a working `vite.config.ts` with the `@/` alias). `vite.config.ts` gained a `test` block (`environment: 'node'` — headless ECS/protocol tests, no DOM needed) and `package.json` gained `"test": "vitest run"`.
- **`src/systems/__tests__/guestSync.test.ts`** — seven tests, all reusing the exact technique `WitnessReplay.ts` proved out in SPRINT_016: run the real `systems/pipeline.ts` headless in Node via `loadLevel` + `runCoreSystems`. Extended one step further here: **two sequential simulations in one process** — a "Host" phase whose real `GameState.outboundMessages` are captured, then a completely fresh "Guest" phase (a second `loadLevel` call, which resets every module-level singleton the game relies on — `entityRegistry`, `inventory`, `scrapPool`, `focusVaults` — via the loader's own existing reset logic) that applies those captured messages exactly as a real Guest client would receive them.
- **Coverage:** all six Host→Guest message types get at least one test — `STATE_UPDATE` (movement), `MATRIX_STATE_UPDATE` (insert, full reconcile), `AP_UNLOCK`, `FOCUS_VAULT` (the newest, riskiest addition — SPRINT_020), `COLLECTED` (explicitly asserting the collection **privacy rule**: P1's collected shape must never leak into the Guest's own inventory), `INVENTORY_UPDATE` (Scrap Pool draw, same privacy check from the other direction), and `PHASE_UPDATE` (sequential exit — asserts P2's exit `Static` flag actually clears on the Guest).

## 3. Result

**No bugs found in the Guest-sync logic itself.** Every one of the first four test failures traced back to arithmetic in the *test*, not the system under test — forgetting to account for the AP cost of walking avatars onto a Shared-Unlock/Focus-Vault pair before asserting the post-trigger pool value, and one level (17, "Signal Chain") where a collectible deliberately sits on a `LOCKED_RED` hazard hex (SPRINT_017's "plate hidden on the door" design) and genuinely isn't reachable without routing RED first — not a bug, a test that hadn't accounted for the level's own puzzle. Once corrected, all seven passed against the *unmodified* Guest-sync code. Reported as a clean result, not a non-finding: the whole point of a "highest-risk, never tested" label is that it could have gone either way.

## 4. Verification

- `npx vitest run`: 7/7 passing.
- `tsc --noEmit`: clean.
- `npm run build`: clean.
- No level, solver, or system source changed — `validate:levels` re-run not required and not performed.

## 5. Open / Next

- Still not covered: real two-process/PeerJS transport (this suite verifies message-*application* logic, not serialization or actual WebRTC delivery), and all UI-layer code (`src/ui/`, `src/rendering/`) has zero test coverage.
- The Host/Guest-in-one-process technique here is reusable for future Guest-sync-relevant mechanics — any new Host→Guest message type should get a test in this file following the same pattern.
- Four sprints remain per Till's five-point request (`docs/roadmap.md` §6): marking unbuilt-but-documented systems explicitly, D14, one more cheap mechanic, and the Resonance/Threshold fate — the last two require a design decision, not just engineering, and will be raised as such before implementation.
