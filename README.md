# Synaptic Coma

A cooperative 2-player asymmetric puzzle game for two browser tabs, connected peer-to-peer via WebRTC. Players navigate separate hex-grid dimensions and must collaborate through a shared DNA Matrix to route abilities and escape each level together.

> **Art direction:** Medical Macabre Diorama. Dim A (The Id) — bruised purples, crimson, obsidian. Dim B (The Superego) — surgical steel, fluorescent blue. The Matrix is a rusted Specimen Tray with Bakelite conduit plates; etched grooves fill with viscous nerve-fluid when powered.

---

## Table of Contents

- [Gameplay Overview](#gameplay-overview)
- [Getting Started](#getting-started)
- [Controls](#controls)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
  - [ECS Foundation](#ecs-foundation)
  - [Host Authority Model](#host-authority-model)
  - [System Pipeline](#system-pipeline)
  - [Event Entity Pattern](#event-entity-pattern)
  - [Rendering Pipeline](#rendering-pipeline)
  - [Networking](#networking)
- [Project Structure](#project-structure)
- [Components Reference](#components-reference)
- [Systems Reference](#systems-reference)
- [Level Format](#level-format)
- [Campaign](#campaign)
- [Key Design Decisions](#key-design-decisions)
- [Development](#development)

---

## Gameplay Overview

Each player controls a *wisp* — an avatar on a hex grid. The two grids (Dimension A and Dimension B) are hidden from each other. Players cannot see the other's board or inventory.

The shared **DNA Matrix** is a 5×5 grid of conduit tiles visible to both. Players slide Bakelite conduit plates into the matrix columns to route power from source nodes (left) through to ability nodes (right). Powered ability nodes unlock effects on the hex grids:

| Ability | Effect |
|---|---|
| JUMP | Move 2 hexes in a straight line for 1 AP |
| PUSH | Displace a pushable entity 1 hex for 1 AP |
| UNLOCK_RED | Remove Static from red locked doors |
| UNLOCK_BLUE | Remove Static from blue locked doors |
| PHASE_SHIFT | Pass through Phase Barrier hexes |
| FIRE_IMMUNITY | Become immune to fire hazard tiles |

Each round, players share **4 Action Points (AP)**. Actions cost:
- Move 1 hex — 1 AP
- Insert conduit into matrix — 2 AP
- Rotate a conduit in the matrix — 1 AP
- Draw from Scrap Pool — 1 AP
- Pass — 0 AP (ends the round immediately)

**Win condition:** P1 steps on their exit hex → P1's wisp disappears and P2's exit unlocks → P2 steps on their exit. Level complete.

**Fail condition:** A wisp enters a Lethal hex (chasm, fire, laser) without the matching resistance → `AvatarDestroyedEvent` → level restart. Second failure on the same level triggers Neural Collapse.

**Threshold:** On levels with `thresholdEnabled`, both players can stand on Threshold hexes and confirm ready via the UI. When all four conditions hold simultaneously (both on threshold, both confirmed), a `BoardFlipEvent` fires, triggering a mid-level board transition.

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/Zukunftsbastler/SynapticComa.git
cd SynapticComa
npm install
npm run dev
```

Open two browser tabs at `http://localhost:5173`. In the first tab click **HOST** and share the 6-character room code. In the second tab click **JOIN** and enter the code.

**Local single-machine testing** (no networking): Press `1` or `2` to switch which player you control.

### Build for production

```bash
npm run build     # TypeScript check + Vite bundle → dist/
npm run preview   # Serve the dist/ output locally
```

---

## Controls

### Hex Grid Movement

| Key | P1 direction | P2 direction |
|---|---|---|
| Q / E | West / NE | — |
| A / D | NW / E | — |
| W / S | NW / SE | — |
| I / K | — | NW / SE (P2) |
| J / L | — | W / E (P2) |
| U / O | — | NW / NE (P2) |

Flat-top hex grid; axial coordinates.

### Matrix UI

| Key | Action |
|---|---|
| Tab | Cycle selected inventory slot |
| R | Rotate selected conduit (clockwise) |
| Click matrix column | Insert selected conduit from top or bottom |
| Click conduit in matrix | Rotate that conduit in-place |

### Other

| Key | Action |
|---|---|
| Space | Pass (end round) |
| 1 / 2 | (Dev) Switch controlled player |

---

## Tech Stack

| Technology | Version | Role |
|---|---|---|
| TypeScript | ^5.5 | Strict-mode source language |
| bitECS | ^0.3.40 | Entity Component System (SoA TypedArrays) |
| PixiJS | ^8.5 | WebGL/Canvas renderer |
| PeerJS | ^1.5.4 | WebRTC peer-to-peer data channel |
| Vite | ^6.0 | Dev server and bundler |

---

## Architecture

### ECS Foundation

The game uses **bitECS** — a high-performance ECS where component data lives in `TypedArray` pools (Structure-of-Arrays). Entities are integer IDs; components are pure data with no methods.

All `defineQuery` calls are centralized in [`src/queries.ts`](src/queries.ts) and created once at module-load time. Queries are never created inside system functions.

String entity keys (from level JSON and network messages) are mapped to integer ECS IDs via [`EntityRegistry`](src/registry/EntityRegistry.ts). This keeps hot-path ECS loops free of string lookups.

**Level reload** calls `deleteWorld(currentWorld)` followed by `createWorld()` — never iterates `removeEntity` in a loop. This prevents SoA TypedArray memory fragmentation from archetype migrations.

### Host Authority Model

Player 0 is always the **authoritative host**. All ECS-mutating systems guard with:

```typescript
if (state.localPlayerId !== 0) return;
```

Player 1 (Guest) sends input messages (`MoveAvatarMessage`, `InsertConduitMessage`, etc.) over the PeerJS data channel. The Host processes them, mutates ECS state, and broadcasts `STATE_UPDATE` / `MATRIX_STATE_UPDATE` / `INVENTORY_UPDATE` back. The Guest never mutates ECS directly.

### System Pipeline

Each fixed-timestep tick (60 Hz, 16.67 ms) runs systems in this order:

```
InputSystem
APSystem
RoundSystem
MatrixRoutingSystem      ← BFS: powers ability nodes
AbilitySystem            ← Reconciles component presence (UNLOCK_RED/BLUE, FIRE_IMMUNITY)
MovementSystem           ← MOVE_AVATAR; JUMP (2-hex); PHASE_SHIFT; push queue
PushSystem               ← Resolves push attempts from MovementSystem
CollectionSystem         ← Avatar on Collectible hex → adds to inventory
CollisionSystem          ← Avatar on Lethal hex → AvatarDestroyedEvent
ExitSystem               ← P1 exit → P1ExitedEvent; P2 exit → LevelCompleteEvent
ThresholdSystem          ← Both on threshold + both ready → BoardFlipEvent
MatrixInsertSystem       ← INSERT_CONDUIT: column slide + ejection to Scrap Pool
MatrixRotateSystem       ← ROTATE_CONDUIT: rotate by column+row coordinates
ScrapPoolSystem          ← DRAW_SCRAP: random blind draw from Scrap Pool
LevelTransitionSystem    ← Consumes all event entities; executes effects
NetworkSystem            ← Flush outboundMessages; buffer + sort incomingMessages
```

Fixed timestep with accumulator. Render runs every animation frame regardless of timestep.

### Event Entity Pattern

There is **no EventBus** anywhere in the codebase. Inter-system signals are ephemeral tag component entities:

| Entity type | Created by | Consumed by |
|---|---|---|
| `BoardFlipEvent` | ThresholdSystem | LevelTransitionSystem |
| `AvatarDestroyedEvent` | CollisionSystem | LevelTransitionSystem |
| `P1ExitedEvent` | ExitSystem | LevelTransitionSystem |
| `LevelCompleteEvent` | ExitSystem | LevelTransitionSystem |

Each event entity exists for exactly one tick. `LevelTransitionSystem` calls `removeEntity()` on all of them at the end of the tick.

### Rendering Pipeline

`RenderSystem` writes typed draw commands into `RenderCommandBuffer`. `PixiDriver` (not an ECS system) consumes the buffer and calls PixiJS APIs. This keeps all systems testable without a DOM.

The `Renderable.isTweening` flag (`ui8 = 1`) tells `RenderSystem` to use the `AnimationState` interpolated position instead of raw ECS coordinates, preventing visual stuttering during animations.

`MatrixRenderer` handles the 5×5 DNA Matrix panel separately from the hex grids, drawing Bakelite conduit plates with etched pipe grooves colored by power state.

### Networking

`PeerJSManager` opens two PeerJS `DataConnection` objects per session:
- **main** — `GameMessage | HandshakeMessage` (ECS state)
- **chat** — `ChatMessage` (emoji-only, no ECS effect)

Handshake sequence:
1. Guest connects → sends `HandshakeMessage { nonce, role: 1 }`
2. Host receives → sends `HandshakeMessage { nonce, levelId, role: 0 }`
3. Both call `loadLevel()` and start the game loop

`NetworkSystem` drains `GameState.outboundMessages` each tick and sorts incoming Guest→Host messages by `seq` before inserting into `pendingInputs`.

`StateHasher` computes a djb2 hash of all avatar `(q, r, z)` tuples every 300 ticks and logs a warning on mismatch between peers.

---

## Project Structure

```
src/
├── components/          # 23 bitECS components (pure TypedArray data)
├── entities/            # Entity factory functions (one per entity type)
│   ├── PlayerFactory.ts
│   ├── HazardFactory.ts
│   ├── ConduitFactory.ts
│   ├── MatrixNodeFactory.ts
│   └── ExitFactory.ts
├── input/
│   └── KeyboardInput.ts # Keyboard → pendingInputs / outboundMessages
├── levels/
│   ├── LevelSchema.ts   # TypeScript types for level JSON
│   ├── levelIndex.ts    # LEVEL_ORDER: string[] (all 15 levels)
│   └── level_01.json … level_15.json
├── network/
│   ├── messages.ts      # All network message types
│   ├── PeerJSManager.ts # WebRTC dual-channel wrapper
│   ├── NetworkSystem.ts # Flush outbound; buffer + sort incoming
│   ├── StateHasher.ts   # Periodic desync detection
│   └── ChatManager.ts   # Emoji-only chat routing
├── queries.ts           # All defineQuery calls (module-load time only)
├── registry/
│   ├── EntityRegistry.ts  # string key → bitECS eid map
│   └── SpriteRegistry.ts  # SpriteId enum + asset path map
├── rendering/
│   ├── HexMath.ts           # axialToPixel, hexCorners, HEX_DIRECTIONS
│   ├── RenderCommandBuffer.ts
│   ├── PixiDriver.ts        # Sole PixiJS adapter
│   ├── MatrixRenderer.ts    # DNA Matrix panel drawing
│   ├── AnimationState.ts    # Per-entity interpolated positions
│   └── TweenManager.ts      # Lightweight tween pool (PixiJS props only)
├── state/
│   ├── GameState.ts         # Singleton game state + resetGameState()
│   ├── InventoryState.ts    # Per-player conduit inventories
│   ├── ScrapPoolState.ts    # Shared face-down scrap pool
│   └── ProgressionState.ts  # localStorage campaign progress
├── systems/             # 17 ECS systems
├── ui/
│   ├── MatrixUI.ts          # Click/keyboard matrix interactions
│   ├── HUD.ts               # AP circles, round counter, ability badges
│   ├── InventoryPanel.ts    # Local player conduit inventory display
│   ├── AbilityPanel.ts      # Active ability indicator strip
│   ├── LobbyUI.ts           # Host/Join pre-game screen
│   ├── ChatUI.ts            # Emoji palette + message strip
│   └── LevelCompleteScreen.ts # Win overlay + NeuralCollapseScreen
├── utils/
│   ├── ConduitFaceMask.ts   # Bit-mask helpers (rotateMask, facesConnect)
│   └── MatrixGraph.ts       # Matrix cell graph for routing BFS
├── constants.ts
├── types.ts             # AbilityType, HazardType, ConduitShape enums
├── gameLoop.ts          # Fixed-timestep accumulator loop
├── main.ts              # Bootstrap: PixiJS app, driver, first level
└── world.ts             # Re-exports createWorld / deleteWorld / IWorld
```

---

## Components Reference

| Component | Fields | Notes |
|---|---|---|
| `Position` | `q: i16, r: i16, z: ui8` | Axial hex coords; z = dimension (0=A, 1=B) |
| `Renderable` | `spriteId, visible, layer, dirty, isTweening: ui8` | `isTweening=1` suppresses ECS position read |
| `Dimension` | `layer: ui8` | 0=Dim A, 1=Dim B |
| `Avatar` | `playerId: ui8` | 0=P1, 1=P2 |
| `Movable` | `canMove: ui8` | Removed from P1 on exit |
| `Pushable` | `canBePushed: ui8` | Block-type entities |
| `Health` | `max, current: ui8` | One-hit: max=1, current=1 |
| `Resistances` | `fire, laser: ui8` | Set by AbilitySystem |
| `Hazard` | `hazardType: ui8` | HazardType enum value |
| `Lethal` | `hazardType: ui8` | Co-present on CHASM, FIRE, LASER hazards |
| `Static` | _(tag)_ | Blocks movement; added to locked doors & threshold after flip |
| `PhaseBarrier` | _(tag)_ | Blocks unless `phaseShiftActive` |
| `Conduit` | `shape, rotation, faceMask: ui8` | Matrix conduit plate |
| `MatrixNode` | `column, row, abilityType, active: ui8` | Source / ability / conduit nodes |
| `Collectible` | _(tag)_ | Conduit tile on hex grid; auto-collected on step |
| `Exit` | `playerId: ui8` | Sequential — P2 starts with `Static` |
| `Threshold` | `triggered: ui8` | Hex that enables ready toggle |
| `APPool` | `current, max: ui8` | Singleton entity |
| `RoundState` | `phase: ui8` | 0=Active, 1=RoundOver |
| `BoardFlipEvent` | _(tag)_ | One-tick event entity |
| `LevelCompleteEvent` | _(tag)_ | One-tick event entity |
| `AvatarDestroyedEvent` | `playerId: ui8` | One-tick event entity |
| `P1ExitedEvent` | _(tag)_ | One-tick event entity |

---

## Systems Reference

| System | Host-only | Description |
|---|---|---|
| `InputSystem` | No | No-op in fixed-step; `enqueueNetworkInput` for guest messages |
| `APSystem` | Yes | Mirrors `GameState.apPool` → `APPool` singleton entity |
| `RoundSystem` | Yes | Detects PASS or AP=0; resets AP; increments round |
| `MatrixRoutingSystem` | No | BFS: source → conduit col2 → ability col3 → conduit col4 → ability col5 |
| `AbilitySystem` | No | Reads powered nodes; reconciles `Static`/`Resistances` component presence |
| `MovementSystem` | Yes | MOVE_AVATAR; JUMP (2-hex); PHASE_SHIFT; queues push attempts |
| `PushSystem` | Yes | Moves pushable entities from queued push attempts |
| `CollectionSystem` | Yes | Avatar on Collectible → inventory; removes entity |
| `CollisionSystem` | Yes | Avatar on Lethal → resistance check → `AvatarDestroyedEvent` |
| `ExitSystem` | Yes | P1 on exit → `P1ExitedEvent`; P2 on exit → `LevelCompleteEvent` |
| `ThresholdSystem` | Yes | Both on threshold + both p*Ready → `BoardFlipEvent` + lock threshold |
| `MatrixInsertSystem` | Yes | Column slide; boundary ejection to Scrap Pool; 2 AP |
| `MatrixRotateSystem` | Yes | Rotate by column+row; recomputes faceMask; 1 AP |
| `ScrapPoolSystem` | Yes | Blind random draw from Scrap Pool; 1 AP |
| `LevelTransitionSystem` | No | Consumes all event entities; executes effects; destroys entities |
| `NetworkSystem` | No | Flush outbound; sort and buffer incoming by `seq` |
| `RenderSystem` | No | Writes draw commands to `RenderCommandBuffer` |
| `LevelLoaderSystem` | — | Async; `deleteWorld` + `createWorld` + populate from JSON |

---

## Level Format

Levels are JSON files in `src/levels/` conforming to `LevelSchema.ts`.

```jsonc
{
  "id": "level_01",
  "name": "Tutorial: Movement",
  "thresholdEnabled": false,
  "initialInventory": {
    "player0": [{ "entityId": "inv_p1_straight", "shape": 0, "rotation": 0 }],
    "player1": []
  },
  "scrapPool": [{ "shape": 1, "rotation": 0 }],
  "entities": [
    { "type": "avatar",    "id": "avatar_p1",   "playerId": 0, "q": 0, "r": 2,  "z": 0 },
    { "type": "exit",      "id": "exit_p1",     "playerId": 0, "q": 0, "r": -2, "z": 0 },
    { "type": "exit",      "id": "exit_p2",     "playerId": 1, "q": 0, "r": -2, "z": 1, "initiallyLocked": true },
    { "type": "hazard",    "id": "fire_tile",   "hazardType": 3, "q": 1, "r": 0, "z": 0 },
    { "type": "threshold", "id": "thresh_p1",   "q": 0, "r": 1, "z": 0 },
    { "type": "wall",      "id": "wall_01",     "q": -2, "r": 0, "z": 0 }
  ],
  "matrix": {
    "nodes": [
      { "id": "node_c3r0", "column": 3, "row": 0, "abilityType": 1 }
    ],
    "conduits": [
      { "id": "matrix_col2_row0", "column": 2, "row": 0, "shape": 0, "rotation": 0 }
    ]
  }
}
```

**Entity types:** `avatar` | `exit` | `threshold` | `hazard` | `phase_barrier` | `collectible` | `wall`

**`hazardType`:** 0=CHASM, 1=LOCKED_RED, 2=LOCKED_BLUE, 3=FIRE, 4=LASER

**`shape`:** 0=STRAIGHT, 1=CURVED, 2=T_JUNCTION, 3=CROSS, 4=SPLITTER

**`column`** for ability nodes: 3 (Tier 1) or 5 (Tier 2). For conduits: 2 or 4.

Source nodes (column 1, one per row) are created automatically by `LevelLoaderSystem` — they do not appear in the JSON.

### Loading a level

```typescript
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { setWorld } from '@/gameLoop';

setWorld(await loadLevel(world, 'level_02'));
```

---

## Campaign

15 hand-crafted levels in sequential order. Progress is persisted to `localStorage` under `synaptic_coma_progress`.

| # | Name | Key mechanic introduced |
|---|---|---|
| 1 | Tutorial: Movement | Basic hex movement, sequential exit |
| 2 | Locked Door | Matrix insertion, UNLOCK_RED |
| 3 | Scrap Pool | Blind draw economy |
| 4 | Column Shift | Insert order matters — shifting breaks paths |
| 5 | Shared Routing | Both conduit columns, T-junction coordination |
| 6 | Insert Sequence | Two locks, insert ordering |
| 7 | T-Junction Coordination | col4 routing + Tier 2 abilities |
| 8 | Red Herring | Impossible route — teaches constraint reading |
| 9 | Forced Rotation | Rotate (1 AP) beats insert (2 AP) |
| 10 | Tight Budget | 3 inserts, sequential exit under AP pressure |
| 11 | Threshold Tutorial | FIRE_IMMUNITY required before Threshold; environmental tutorialization |
| 12 | Pre-Flip Jump | JUMP must be routed before triggering board flip |
| 13 | Critical Rotation | Rotate is the critical move post-flip |
| 14 | Threshold at Low AP | Offset starts; tight AP across board flip |
| 15 | Master Set Teaser | Cross (+) conduit in Scrap Pool is the only solution |

Second failure on any level shows the **Neural Collapse** screen.

---

## Key Design Decisions

**No EventBus.** All inter-system signals are ephemeral event entities (`BoardFlipEvent`, etc.) consumed and destroyed by `LevelTransitionSystem`. Prevents invisible coupling and makes signal lifetime explicit.

**Host authority, not lockstep.** One simulation (Player 0). Guest sends inputs; Host sends authoritative state. Simpler than rollback; acceptable for cooperative puzzle pace.

**`deleteWorld` on level reload.** bitECS SoA TypedArrays fragment on archetype churn. Destroying and recreating the world is the only safe way to reset between levels.

**Continuous AbilitySystem.** No state diffing or caching. Every tick, `AbilitySystem` re-evaluates powered nodes and reconciles `Static`/`Resistances` presence. `hasComponent` guards prevent redundant archetype migrations. This prevents the "permanently unlocked door" bug class.

**Column+row for RotateConduitMessage.** The rotate message carries explicit `{ column, row }` coordinates, not an entity ID string. Avoids regex fragility and EntityRegistry coupling.

**isTweening flag.** `Renderable.isTweening = 1` tells `RenderSystem` to read from `AnimationState` instead of ECS `Position`. Tween state never writes back to ECS.

**Emoji-only chat.** The separate PeerJS `chat` DataConnection carries only `ChatMessage { emoji, senderId }`. No ECS effect, no text input, no shared game state.

---

## Development

```bash
npm run dev      # Start Vite dev server (hot module replacement)
npm run build    # tsc strict check + Vite production bundle
npm run preview  # Serve dist/ locally
```

### Adding a new level

1. Create `src/levels/level_NN.json` conforming to `LevelSchema.ts`
2. Add `'level_NN'` to `LEVEL_ORDER` in `src/levels/levelIndex.ts`
3. Add the import entry to `LEVEL_MODULES` in `src/systems/LevelLoaderSystem.ts`

### Adding a new ability

1. Add a value to `AbilityType` in `src/types.ts`
2. Handle the new type in `AbilitySystem.ts`
3. Place an ability node in the relevant level JSON with the new `abilityType` value

### Adding a new hazard type

1. Add a value to `HazardType` in `src/types.ts`
2. Update `hazardSpriteId()` in `src/entities/HazardFactory.ts`
3. Add `Lethal` or `Static` component logic in `HazardFactory.createHazard()`
4. Add resistance handling in `CollisionSystem.ts` if applicable

---

## Repository

[https://github.com/Zukunftsbastler/SynapticComa](https://github.com/Zukunftsbastler/SynapticComa)
