# SPRINT 006: Campaign Flow & Guest Sync Hardening

**Status:** ✅ Completed 2026-07-18
**Goal:** Make the game actually playable as a campaign — boot into real levels instead of the dev scaffold, wire the win/failure/Dead-End flows, and close the biggest networking gap: the Guest never applied any authoritative Host state.

---

## 1. What Was Implemented

### Campaign controller (`main.ts` rewritten)
The hardcoded dev bootstrap world is gone. Boot sequence is now: **Lobby (HOST / JOIN / LOCAL) → `loadLevel` → play**, with the full level lifecycle:

- **Level complete** → `LevelCompleteScreen`; the Host (or local player) advances to the next level; progress persists via `ProgressionState` (`localStorage`). The campaign resumes at the persisted position on the next session.
- **First failure** → automatic retry reload after 800 ms, `failureCount` carried over (`mechanics.md §7` — the retry is not consumed silently reset).
- **Second failure** → `NeuralCollapseScreen` → back to the lobby (page reload; progress persisted).
- **Dead End** → `Enter` restarts the level **without** touching `failureCount` (the free restart the docs promise).
- Per-level UI lifecycle: `MatrixUI` listeners are torn down and rebuilt on every load (the Sprint-6b memory-leak fix is now actually exercised); HUD, InventoryPanel and AbilityPanel poll `GameState` and survive reloads.

### Guest synchronisation (`GuestSyncSystem`, new)
Before this sprint the Guest applied **nothing** — `STATE_UPDATE`, `MATRIX_STATE_UPDATE` and `INVENTORY_UPDATE` were emitted by the Host and silently accumulated in the Guest's input queue. Now:

| Message | Guest effect |
|---|---|
| `STATE_UPDATE` | Avatar position + AP pool (and `APPool` component mirror) |
| `MATRIX_STATE_UPDATE` | Full reconcile of conduit columns 2/4 + face-down Scrap-Pool count (new `scrapCount` field — count is public, contents never cross the wire) |
| `INVENTORY_UPDATE` | Drawn plate enters the Guest's inventory — only if the Guest drew it |
| `COLLECTED` *(new)* | Collected floor conduit removed from the mirror world; plate revealed only to its collector (privacy rule from `communication_rules.md`) |
| `PHASE_UPDATE` *(new)* | Phase/failure transitions; unlocks P2's exit when `p1HasExited` |
| `LEVEL_LOAD` *(new)* | Guest follows every Host level load (next level, retry, free restart) via a handler registered by the campaign controller |

New Host emitters: `CollectionSystem` broadcasts `COLLECTED`; `LevelTransitionSystem` broadcasts `PHASE_UPDATE` on avatar destruction, P1 exit, and level completion (its P2-exit-unlock logic is exported as `activateP2Exit` and reused by the Guest applier). `LEVEL_LOAD` is sent directly via `peerManager` because `resetGameState` clears the outbound queue mid-load.

### Local mode done right (`viewPlayerId`)
The old dev toggle (keys 1/2) switched `localPlayerId`, which silently **disabled the simulation** (every Host-only system returned early when "playing P2"). New `GameState.viewPlayerId` separates *authority role* from *acting player*: the simulation always stays Host-authoritative; 1/2 toggles which wisp is viewed/controlled. `RenderSystem` masking, `InventoryPanel`, `MatrixUI` (inventory + `senderId`) and `KeyboardInput` now read `viewPlayerId`; message *routing* still keys off `localPlayerId`. In networked play the two are identical. The Lobby gained a **LOCAL** button for this mode.

### Bug fixed along the way
`vite.config.ts` listed `**/*.json` in `assetsInclude`, which makes the `vite:json` plugin fail on JSON *module* imports. Latent until now — the old `main.ts` never imported `LevelLoaderSystem`, so the level JSONs were never in the bundle graph. Removed; production build restored.

## 2. Decisions

- **The Host drives all level transitions.** The Guest's complete/failure screens are non-interactive ("WAITING FOR HOST…"); its state converges via `LEVEL_LOAD`. This avoids double-advance desyncs without any consensus protocol.
- **Neural Collapse returns to the lobby via page reload.** The docs call for a Level Select screen, which does not exist yet; a reload is an honest, robust stand-in (progress is persisted). Level Select remains open (see §4).
- **Scrap-Pool mirroring uses placeholder plates.** The Guest stores `scrapCount` dummy entries — pile size is public knowledge; shapes stay Host-only.

## 3. Verification

- `npx tsc --noEmit` and `npm run build` — clean (after the `assetsInclude` fix).
- New behavioral smoke test (bitECS in Node): 12 checks — Host emits `COLLECTED`/`PHASE_UPDATE`, P2-exit unlock on both sides, Guest applies position/AP/matrix/scrap-count/inventory-privacy/phase, queue fully consumed — **all pass**. SPRINT_005's 12-check suite still passes (regression).
- Vite dev server serves the new module graph (`main.ts`, `LobbyUI`, level JSONs).
- Not verified: a real two-browser PeerJS session and the visual flows (no headless browser tooling here). **Recommended manual test:** HOST + JOIN in two tabs — move, insert, draw, unlock, complete Level 1, die twice on Level 2.

## 4. Known Gaps / Deferred

- **Level Select screen** (docs reference it for Neural Collapse and post-campaign) — not yet built.
- **Threshold "Ready" UI** (decision D8: button when standing on the hex) — `THRESHOLD_READY` messages have no sender yet.
- **Cutscene player / intro panels** (`narrative.md §5`) — untouched.
- **Guest desync on conduit `sync_*` entity ids:** after a matrix reconcile the Guest's conduit ids differ from the Host's — harmless today (rotation targets by column/row, inserts reference inventory ids) but worth unifying when the network layer is hardened further.
- Next per plan (`SPRINT_004 §4`): **Solver & `validate:levels`** (Sprint-14 logic), then Resonance, then The Monitor.
