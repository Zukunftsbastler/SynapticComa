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
│  [AP Pool: ●●●○○]          [Round: 3]           │
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
│  [AP Pool: ●●●○○]          [Round: 3]           │
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
│   ├── Renderable.ts        # { spriteId: ui16, visible: ui8, layer: ui8, dirty: ui8 }
│   ├── Dimension.ts         # { layer: ui8 }
│   ├── Movable.ts
│   ├── Pushable.ts
│   ├── Conduit.ts           # { shape: ui8, rotation: ui8, faceMask: ui8 }
│   ├── MatrixNode.ts        # { column: ui8, row: ui8, abilityType: ui8, active: ui8 }
│   ├── Avatar.ts            # { playerId: ui8 }
│   ├── Hazard.ts            # { hazardType: ui8 }
│   ├── Lethal.ts            # { hazardType: ui8 }
│   ├── Health.ts            # { max: ui8, current: ui8 }
│   ├── Resistances.ts       # { fire: ui8, void: ui8, phase: ui8 }
│   ├── Threshold.ts         # { triggered: ui8 }
│   ├── TeleporterComponent.ts
│   ├── Collectible.ts       # tag
│   ├── Static.ts            # tag
│   ├── PhaseBarrier.ts      # tag
│   ├── Exit.ts              # { playerId: ui8 }
│   ├── APPool.ts            # { current: ui8, max: ui8 } — singleton entity
│   └── index.ts
├── /systems
│   ├── InputSystem.ts
│   ├── APSystem.ts
│   ├── RoundSystem.ts
│   ├── MovementSystem.ts
│   ├── CollectionSystem.ts
│   ├── TeleportSystem.ts
│   ├── PushSystem.ts
│   ├── ThresholdSystem.ts
│   ├── MatrixInsertSystem.ts
│   ├── MatrixRotateSystem.ts
│   ├── ScrapPoolSystem.ts
│   ├── MatrixRoutingSystem.ts
│   ├── AbilitySystem.ts
│   ├── CollisionSystem.ts
│   ├── ExitSystem.ts
│   ├── RuleParsingSystem.ts
│   └── RenderSystem.ts
├── /entities
│   ├── PlayerFactory.ts
│   ├── HazardFactory.ts
│   ├── ConduitFactory.ts
│   ├── MatrixNodeFactory.ts
│   ├── TeleporterFactory.ts
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
├── /utils
│   ├── ConduitFaceMask.ts
│   └── MatrixGraph.ts
├── /events
│   └── EventBus.ts
├── /queries.ts
├── /constants.ts
├── /types.ts
├── /world.ts
├── /gameLoop.ts
└── main.ts
/public
├── /sprites
│   ├── hex_id_floor.webp
│   ├── hex_superego_floor.webp
│   └── avatar_id.png
├── /ui
│   ├── icon_phase_shift.svg
│   ├── icon_jump.svg
│   ├── icon_push.svg
│   ├── conduit_straight.svg
│   ├── conduit_curved.svg
│   ├── conduit_t.svg
│   ├── conduit_cross.svg
│   ├── conduit_splitter.svg
│   └── conduit_unknown.svg  # The ??? face-down icon
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
### 5.2 Handling the Dimensional Screen (Networking)

* The game runs the identical deterministic ECS simulation on both clients.
* State Sync: Only inputs (Action Point expenditures) are sent over the network.
* Rendering Mask: The RenderSystem checks the local client's assigned Player ID. If the client is Player 1, it only draws entities where Dimension.layer === 0 and the shared MatrixNodes.

### 5.3 Emoji-Only Chat

The `ChatManager` routes emoji messages via a dedicated PeerJS data channel (separate from game state). On the sender's side, the `ChatUI` presents an emoji picker (no text input). On the receiver's side, the emoji appears in the chat strip. Chat messages are never processed by any ECS system — they are purely a communication aid with no gameplay effect. This enforces communication rules: players can convey urgency or confirmation (✅ 🚫 🔥 ❓) without describing inventory contents.

### 5.4 Level Loading (JSON)

Since the game uses hand-crafted puzzles, levels are strict JSON files. A LevelLoaderSystem reads the JSON, creates the UUIDs, and attaches the components.

```JSON
{
  "id": "level_01",
  "name": "Synaptic Awakening",
  "entities": [
    { "type": "avatar_p1", "q": 0, "r": 0, "z": 0 },
    { "type": "conduit_straight", "q": 2, "r": -1, "z": 1 }
  ]
}
```
## 6. Claude Code Sprint Guidelines

To maintain a stable architecture, development follows sequential, isolated sprints. See `docs/implementation_plan.md` for the full sprint breakdown. Prompts must be written in English.

Canonical sprint sequence:
1. Project scaffold + game loop
2. ECS components (all 18 components including Health, Resistances, Lethal, APPool, Exit)
3. Hex grid rendering (PixiJS, axial math, dimension masking)
4. Movement + AP system (real-time shared pool, lockout, Pass action)
5. Collection system + inventory (hidden conduit reveal on collection)
6. DNA Matrix rendering + Insert mechanic (2 AP) + Rotate mechanic (1 AP) + Scrap Pool
7. Matrix routing (BFS) + Ability system (Jump, Push, Phase Shift, Unlock, Fire Immunity)
8. Collision system (Health/Lethal/Resistances) + Teleport + Threshold + Rule parsing
9. Level loader + JSON pipeline + Levels 1–5 + Cutscene player (intro sequence)
10. Networking (PeerJS) + emoji-only chat + lobby UI
11. HUD + inventory panel + ability panel + Neural Collapse screen
12. Campaign flow (sequential exit, ExitSystem) + Levels 6–10
13. Levels 11–15 (Threshold introduction and advanced Threshold puzzles)