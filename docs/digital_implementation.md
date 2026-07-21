# Digital Implementation & Tech Stack

## 1. Development Philosophy for AI Assistance
This game is designed to be built using an AI coding assistant (Claude Code). Therefore, the tech stack avoids visual editors (like Godot or Unity) in favor of a 100% code-based, web-native environment. This ensures the AI can read, understand, and modify the entire codebase without breaking serialized scene files.

## 2. The Tech Stack
* **Language:** **TypeScript**. Strict typing is mandatory for a stable ECS, ensuring components have predictable data structures.
* **ECS Framework:** **bitECS**. A blazing-fast, data-oriented ECS library for JavaScript/TypeScript. It forces strict separation of data (Components) and logic (Systems), perfectly mirroring our physical board game rules.
* **Rendering Engine:** **PixiJS**. A lightweight 2D WebGL rendering engine. It handles hexagonal math, sprite manipulation, and the UI Matrix effortlessly without forcing an overarching engine architecture.
* **Networking:** **PeerJS (WebRTC)**. For the asymmetric multiplayer. It allows direct peer-to-peer connections between two browsers, sending lightweight JSON state updates (e.g., "Player 1 pushed Conduit X") without needing a dedicated backend server.
* **Build Tool:** **Vite**. For rapid local development and hot-module replacement.

## 3. Screen Layout Per Player

Each player runs their own browser tab (networked play). The layouts are mirrored but each player only sees their own dimension.

### Player 1 Screen (The Id — Dimension A)
```
┌─────────────────────────────────────────────────┐
│  [AP Pool: ●●●○○]                               │
├─────────────────┬───────────────────────────────┤
│                 │                               │
│  ID HEX GRID    │    DNA MATRIX (5×5)           │
│  (purple/red)   │    (shared, always visible)   │
│  Dim A only     │                               │
│                 ├───────────────────────────────┤
│                 │  INVENTORY (private, hidden)  │
│                 │  [???] [???] [curved]         │
└─────────────────┴───────────────────────────────┘
│  CHAT (emoji-only text box)                     │
└─────────────────────────────────────────────────┘
```

### Player 2 Screen (The Superego — Dimension B)
```
┌─────────────────────────────────────────────────┐
│  [AP Pool: ●●●○○]                               │
├─────────────────────┬───────────────────────────┤
│                     │                           │
│  DNA MATRIX (5×5)   │  SUPEREGO HEX GRID        │
│  (shared)           │  (blue/white)             │
│                     │  Dim B only               │
├─────────────────────┤                           │
│  INVENTORY (hidden) │                           │
│  [???] [straight]   │                           │
└─────────────────────┴───────────────────────────┘
│  CHAT (emoji-only text box)                     │
└─────────────────────────────────────────────────┘
```

**Key layout rules:**
- Each player sees **only their own dimension's Hex Grid** (full detail, full colour).
- The DNA Matrix is visible in full on **both** screens — it is the shared workspace.
- Inventory is private: each player sees only their own collected conduits (face-up in their own inventory, hidden from their partner).
- The AP pool counter is displayed prominently and identically on **both** screens.
- The Chat box is emoji-only — no free text. This enforces communication rule compliance without a moderation layer.

### Local / Same-Screen Debug Mode
For single-machine testing, both grids are shown side-by-side with the matrix centered between them. Player 1 uses keyboard left-side (WASD), Player 2 uses right-side (IJKL). The inventory panels are stacked vertically in a right sidebar.

---

## 4. Project File Structure

The repository is structured by ECS domain rather than by feature.

```text
/src
├── /components
│   ├── Position.ts          # { q: i16, r: i16, z: ui8 }
│   ├── Renderable.ts        # { spriteId: ui16, visible: ui8, layer: ui8, dirty: ui8, isTweening: ui8 }
│   ├── Dimension.ts         # { layer: ui8 }
│   ├── Movable.ts
│   ├── Pushable.ts
│   ├── Conduit.ts           # { shape: ui8, rotation: ui8, faceMask: ui8, base: ui8 }
│   ├── TutorialTrigger.ts   # { conceptId: ui8, radius: ui8 } — optional first-encounter marker
│   ├── MatrixNode.ts        # { column: ui8, row: ui8, abilityType: ui8, active: ui8 }
│   ├── Avatar.ts            # { playerId: ui8 }
│   ├── Hazard.ts            # { hazardType: ui8 }
│   ├── Lethal.ts            # { hazardType: ui8 }
│   ├── Health.ts            # { max: ui8, current: ui8 }
│   ├── Resistances.ts       # { fire: ui8, laser: ui8 }
│   ├── Threshold.ts         # { triggered: ui8 }
│   ├── Collectible.ts       # tag
│   ├── Static.ts            # tag
│   ├── PhaseBarrier.ts      # tag
│   ├── Exit.ts              # { playerId: ui8 }
│   ├── APPool.ts            # { current: ui8, max: ui8 } — singleton entity
│   ├── APUnlock.ts          # { id: ui8, value: ui8, triggered: ui8 } — Shared Unlock node data
│   ├── Events.ts            # tag components: BoardFlipEvent, LevelCompleteEvent, AvatarDestroyedEvent, P1ExitedEvent
│   └── index.ts
├── /systems
│   ├── InputSystem.ts
│   ├── APSystem.ts
│   ├── MovementSystem.ts
│   ├── CollectionSystem.ts
│   ├── PushSystem.ts
│   ├── ThresholdSystem.ts
│   ├── APUnlockSystem.ts
│   ├── MatrixInsertSystem.ts
│   ├── MatrixRotateSystem.ts
│   ├── ScrapPoolSystem.ts
│   ├── ResonanceSystem.ts
│   ├── TutorialTriggerSystem.ts
│   ├── MatrixRoutingSystem.ts
│   ├── AbilitySystem.ts
│   ├── CollisionSystem.ts
│   ├── ExitSystem.ts
│   ├── LevelTransitionSystem.ts  # consumes and destroys BoardFlipEvent / LevelCompleteEvent entities
│   └── RenderSystem.ts
├── /entities
│   ├── PlayerFactory.ts
│   ├── HazardFactory.ts
│   ├── ConduitFactory.ts
│   ├── MatrixNodeFactory.ts
│   └── ExitFactory.ts
├── /levels
│   ├── level_01.json … level_15.json
│   ├── cutscene_intro.json  # Panel sequence before Level 1
│   └── levelIndex.ts
├── /network
│   ├── PeerJSManager.ts
│   ├── NetworkSystem.ts
│   ├── messages.ts
│   ├── StateHasher.ts
│   └── ChatManager.ts       # Emoji-only chat routing
├── /rendering
│   ├── HexMath.ts
│   ├── RenderCommandBuffer.ts
│   ├── PixiDriver.ts
│   ├── TweenManager.ts
│   └── CutscenePlayer.ts    # Static panel sequences
├── /ui
│   ├── HUD.ts
│   ├── InventoryPanel.ts
│   ├── AbilityPanel.ts
│   ├── MatrixUI.ts
│   ├── LobbyUI.ts
│   ├── ChatUI.ts
│   ├── LevelCompleteScreen.ts
│   └── NeuralCollapseScreen.ts   # Failure screen (2nd retry)
├── /state
│   ├── GameState.ts
│   ├── InventoryState.ts
│   ├── ScrapPoolState.ts
│   └── ProgressionState.ts
├── /registry
│   ├── EntityRegistry.ts
│   └── SpriteRegistry.ts
├── /generation
│   ├── LevelGenerator.ts    # Reverse-design generator (generative_levels.md §3)
│   ├── LevelSolver.ts       # A*/IDA* solver + reachability core (generative_levels.md §2)
│   ├── DifficultyModel.ts   # Difficulty scoring + target curve (generative_levels.md §4)
│   ├── ZobristTable.ts
│   └── Pcg32.ts
├── /tutorial
│   ├── concepts.ts          # ConceptId registry (tutorial_design.md §2)
│   ├── TutorialState.ts
│   ├── TutorialDirector.ts
│   └── TutorialOverlay.ts
├── /utils
│   ├── ConduitFaceMask.ts
│   └── MatrixGraph.ts
├── /events
│   └── (none — event signalling uses Event Entity tag components in /components/Events.ts)
├── /queries.ts
├── /constants.ts
├── /types.ts
├── /world.ts
├── /gameLoop.ts
└── main.ts
/public
├── /sprites
│   ├── hex_id_floor.webp          # Dim A: dark bruised velvet / aged leather mat
│   ├── hex_superego_floor.webp    # Dim B: frosted glass / scratched surgical steel
│   ├── avatar_p1.webp             # Dim A: jagged obsidian / coagulated resin / yellowed bone
│   ├── avatar_p2.webp             # Dim B: tarnished surgical steel / brushed aluminum
│   ├── hazard_lethal_a.webp       # Dim A lethal: shards of blackened glass (Repressed Fears)
│   ├── hazard_lethal_b.webp       # Dim B lethal: electrical arcs (Firewall Laser)
│   ├── hazard_locked_red.webp     # Dim A locked door: fleshy sphincter / braided thorns
│   ├── hazard_locked_blue.webp    # Dim B locked door: rusted vault door / jammed puzzle-lock
│   ├── hazard_phase_barrier.webp  # Phase barrier hex (passable only under Phase Shift)
│   ├── hazard_fire.webp           # Fire hazard tile
│   ├── exit_nexus_a.webp          # Dim A exit (Nexus Hex)
│   └── exit_nexus_b.webp          # Dim B exit (Nexus Hex)
├── /ui
│   ├── icon_phase_shift.svg
│   ├── icon_jump.svg
│   ├── icon_push.svg
│   ├── icon_fire_immunity.svg
│   ├── conduit_straight.svg
│   ├── conduit_curved.svg
│   ├── conduit_t.svg
│   ├── conduit_cross.svg
│   ├── conduit_splitter.svg
│   └── conduit_unknown.svg        # The ??? face-down icon for uncollected floor conduits
└── /cutscenes
    ├── intro_01_flatline.webp
    ├── intro_02_split.webp
    └── intro_03_wisps.webp
## 5. ECS Implementation Details
### 5.1 Data-Oriented Components

In bitECS, components are FlatArrays (TypedArrays). This means a component holds no functions.

```TypeScript
// Example: A component is just memory allocation
export const Position = defineComponent({
  q: Types.i16, // Axial Q coordinate
  r: Types.i16, // Axial R coordinate
  z: Types.ui8  // Dimension layer (0 or 1)
});
```

```typescript
// src/components/APUnlock.ts
export const APUnlock = defineComponent({
  id:        Types.ui8, // unique identifier for this unlock node
  value:     Types.ui8, // AP granted when triggered
  triggered: Types.ui8  // 0 = available, 1 = consumed (one-time activation)
});
```
### 5.2 Handling the Dimensional Screen (Networking)

* The game runs the identical deterministic ECS simulation on both clients.
* State Sync: Only inputs (Action Point expenditures) are sent over the network.
* Rendering Mask: The RenderSystem checks the local client's assigned Player ID. If the client is Player 1, it only draws entities where Dimension.layer === 0 and the shared MatrixNodes.

### 5.3 Emoji-Only Chat

The `ChatManager` routes emoji messages via a dedicated PeerJS data channel (separate from game state). On the sender's side, the `ChatUI` presents an emoji picker (no text input). On the receiver's side, the emoji appears in the chat strip. Chat messages are never processed by any ECS system — they are purely a communication aid with no gameplay effect. This enforces communication rules: players can convey urgency or confirmation (✅ 🚫 🔥 ❓) without describing inventory contents.

### 5.4 Level Loading (JSON)

Levels are strict JSON files conforming to `LevelSchema.ts` — hand-crafted for the campaign, emitted by `LevelGenerator` for generated play. `LevelLoaderSystem` reads the JSON, registers string IDs in the `EntityRegistry`, and attaches the components.

> **Note:** the example below is illustrative and predates several schema changes (conduits carry no `base` field — Neuro-Resonance is unimplemented, `mechanic_roadmap.md` F1 — and there is no `solverProof` field; `validate:levels` writes proof data to the separate generated `levelMeta.json` instead). `LevelSchema.ts` is the authoritative source. Two entity/array kinds added in SPRINT_019 aren't shown: `{ "type": "pushable_block", ... }` (Impulse Blocks, `mechanic_roadmap.md` #2) and the level-level `"focusVaultNodes": [...]` array (Focus Vault, #8) — see `mechanics.md §8` and the `level_22`/`level_23` JSON files for real examples of both.

```jsonc
{
  "id": "level_01",
  "name": "Synaptic Awakening",
  "initialAP": 8,                       // derived: optimalCost + margin (level_design.md §6.1)
  "apUnlockNodes": [
    { "id": "unlock_01", "value": 4, "hexA": { "q": 2, "r": 0 }, "hexB": { "q": -2, "r": 0 } }
  ],
  "thresholdEnabled": false,
  "initialInventory": { "player0": [], "player1": [] },
  "scrapPool": [{ "shape": 1, "rotation": 0, "base": 2 }],
  "entities": [
    { "type": "avatar", "id": "avatar_p1", "playerId": 0, "q": 0, "r": 2, "z": 0 },
    { "type": "exit",   "id": "exit_p2",   "playerId": 1, "q": 0, "r": -2, "z": 1, "initiallyLocked": true }
  ],
  "matrix": {
    "nodes":    [{ "id": "node_c3r0", "column": 3, "row": 0, "abilityType": 1 }],
    "conduits": [{ "id": "matrix_col2_row0", "column": 2, "row": 0, "shape": 0, "rotation": 0, "base": 0 }]
  },
  "solverProof": { "optimalCost": 6, "difficulty": 1.0 }   // written by validate:levels / the generator
}
```
## 6. Claude Code Sprint Guidelines

To maintain a stable architecture, development follows sequential, isolated sprints. See `docs/implementation_plan.md` for the full sprint breakdown. Prompts must be written in English.

Canonical sprint sequence:
1. Project scaffold + game loop
2. ECS components (all 23 components including Health, Resistances, Lethal, APPool, APUnlock, Exit, Events, isTweening on Renderable)
3. Hex grid rendering (PixiJS, axial math, dimension masking)
4. Movement + AP system (persistent shared pool, no round lifecycle)
5. Collection system + inventory (hidden conduit reveal on collection)
6. DNA Matrix rendering + Insert mechanic (2 AP) + Rotate mechanic (1 AP) + Scrap Pool
7. Matrix routing (BFS) + Ability system (Jump, Push, Phase Shift, Unlock, Fire Immunity) + CollisionSystem + PushSystem + APUnlockSystem
8. Collision system (Health/Lethal/Resistances) + ThresholdSystem (Ready-toggle) + LevelTransitionSystem (Event Entities)
9. Level loader + JSON pipeline + Levels 1–5 + Cutscene player (intro sequence)
10. Networking (PeerJS) + emoji-only chat + lobby UI
11. HUD + inventory panel + ability panel + Neural Collapse screen
12. Campaign flow (sequential exit, ExitSystem) + Levels 6–10
13. Levels 11–15 (Threshold introduction and advanced Threshold puzzles)
14. Level solver + difficulty model + campaign validation (`validate:levels`) + solver-backed Dead End detection
15. Level generator (endless "Deep Coma" mode, Daily Synapse) + ResonanceSystem + base glyphs
16. Tutorial layer (The Monitor): concept registry, trigger system, overlay, "Calibration" guided script

## 7. Dead End Detection

The game must detect when no forward progress is possible with the current AP pool:

```typescript
// Dead End condition (evaluated after APUnlockSystem each tick):
function isDeadEnd(world: IWorld, state: GameStateData): boolean {
  const apEmpty = APPool.current[state.actionManagerEid] === 0;
  const noUnlocksRemain = apUnlockQuery(world).every(
    eid => APUnlock.triggered[eid] === 1
  );
  const noExitReachable = !canEitherAvatarReachExit(world, state);
  return apEmpty && noUnlocksRemain && noExitReachable;
}
```

When `isDeadEnd()` returns `true`, `LevelTransitionSystem` sets a `DeadEndState` flag. `RenderSystem` responds by dimming the UI and showing the Dead End indicator. This does not consume the retry — it allows a free manual restart.