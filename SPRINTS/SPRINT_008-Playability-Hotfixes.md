# SPRINT 008: Playability Hotfixes — First Playtest Findings

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's first hands-on playtest (local mode). Report: goal invisible, only a fraction of tiles rendered, no sense of which keys are meaningful, the wisp "vanished" after moving, the matrix light's meaning unclear, HOST produced no usable room code, JOIN had no code to enter.

Every reported symptom traced to a concrete defect. All fixed and verified.

---

## 1. Diagnosis → Fix

| Symptom | Root cause | Fix |
|---|---|---|
| "Only a fraction of hex tiles" | `LevelLoaderSystem` never created floor tiles — only the old dev bootstrap did. Campaign levels rendered nothing but entity hexes. | Loader now builds the floor for both dimensions (`gridRadius`, default 3, new optional schema field) |
| "I don't know my goal" | **Every** hex entity (exit, unlock, hazard, threshold) rendered in the *same floor color* — `RenderSystem` ignored `spriteId` entirely. | Three-pass renderer with a readable color code: exit **nexus green** (dim while locked), Shared Unlock **gold** (burnt-out once consumed), hazards by type (blood red / fire orange / door red / door blue / phase teal), threshold pale, collectibles as face-down plate markers |
| "Wisp vanished after moving up twice" | Two causes: (a) the board had **no edges** — wisps could walk off into the void; (b) reaching the exit dissolves P1 *by design* (sequential exit) but nothing explained it, and in local mode you were left controlling a dissolved wisp. | (a) Board bounds: `MovementSystem` rejects moves beyond `gridRadius` (mirrored in the Dead-End BFS **and** the solver — all 15 proofs re-run, identical optimal costs, tuning stays valid). (b) Local mode auto-switches control to P2 when P1 exits, and the Monitor explains it |
| "What is my goal / which keys work / what does the green light mean" | No onboarding layer existed at all. | **`MonitorStrip`** — v0 of The Monitor (`tutorial_design.md`): a diegetic CRT status line that always states the current objective, the active wisp's keys, the unlock hint, matrix click costs, and the Dead-End free-restart prompt. The full concept registry + highlight framing remain the Monitor sprint |
| HOST shows no usable code / JOIN can never connect | `hostGame()` displayed the first 6 chars of a **random** broker id; a Guest connecting to that fragment could never find the real peer — networked play was structurally broken. | Host now claims a deterministic id (`sycoma-<code>`, unambiguous alphabet without 0/O/1/I); Guest connects to exactly that id. 15 s timeouts and real error messages in the lobby |
| Invisible walls | `createWall` had no `Renderable`. | Walls render as solid slate hexes (`SpriteId.WALL_HEX`) |
| `favicon.ico` 404 in console | No favicon. | Inline SVG 🧠 favicon in `index.html` |
| AP display unclear | Vials without a number. | HUD shows `AP <n>` next to the vials |

## 2. Answers to the Playtest Questions

- **Is LOCAL playable?** Yes — it always was the most complete path, but without floor, goal colors, or the Monitor line it was unreadable. The `1`/`2` wisp switch is now displayed, and control hands over to P2 automatically after P1 exits.
- **"Can I improve the situation once the green light is on?"** The green matrix light means an ability node is powered (Level 1: JUMP — a demo, not required). Rotating the plate (1 AP) severs the path and the ability turns off instantly; that is the core risk mechanic, not a toggle to optimize. The Monitor now states the click costs; per-ability explanations arrive with the Monitor concept registry.

## 3. Verification

- `tsc`, `vite build` — clean. Both smoke suites (SPRINT_005/006) pass.
- `validate:levels` re-run **with board bounds in the solver**: 15/15 proofs, optimal costs unchanged — the SPRINT_007 tuning holds.
- Not verified here: a real two-browser PeerJS session (needs two machines/tabs against the public broker). **The room-code fix specifically wants a live HOST+JOIN retest.**

## 4. Still Open (known, deliberate)

- Sprites are still placeholder flats (asset pipeline pending); the color code is the interim language.
- The Threshold "Ready" UI (D8) and the emoji ChatUI remain unwired.
- The Monitor's full trigger/highlight system and the scripted Calibration intro: next Monitor sprint.
