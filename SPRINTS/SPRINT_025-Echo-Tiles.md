# SPRINT 025: Echo Tiles

**Status:** ✅ Completed 2026-07-21
**Trigger:** 4th of 5 roadmap-priority sprints — "one more cheap mechanic" (`docs/roadmap.md` §4/§6), candidates Static Field or Echo Tiles.

---

## 1. Why Echo Tiles, Not Static Field

Both were rated "likely cheap" in `docs/roadmap.md` §4. Before committing, checked what Static Field's effect (chat suppression) would actually be visible against — and found `ChatUI` is a complete, working class that is **never instantiated anywhere in `main.ts`**. Chat isn't wired into the live game at all. Building a mechanic whose entire purpose is suppressing a UI element that doesn't currently exist in play would ship something invisible and untestable in the actual game. Flagged in `docs/roadmap.md` §6 as a prerequisite for Static Field specifically, and picked Echo Tiles instead — its effect (revealing hidden geometry) is fully observable today.

## 2. What Was Built

- **`EchoTile`** (tag component) + `EchoTileDef` (level schema, `q/r/z` only) + `HazardFactory.createEchoTile` (Position + Renderable + Dimension + the tag — no `Static`, no hazard behavior; an avatar walks over it exactly like empty floor).
- **`EchoTileSystem.ts`** — the entire mechanic, and simpler than estimated. `docs/roadmap.md` §4 assumed a new mini hex-grid inset renderer would be needed (the far dimension isn't spatially overlappable with the near board — different screen origins entirely). Instead: `GameState.revealBothDims` already exists, purely as a rendering visibility mask for local single-machine testing (`RenderSystem.ts`, four checks, confirmed by grep to have zero effect on gameplay logic before reusing it). Standing on an Echo Tile forces it `true`, tracked with a ~3-second (180-tick) decay countdown from last contact, then restores whatever value it had before — `false` in real networked play, unaffected (already `true`) in local testing. No new rendering code, no network message: both clients already receive each other's synced positions (`STATE_UPDATE`), so each decides independently whether *its own* view should reveal, exactly like the tutorial layer's local-per-client philosophy.
- Wired into `systems/pipeline.ts` (runs on both Host and Guest, no `localPlayerId` guard — it's pure local rendering state) and `LevelLoaderSystem`'s reset block (`resetEchoTileState()`, preventing timer/base-value leakage across level loads, matching `clearFocusVaults()`'s pattern).
- **`MatrixRenderer`... no** — rendering is handled entirely by the existing `RenderSystem.ts` entity-hex pass; just added a `SpriteId.ECHO_TILE` + `ENTITY_COLORS` entry (teal), no new pass needed.
- **Tutorial popup** (`ECHO_TILE`): level-start briefing, same `levelHasAbility()`-style pattern as JUMP/PHASE/PUSH — fires the moment a level contains an Echo Tile. Explicitly states the privacy boundary: floor plates stay face-down, inventory/Scrap Pool contents never show, only board geometry.
- **Level 25, "Thin Place":** an ordinary RED-door puzzle (level-2 shape) with one Echo Tile placed directly on P1's own path — encountered naturally, not via detour. Wholly optional and cosmetic: the solver has zero awareness of `EchoTile` at all, the same safety argument as Focus Vault (an entity nothing in the required solution touches cannot affect a proof).
- **`src/systems/__tests__/echoTile.test.ts`:** drives an avatar onto the tile, asserts `revealBothDims` flips true, stays true briefly after stepping off, then reverts after the window elapses.

## 3. Verification

- `npx vitest run`: 10/10 passing (7 Guest-sync + 2 Role-Asymmetry + 1 new).
- Solver: level 25 `optimal=10`, `slack=6`, `matrix=REQ`, `needs=[RED]` — the Echo Tile has no bearing on any of these, confirming it's genuinely invisible to the proof.
- Witness replay through the real system pipeline: clean, `LEVEL_COMPLETE`.
- `tsc --noEmit`, `npm run build`: clean.
- `npm run validate:levels`: all 25 levels (see run output attached to this commit).

## 4. Open / Next

- Static Field remains available once `ChatUI` is actually wired into `main.ts` — flagged as its prerequisite in `docs/roadmap.md`, not addressed here (out of scope for "one cheap mechanic").
- One roadmap-priority sprint remains: the Resonance/Threshold fate — also decision-requiring, will be raised the same way D14 was before implementation.
