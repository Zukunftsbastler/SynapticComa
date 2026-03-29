# Dimensional Nexus / Synaptic Coma — Digital Implementation Plan

## Foundational Design Decisions (Pre-Sprint)

Before sprints begin, these architectural commitments are locked and must never be revisited mid-project.

### Decision 1: bitECS Entity Addressing
bitECS uses dense integer entity IDs (not UUIDs) internally. A separate `entityRegistry: Map<string, number>` maps designer-facing string keys (e.g., `"avatar_p1"`, `"conduit_7"`) to bitECS numeric IDs at load time. UUID strings appear only in JSON level files and network messages, never in hot-path ECS queries.

### Decision 2: Determinism Contract
Both clients run the identical system pipeline in the identical order every tick. The game loop processes systems in a fixed sequence:
```
InputSystem → APSystem → MovementSystem → CollectionSystem → TeleportSystem →
ThresholdSystem → MatrixRoutingSystem → AbilitySystem → RuleParsingSystem → RenderSystem
```
No system may read time-varying browser APIs. All randomness is seeded from the level ID and a shared pre-game handshake nonce.

### Decision 3: AP as Shared Singleton
AP is not a component on an entity. It lives in a plain TypeScript singleton `GameState` object (`{ apPool: number, apMax: number, pendingInputs: InputEvent[] }`). Both clients maintain this object identically because inputs are applied in arrival order, deduplicated by sequence number. The singleton is reset on level load.

### Decision 4: Conduit Pipe Connectivity Model
Each conduit shape encodes its open faces as a bitmask over 4 cardinal directions (East, South, West, North = bits 0–3). A straight conduit horizontal = `0b0101` (E+W open). Curved NE = `0b0011` (E+N). T-junction open to E/S/W = `0b0111`. Rotation applies a bit-rotate operation. Connection is valid if and only if adjacent conduit faces are both open toward each other.

### Decision 5: Rendering Architecture
The `RenderSystem` does not directly drive PixiJS. Instead it writes to a `RenderCommandBuffer` (a plain array of typed command objects). A thin `PixiDriver` class (not a bitECS system) consumes that buffer once per frame and calls PixiJS APIs. This keeps bitECS systems testable without a DOM.

### Decision 6: Two-Layer Matrix Routing
The DNA Matrix uses two independent 2D arrays: `conduitGrid` for columns 2 and 4, and `nodeGrid` for columns 1, 3, and 5. `MatrixRoutingSystem` performs breadth-first traversal from each source node (col 1) and marks which ability nodes (col 3 and 5) are reachable. Routing re-runs every time any matrix mutation occurs.

---

## Data Schemas

### Component Definitions (bitECS TypedArrays)

```typescript
// src/components/Position.ts
export const Position = defineComponent({
  q: Types.i16,   // axial column
  r: Types.i16,   // axial row
  z: Types.ui8,   // 0 = Dimension A (Id), 1 = Dimension B (Superego)
});

// src/components/Renderable.ts
export const Renderable = defineComponent({
  spriteId: Types.ui16,
  visible:  Types.ui8,
  layer:    Types.ui8,   // PixiJS z-order layer index
  dirty:    Types.ui8,   // 1 = needs re-render this frame
});

// src/components/Dimension.ts
export const Dimension = defineComponent({ layer: Types.ui8 }); // 0=A, 1=B

// src/components/Movable.ts
export const Movable = defineComponent({ canMove: Types.ui8 });

// src/components/Pushable.ts
export const Pushable = defineComponent({ canBePushed: Types.ui8 });

// src/components/Conduit.ts
export const Conduit = defineComponent({
  shape:    Types.ui8,   // 0=straight, 1=curved, 2=T-junction
  rotation: Types.ui8,   // 0,1,2,3 = 0°,90°,180°,270° clockwise
  faceMask: Types.ui8,   // computed bitmask: bits 0-3 = E,S,W,N open faces
});

// src/components/MatrixNode.ts
export const MatrixNode = defineComponent({
  column:      Types.ui8, // 1–5
  row:         Types.ui8, // 0-indexed
  abilityType: Types.ui8, // maps to AbilityType enum
  active:      Types.ui8, // 1 = currently powered
});

// src/components/Avatar.ts
export const Avatar = defineComponent({ playerId: Types.ui8 }); // 0=P1, 1=P2

// src/components/Hazard.ts
export const Hazard = defineComponent({ hazardType: Types.ui8 });

// src/components/Threshold.ts
export const Threshold = defineComponent({ triggered: Types.ui8 });

// src/components/TeleporterComponent.ts
export const TeleporterComponent = defineComponent({ targetZ: Types.ui8 });

// src/components/Collectible.ts — tag component, no fields
export const Collectible = defineComponent({});

// src/components/Static.ts — tag component
export const Static = defineComponent({});
```

### JSON Level Schema

```jsonc
{
  "id": "level_01",
  "name": "Synaptic Awakening",
  "apPerRound": 4,
  "thresholdEnabled": false,
  "dimensionA": {
    "gridRadius": 4,
    "entities": [
      { "id": "avatar_p1",       "type": "avatar",    "q": 0,  "r": 0,  "z": 0, "playerId": 0 },
      { "id": "conduit_a1",      "type": "conduit",   "q": 2,  "r": -1, "z": 0, "shape": 0, "rotation": 0 },
      { "id": "hazard_chasm_a1", "type": "hazard",    "q": 1,  "r": 1,  "z": 0, "hazardType": 0 },
      { "id": "exit_a1",         "type": "exit",      "q": 3,  "r": -2, "z": 0 },
      { "id": "teleporter_a1",   "type": "teleporter","q": -1, "r": 2,  "z": 0, "targetZ": 1 }
    ]
  },
  "dimensionB": {
    "gridRadius": 4,
    "entities": [
      { "id": "avatar_p2",  "type": "avatar",  "q": 0,  "r": 0,  "z": 1, "playerId": 1 },
      { "id": "conduit_b1", "type": "conduit", "q": -2, "r": 1,  "z": 1, "shape": 1, "rotation": 1 }
    ]
  },
  "matrix": {
    "rows": 5,
    "sources": [
      { "row": 0, "playerId": 0 },
      { "row": 1, "playerId": 1 }
    ],
    "tier1Abilities": [
      { "row": 0, "abilityType": 1 },
      { "row": 2, "abilityType": 2 }
    ],
    "tier2Abilities": [
      { "row": 1, "abilityType": 5 }
    ],
    "initialConduits": {
      "column2": [
        { "row": 0, "shape": 0, "rotation": 0 },
        { "row": 1, "shape": 1, "rotation": 2 }
      ],
      "column4": []
    }
  },
  "rules": [
    { "type": "global", "effect": "wall_is_stop" }
  ],
  "threshold": null
}
```

### Network Message Schema

```typescript
// src/network/messages.ts
interface BaseMessage {
  seq:      number;     // monotonic sequence number per sender
  senderId: 0 | 1;
  tick:     number;
}

interface MoveAvatarMessage extends BaseMessage {
  type: 'MOVE_AVATAR';
  entityId: string;
  dq: number;
  dr: number;
}

interface InsertConduitMessage extends BaseMessage {
  type:           'INSERT_CONDUIT';
  column:         2 | 4;
  fromTop:        boolean;
  shape:          0 | 1 | 2;
  rotation:       0 | 1 | 2 | 3;
  sourceEntityId: string;
}

interface ThresholdReadyMessage extends BaseMessage {
  type:  'THRESHOLD_READY';
  ready: boolean;
}

type GameMessage = MoveAvatarMessage | InsertConduitMessage | ThresholdReadyMessage | { type: 'END_TURN' } & BaseMessage;

interface HandshakeMessage {
  type:    'HANDSHAKE';
  nonce:   number;
  levelId: string;
  role:    0 | 1;
}
```

---

## Sprint Plan

---

### Sprint 1 — Project Scaffold and Game Loop Skeleton

**Goal**: Running Vite + TypeScript project. bitECS and PixiJS installed. Fixed-timestep game loop in `main.ts`. Full folder structure. No game logic.

**Duration**: 1 day | **Depends on**: Nothing

**Files to Create**:
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.ts`, `src/world.ts`, `src/gameLoop.ts`, `src/constants.ts`, `src/types.ts`

**Key Logic**:

`src/constants.ts` — `FIXED_TIMESTEP = 1000/60`, `MAX_DELTA = 200`, `MATRIX_ROWS = 5`, `MATRIX_COLS = 5`, `AP_DEFAULT = 4`.

`src/types.ts` — enums: `AbilityType { NONE=0, JUMP=1, PUSH=2, UNLOCK_RED=3, UNLOCK_BLUE=4, TELEPORT=5, PHASE_SHIFT=6, FIRE_IMMUNITY=7 }`, `HazardType { CHASM=0, LOCKED_RED=1, LOCKED_BLUE=2, FIRE=3, LASER=4 }`, `ConduitShape { STRAIGHT=0, CURVED=1, T_JUNCTION=2 }`.

`src/world.ts` — calls `createWorld()` from bitECS, exports the singleton `world`.

`src/gameLoop.ts` — fixed-timestep accumulator loop:
```typescript
let accumulator = 0, lastTime = 0;
function tick(timestamp: number) {
  const delta = Math.min(timestamp - lastTime, MAX_DELTA);
  lastTime = timestamp;
  accumulator += delta;
  while (accumulator >= FIXED_TIMESTEP) {
    runSystems(world);
    accumulator -= FIXED_TIMESTEP;
  }
  renderFrame(world);
  requestAnimationFrame(tick);
}
```

`vite.config.ts` — `resolve: { alias: { '@': '/src' } }`, `assetsInclude: ['**/*.webp', '**/*.json']`.

**Acceptance Criteria**:
- `npm run dev` opens a black canvas 1280×720 with no console errors.
- `npm run build` produces a dist folder under 50 KB (before assets).
- TypeScript strict-mode passes with zero errors.
- Game loop logs "tick N" at stable 60 FPS.

---

### Sprint 2 — ECS Component Definitions and Entity Registry

**Goal**: All 13 bitECS components defined. Reusable `EntityRegistry` mapping string keys to bitECS IDs. `SpriteRegistry` mapping `spriteId` numbers to asset paths.

**Duration**: 1 day | **Depends on**: Sprint 1

**Files to Create**:
- `src/components/Position.ts`, `Renderable.ts`, `Dimension.ts`, `Movable.ts`, `Pushable.ts`, `Conduit.ts`, `MatrixNode.ts`, `Avatar.ts`, `Hazard.ts`, `Threshold.ts`, `TeleporterComponent.ts`, `Collectible.ts`, `Static.ts`, `index.ts`
- `src/registry/EntityRegistry.ts`, `SpriteRegistry.ts`

**Key Logic**:

`EntityRegistry.ts`:
```typescript
export class EntityRegistry {
  private map = new Map<string, number>();
  register(key: string, eid: number) { this.map.set(key, eid); }
  get(key: string): number {
    const eid = this.map.get(key);
    if (eid === undefined) throw new Error(`EntityRegistry: unknown key "${key}"`);
    return eid;
  }
  clear() { this.map.clear(); }
}
export const entityRegistry = new EntityRegistry();
```

`SpriteRegistry.ts` — `const enum SpriteId { HEX_ID_FLOOR=0, HEX_SUPEREGO_FLOOR=1, AVATAR_P1=2, AVATAR_P2=3, CONDUIT_STRAIGHT=4, CONDUIT_CURVED=5, CONDUIT_T=6, HAZARD_CHASM=7, ... }` mapped to asset paths.

**Acceptance Criteria**:
- Smoke test: create 10 entities, add `Position` + `Dimension`, verify `Position.q` returns `Int16Array` and `Dimension.layer` returns `Uint8Array`.
- Zero circular dependency errors.

---

### Sprint 3 — Hex Grid Rendering (PixiJS)

**Goal**: Hex grids for both dimensions render as colored flat-top hexagons using PixiJS `Graphics`. Avatars appear as colored circles. `RenderSystem` writes to `RenderCommandBuffer`; `PixiDriver` executes it.

**Duration**: 2 days | **Depends on**: Sprint 2

**Files to Create**:
- `src/rendering/HexMath.ts`
- `src/rendering/RenderCommandBuffer.ts`
- `src/rendering/PixiDriver.ts`
- `src/systems/RenderSystem.ts`
- `src/queries.ts`

**Key Logic**:

`HexMath.ts` — flat-top axial-to-pixel conversion:
```typescript
export function axialToPixel(q: number, r: number, S: number) {
  return {
    x: S * (3/2) * q,
    y: S * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r),
  };
}
export function hexCorners(cx: number, cy: number, S: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const rad = (Math.PI / 180) * (60 * i);
    return [cx + S * Math.cos(rad), cy + S * Math.sin(rad)] as [number, number];
  });
}
export const HEX_DIRECTIONS: [number, number][] = [
  [1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]
];
```

`RenderCommandBuffer.ts`:
```typescript
type DrawHexCommand    = { cmd: 'drawHex';    q: number; r: number; fillColor: number; alpha: number };
type DrawSpriteCommand = { cmd: 'drawSprite'; x: number; y: number; spriteId: number; visible: boolean };
type ClearCommand      = { cmd: 'clear' };
type RenderCommand = DrawHexCommand | DrawSpriteCommand | ClearCommand;
```

`queries.ts` — all `defineQuery` calls centralized here:
```typescript
export const renderableQuery    = defineQuery([Position, Renderable, Dimension]);
export const avatarQuery        = defineQuery([Avatar, Position, Dimension]);
export const matrixNodeQuery    = defineQuery([MatrixNode]);
export const conduitQuery       = defineQuery([Conduit, MatrixNode]);
export const movableAvatarQuery = defineQuery([Avatar, Position, Movable]);
export const collectibleQuery   = defineQuery([Collectible, Position, Dimension]);
export const hazardQuery        = defineQuery([Hazard, Position, Dimension]);
export const thresholdQuery     = defineQuery([Threshold, Position]);
export const teleporterQuery    = defineQuery([TeleporterComponent, Position]);
```

`RenderSystem.ts` — dimension visibility mask: hex-grid entities (`Dimension` component) only drawn when `Dimension.layer[eid] === localPlayerId`. DNA Matrix entities (`MatrixNode`) always drawn.

**Acceptance Criteria**:
- Two hex grids render side-by-side at 40px hex size.
- Player 1 sees only Dimension A tiles; toggling `localPlayerId` shows Dimension B.
- DNA Matrix renders as a 5×5 square grid with placeholder colored rectangles.
- 60 FPS with 200 entities.

---

### Sprint 4 — Movement System and Avatar Input

**Goal**: Avatars move on the hex grid via keyboard. Movement costs 1 AP. `APSystem` enforces the shared pool. Local input produces `MoveAvatarMessage` objects in `pendingInputs`. `MovementSystem` processes queued inputs against ECS state.

**Duration**: 2 days | **Depends on**: Sprint 3

**Files to Create**:
- `src/systems/MovementSystem.ts`
- `src/systems/APSystem.ts`
- `src/systems/InputSystem.ts`
- `src/state/GameState.ts`
- `src/input/KeyboardInput.ts`

**Key Logic**:

`GameState.ts`:
```typescript
export interface GameStateData {
  apPool:        number;
  apMax:         number;
  localPlayerId: 0 | 1;
  pendingInputs: GameMessage[];
  outboundMessages: GameMessage[];
  currentLevel:  string;
  roundNumber:   number;
  thresholdState: { p1Ready: boolean; p2Ready: boolean };
  thresholdEnabled: boolean;
  phase: 'SETUP' | 'PLAYING' | 'THRESHOLD' | 'LEVEL_COMPLETE';
}
```

`KeyboardInput.ts` — flat-top hex direction mapping: `W/S` → `(0,-1)/(0,1)`, `Q/E` → `(-1,0)/(1,0)`, `A/D` → `(-1,1)/(1,-1)`. On keydown, create `MoveAvatarMessage` with `dq`/`dr` and push to `GameState.pendingInputs`.

`MovementSystem.ts`:
```typescript
export function MovementSystem(world: IWorld, state: GameStateData): void {
  const moveInputs = state.pendingInputs.filter(m => m.type === 'MOVE_AVATAR');
  for (const input of moveInputs) {
    const eid = entityRegistry.get(input.entityId);
    if (Movable.canMove[eid] !== 1) continue;
    const tq = Position.q[eid] + input.dq;
    const tr = Position.r[eid] + input.dr;
    const tz = Position.z[eid];
    if (!isHexPassable(world, tq, tr, tz)) continue;
    if (state.apPool < 1) continue;
    Position.q[eid] = tq;
    Position.r[eid] = tr;
    state.apPool -= 1;
    Renderable.dirty[eid] = 1;
  }
  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'MOVE_AVATAR');
}
```

**Acceptance Criteria**:
- Avatar 1 moves on Dimension A via WASD; Avatar 2 on Dimension B via IJKL (local stub).
- AP decrements from 4 to 0; inputs at 0 AP silently rejected.
- Avatars cannot enter cells with `Static` entities.

---

### Sprint 5 — Collection System and Player Inventory

**Goal**: Moving onto a `Collectible` conduit hex removes it from the grid and stores it in the player's private inventory array. 0 AP cost.

**Duration**: 1 day | **Depends on**: Sprint 4

**Files to Create**:
- `src/systems/CollectionSystem.ts`
- `src/state/InventoryState.ts`

**Key Logic**:

`InventoryState.ts`:
```typescript
export interface CollectedConduit {
  entityId: string;
  shape:    ConduitShape;
  rotation: number;
}
export const inventory = { player0: [] as CollectedConduit[], player1: [] as CollectedConduit[] };
```

`CollectionSystem.ts` — runs after `MovementSystem`. For each avatar, find `Collectible` entities at the same `(q,r,z)`. On match: read `Conduit.shape[ceid]`/`Conduit.rotation[ceid]`, push to player inventory, call `removeEntity(world, ceid)`, unregister from `entityRegistry`.

**Acceptance Criteria**:
- Moving onto a conduit hex removes the hex entity from render.
- Player's inventory array gains a `CollectedConduit` entry.
- Debug HUD (`F1`) shows per-player inventory count.

---

### Sprint 6 — DNA Matrix Rendering and Conduit Insert Mechanic

**Goal**: The DNA Matrix renders as a 5-column grid. Players insert conduit plates from inventory into column 2 or 4. The column-shift mechanic ejects the opposite-end tile into inventory (Das verrückte Labyrinth). Costs 1 AP.

**Duration**: 3 days | **Depends on**: Sprint 5

**Files to Create**:
- `src/systems/MatrixInsertSystem.ts`
- `src/rendering/MatrixRenderer.ts`
- `src/ui/MatrixUI.ts`
- `src/utils/ConduitFaceMask.ts`

**Key Logic**:

`ConduitFaceMask.ts`:
```typescript
// Bits: 0=East, 1=South, 2=West, 3=North
export const BASE_MASKS: Record<ConduitShape, number> = {
  [ConduitShape.STRAIGHT]:   0b0101, // E+W (horizontal)
  [ConduitShape.CURVED]:     0b0011, // E+S
  [ConduitShape.T_JUNCTION]: 0b0111, // E+S+W
};

export function rotateMask(mask: number, rotations: number): number {
  let m = mask & 0b1111;
  for (let i = 0; i < rotations % 4; i++) {
    m = ((m << 1) | (m >> 3)) & 0b1111;  // clockwise bit-rotate
  }
  return m;
}

export function computeFaceMask(shape: ConduitShape, rotation: number): number {
  return rotateMask(BASE_MASKS[shape], rotation);
}

export function facesConnect(maskA: number, maskB: number, direction: 0|1|2|3): boolean {
  const [aFace, bFace] = [[0,2],[1,3],[2,0],[3,1]][direction];
  return ((maskA >> aFace) & 1) === 1 && ((maskB >> bFace) & 1) === 1;
}
```

`MatrixInsertSystem.ts` — on `INSERT_CONDUIT` input: collect all entities in the target column sorted by row; eject the last (or first) entity back into inventory; shift remaining entities by ±1 row; create new entity at row 0 or MATRIX_ROWS-1; deduct 1 AP; consume the conduit from player inventory.

`MatrixUI.ts` — handles mouse events on the matrix grid. Shows the local player's inventory as an insertion palette. `R` key rotates conduit before insertion. Only fires `InsertConduitMessage` for `senderId === GameState.localPlayerId`.

**Acceptance Criteria**:
- Insert from top shifts all tiles down; bottom tile ejected to inventory.
- Insert from bottom shifts up; top tile ejected.
- Conduit face masks visually rotate correctly.
- Player 2 inventory never visible in Player 1 UI.

---

### Sprint 7 — Matrix Routing System and Ability Activation

**Goal**: After every matrix mutation, `MatrixRoutingSystem` runs BFS from source nodes to determine which ability nodes are powered. `AbilitySystem` applies ability effects (adding/removing components on avatar entities).

**Duration**: 3 days | **Depends on**: Sprint 6

**Files to Create**:
- `src/systems/MatrixRoutingSystem.ts`
- `src/systems/AbilitySystem.ts`
- `src/utils/MatrixGraph.ts`

**Key Logic**:

`MatrixGraph.ts` — rebuilds a `MatrixCell[5][MATRIX_ROWS]` grid from ECS state each routing pass. Source nodes in col 0 emit East unconditionally. Conduit columns (1, 3) traverse via face-mask connectivity. Ability nodes (cols 2, 4) receive from the West; col 2 also emits East to col 3.

`MatrixRoutingSystem.ts` — BFS from each source row. Movement rules:
- East only between columns (never West).
- North/South within the same conduit column via face-mask connectivity.
- Ability nodes in col 2 propagate East toward col 3 when reached.
- Reset `MatrixNode.active = 0` for all nodes at start of each run.

`AbilitySystem.ts` — diffs the newly-active ability set against the previously-active set. For each ability transition:
- `JUMP` active → add `JumpAbility` tag component to all avatars.
- `UNLOCK_RED` active → remove `Static` from all `Hazard` entities with `hazardType === LOCKED_RED`.
- Deactivation reverses all mutations. Instant door re-lock is intentional.

**Acceptance Criteria**:
- Straight pipe connecting source → ability node activates it each frame.
- Breaking the path deactivates the ability on the next frame.
- Locked red door has `Static` when `UNLOCK_RED` inactive; no `Static` when active.
- T-junction simultaneously activates two ability nodes.
- Full 5-column path activates a Tier 2 ability.

---

### Sprint 8 — Teleport System, Threshold System, and Rule Parsing System

**Goal**: `TeleportSystem` flips avatar Z-layer (same q/r). `ThresholdSystem` triggers board-flip when both avatars stand on threshold hexes simultaneously. `RuleParsingSystem` implements Baba Is You style: aligned entity-operator-property triples activate global rules.

**Duration**: 3 days | **Depends on**: Sprint 7

**Files to Create**:
- `src/systems/TeleportSystem.ts`
- `src/systems/ThresholdSystem.ts`
- `src/systems/RuleParsingSystem.ts`
- `src/events/EventBus.ts`

**Key Logic**:

`EventBus.ts` — typed pub/sub. Events: `ABILITY_ACTIVATED`, `ABILITY_DEACTIVATED`, `THRESHOLD_TRIGGERED`, `LEVEL_COMPLETE`, `BOARD_FLIP`, `RULE_CHANGED`, `ENTITY_MOVED`, `TELEPORT_OCCURRED`. Systems emit events; they never call other systems directly.

`TeleportSystem.ts` — runs after `MovementSystem`. For each teleporter entity: if any avatar shares its `(q,r,z)`, set `Position.z[avatarEid] = TeleporterComponent.targetZ[teleporterEid]`. Cost: 0 AP (automatic on movement). Emits `TELEPORT_OCCURRED`.

`ThresholdSystem.ts` — queries all threshold hexes. If P1 avatar and P2 avatar are each on their respective threshold hexes in the same tick: emit `BOARD_FLIP`. The event is emitted exactly once; threshold hexes become inactive after firing.

`RuleParsingSystem.ts` — only re-evaluates when `ENTITY_MOVED` fires for a `RuleWord` entity (dirty flag pattern). Scans designated `ruleSyntaxPositions` from the level JSON. On triplet match (`Subject IS Property`): emit `RULE_CHANGED` with payload. A `RuleEnforcerSystem` subscribes and adds/removes `Movable`, `Pushable`, `Static` etc. to the affected entity archetypes.

**Acceptance Criteria**:
- Avatar on teleporter hex with `targetZ=1` changes `Position.z` to 1 in one tick.
- Both avatars on threshold hexes emits `BOARD_FLIP` exactly once.
- `WALL IS PUSH` syntax configuration grants `Movable` to all wall entities.
- Removing one rule-word from a syntax position removes the conferred component on the next evaluation.

---

### Sprint 9 — Level Loader System and JSON Pipeline

**Goal**: `LevelLoaderSystem` parses full JSON level schema, creates entities via factory functions, populates `EntityRegistry`, resets all state. Levels 1–5 authored in JSON.

**Duration**: 2 days | **Depends on**: Sprint 8

**Files to Create**:
- `src/systems/LevelLoaderSystem.ts`
- `src/entities/PlayerFactory.ts`, `HazardFactory.ts`, `ConduitFactory.ts`, `MatrixNodeFactory.ts`, `TeleporterFactory.ts`, `ExitFactory.ts`
- `src/levels/level_01.json` through `level_05.json`
- `src/levels/levelIndex.ts`

**Key Logic**:

Each factory follows the same pattern:
```typescript
export function createAvatar(world: IWorld, def: AvatarDef): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Avatar, eid);
  addComponent(world, Movable, eid);
  addComponent(world, Renderable, eid);
  addComponent(world, Dimension, eid);
  Position.q[eid] = def.q;  Position.r[eid] = def.r;  Position.z[eid] = def.z;
  Avatar.playerId[eid] = def.playerId;
  Movable.canMove[eid] = 1;
  Renderable.spriteId[eid] = def.playerId === 0 ? SpriteId.AVATAR_P1 : SpriteId.AVATAR_P2;
  Renderable.visible[eid] = 1;  Renderable.dirty[eid] = 1;
  Dimension.layer[eid] = def.z;
  entityRegistry.register(def.id, eid);
  return eid;
}
```

`LevelLoaderSystem.ts` — on load: destroy all existing entities via `allEntitiesQuery`, clear `entityRegistry`, reset `GameState` and `inventory`, dispatch factory functions for each entity def, apply initial rules from JSON.

Level progression for levels 1–5:
- **Level 1**: Movement only. No hazards. Matrix has one pre-routed path. Teaches basic controls.
- **Level 2**: Single locked door. One conduit already in inventory. Teaches matrix insertion.
- **Level 3**: Teleporter introduced. Avatar must flip dimension to reach exit.
- **Level 4**: Column-shift required. Inserting new conduit breaks an existing path. Teaches sequencing.
- **Level 5**: T-junction + shared routing. Both players must coordinate matrix state.

`levelIndex.ts` — `export const LEVEL_ORDER: string[] = ['level_01', 'level_02', ...]`.

**Acceptance Criteria**:
- `loadLevel(world, 'level_01', ...)` creates the correct entity count.
- All entities have correct component values.
- Loading level 2 after level 1 leaves zero ghost entities.
- Levels 1–5 playable end-to-end.

---

### Sprint 10 — Networking (PeerJS WebRTC)

**Goal**: Two browser tabs connect via PeerJS. Lobby generates a 6-character room code. `NetworkSystem` serializes and transmits `GameMessage` objects. Determinism validated by periodic state hash comparison.

**Duration**: 3 days | **Depends on**: Sprint 9

**Files to Create**:
- `src/network/PeerJSManager.ts`
- `src/network/NetworkSystem.ts`
- `src/network/messages.ts`
- `src/network/StateHasher.ts`
- `src/ui/LobbyUI.ts`

**Key Logic**:

`PeerJSManager.ts`:
```typescript
export class PeerJSManager {
  private peer: Peer;
  private conn: DataConnection | null = null;
  private onMessageCallback: (msg: GameMessage) => void = () => {};

  async hostGame(): Promise<string> {
    return new Promise(resolve => {
      this.peer.on('open', id => resolve(id.slice(0,6).toUpperCase()));
      this.peer.on('connection', conn => { this.conn = conn; this.setupConnection(conn); });
    });
  }
  async joinGame(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn = this.peer.connect(code.toLowerCase());
      this.conn.on('open', resolve);
      this.conn.on('error', reject);
      this.setupConnection(this.conn);
    });
  }
  private setupConnection(conn: DataConnection) {
    conn.on('data', raw => this.onMessageCallback(raw as GameMessage));
  }
  send(msg: GameMessage | HandshakeMessage) { this.conn?.send(msg); }
  onMessage(cb: (msg: GameMessage) => void) { this.onMessageCallback = cb; }
}
export const peerManager = new PeerJSManager();
```

Handshake sequence: Host sends `HandshakeMessage { nonce, levelId, role: 1 }` → Guest sets `localPlayerId = 1`, loads level → Host sets `localPlayerId = 0`, loads level → both start game loop.

`NetworkSystem.ts` — drains `GameState.outboundMessages` each tick via `peerManager.send()`. Incoming messages inserted into `pendingInputs` by the `onMessage` callback, sorted by `seq` to handle reordering.

`StateHasher.ts` — every 300 ticks: collect all `(q,r,z)` tuples from ECS, sort, compute djb2 hash, send as `STATE_HASH` message. Log desync warning to console on mismatch. Full recovery out of scope.

**Trade-off**: PeerJS public signaling server used for development. For production, replace with self-hosted `peerjs-server`. `PeerJSManager` accepts optional `PeerJSOptions` parameter to make this a one-line config change.

**Acceptance Criteria**:
- Two browser tabs connect. Host = Player 0, Guest = Player 1.
- Move input on host appears on both tabs within 1 frame.
- Conduit insert on guest updates matrix on both tabs.
- State hash matches after 60 seconds on LAN.
- Disconnection pauses game and shows reconnection message.

---

### Sprint 11 — UI/HUD, Render Polish, and Animation

**Goal**: Full HUD with AP pool, turn indicator, inventory count, and active abilities. Dimension visibility masking enforced. Movement/insertion animations via `TweenManager`.

**Duration**: 2 days | **Depends on**: Sprint 10

**Files to Create**:
- `src/ui/HUD.ts`
- `src/ui/InventoryPanel.ts`
- `src/ui/AbilityPanel.ts`
- `src/rendering/AnimationState.ts`
- `src/rendering/TweenManager.ts`

**Key Logic**:

`TweenManager.ts` — lightweight tween pool operating on PixiJS `DisplayObject` properties only (`x`, `y`, `alpha`, `tint`). **Critical constraint**: tween state must never feed back into ECS component data. Called from `PixiDriver.flush()`, not from any ECS system. Uses `easeInOut` curve.

`HUD.ts` — subscribes to `EventBus` for `AP_CHANGED`, `ROUND_CHANGED`, `ABILITY_ACTIVATED`, `ABILITY_DEACTIVATED`. Renders AP pool as filled circles. Renders active ability icons on right panel.

Dimension masking: PixiJS mask (`PIXI.Graphics` rectangle) applied to the hex grid container. This is a graphical mask only — ECS data for the other dimension is still simulated, just not rendered. The other dimension's grid shows as fog/silhouette.

**Acceptance Criteria**:
- AP display shows correct count; 0 AP grays out action buttons.
- Remote player's hex grid shows as silhouette, not tile data.
- Avatar movement animates with 120ms ease-in-out tween.
- Conduit insert animates as 150ms column slide.
- Ability nodes glow when `MatrixNode.active === 1`.

---

### Sprint 12 — Campaign Flow, Exit System, and Levels 6–10

**Goal**: Progression system advancing through `LEVEL_ORDER`. Level Complete screen. `ExitSystem` detecting simultaneous avatar arrival at exit hexes. Levels 6–10 authored in JSON.

**Duration**: 3 days | **Depends on**: Sprint 11

**Files to Create**:
- `src/systems/ExitSystem.ts`
- `src/ui/LevelCompleteScreen.ts`
- `src/state/ProgressionState.ts`
- `src/levels/level_06.json` through `level_10.json`
- Updated `src/levels/levelIndex.ts`

**Key Logic**:

`ExitSystem.ts` — queries `Exit` tag component entities. When both P1 exit and P2 exit are occupied by the correct avatars in the same tick: emit `LEVEL_COMPLETE`.

`ProgressionState.ts` — `{ currentLevelIndex, completedLevels: Set<string>, highScores: Map<string, number> }`. Persisted to `localStorage` under `'dimensional_nexus_progress'`. Loaded on startup.

`LevelCompleteScreen.ts` — PixiJS overlay on `LEVEL_COMPLETE` event. "Next Level" button sends a `LOAD_LEVEL` message to peer before both clients call `loadLevel()`.

Level design for levels 6–10:
- **Level 6**: Column shift breaks an existing path. Players must plan insert order.
- **Level 7**: Two conduit columns active simultaneously. First T-junction coordination puzzle.
- **Level 8**: Red herring locked door — the required ability is impossible to route given available conduits.
- **Level 9**: Teleporter chain — flip dimension, collect conduit, flip back, insert.
- **Level 10**: Tight AP budget. Routing requires 3 inserts to unlock movement across a chasm.

**Acceptance Criteria**:
- Completing level 1 shows Level Complete overlay.
- "Next Level" loads level 2 on both clients simultaneously.
- `localStorage` persists progress across browser refreshes.
- All 10 levels playable end-to-end.
- Level 8's red herring confirmed unsolvable (regression test).

---

## Sprint Dependency Graph

```
Sprint 1  (Scaffold)
    └──► Sprint 2  (ECS Components)
              └──► Sprint 3  (Hex Rendering)
                        └──► Sprint 4  (Movement + AP)
                                  └──► Sprint 5  (Collection)
                                            └──► Sprint 6  (Matrix Insert)
                                                      └──► Sprint 7  (Routing + Abilities)
                                                                └──► Sprint 8  (Teleport/Threshold/Rules)
                                                                          └──► Sprint 9  (Level Loader + Levels 1-5)
                                                                                    └──► Sprint 10 (Networking)
                                                                                              └──► Sprint 11 (HUD + Polish)
                                                                                                        └──► Sprint 12 (Campaign + Levels 6-10)
```

The dependency is strictly sequential. No sprint can begin before the prior one passes its acceptance criteria.

---

## Critical Design Trade-offs

### Trade-off 1: bitECS vs. Manual ECS
bitECS TypedArray SoA storage is cache-optimal but unfamiliar: field access is always array-indexed (`Position.q[eid]`), never object-property. The `EntityRegistry` wrapper bridges the gap between designer-facing string keys and bitECS integer IDs. Do not redesign this; it is the correct approach for deterministic simulation.

### Trade-off 2: Lockstep vs. Rollback Networking
Lockstep (both clients process inputs simultaneously) introduces input latency equal to RTT. For a cooperative puzzle game where turns are deliberate rather than real-time, this is acceptable and far simpler than rollback netcode with bitECS world serialization.

### Trade-off 3: BFS Routing vs. Pre-computed Routing
Full BFS runs on every matrix mutation. For a 5×5 matrix with at most 5 BFS traversals (25 cells × 5 = 125 operations per mutation), this is negligible. Simplicity outweighs caching complexity here.

### Trade-off 4: All Data on Both Clients vs. Differential Sync
Both clients hold ECS data for both dimensions but mask rendering. A technically sophisticated player could inspect DevTools to see the other dimension's data. For a cooperative puzzle game with no competitive cheating incentive, this is an acceptable risk that keeps the network protocol simple.

### Trade-off 5: JSON Levels vs. Procedural Generation
Hand-crafted levels are mandated by the design doc to preserve "logic puzzle" quality. The JSON schema is human-editable. A level editor UI is out of scope for sprints 1–12; build it in Sprint 13+ once content demand is proven.

### Trade-off 6: PeerJS Public Signaling
Public PeerJS signaling server (`0.peerjs.com`) is used for development. For production: self-hosted `peerjs-server` on Fly.io free tier. `PeerJSManager` accepts `PeerJSOptions` to make this a one-line config change.

---

## Critical Files (Highest Implementation Risk)

| File | Risk |
|------|------|
| `src/utils/ConduitFaceMask.ts` | Off-by-one in `rotateMask` creates invisible routing failures |
| `src/systems/MatrixRoutingSystem.ts` | BFS direction logic must be strictly East-only between columns |
| `src/systems/LevelLoaderSystem.ts` | Teardown bugs create ghost entities corrupting all subsequent levels |
| `src/network/PeerJSManager.ts` | Message sequencing race conditions are the hardest bugs to reproduce |
| `src/systems/AbilitySystem.ts` | Transition diff logic must correctly re-lock doors on ability loss |

---

## Post-Sprint 12 Roadmap

- **Sprint 13**: Level editor UI for authoring levels 11–30.
- **Sprint 14**: Levels 16–30 (Spatial Complexity — larger hex grids, tight AP management).
- **Sprint 15**: Threshold mechanic levels 31–40 (one-way board flip, asymmetric pre-jump clues).
- **Sprint 16**: Audio (neural/organic soundscape for Dimension A, electronic/sterile for Dimension B).
- **Sprint 17**: Visual polish (Dimension A — pulsing purples/reds; Dimension B — cold blues/neon).
- **Sprint 18**: Self-hosted PeerJS server deployment + matchmaking lobby.
- **Sprint 19**: Accessibility pass (icon contrast, colorblind mode for conduit shapes).
- **Sprint 20**: Physical board game asset export pipeline (generating printable hex grid PDFs from level JSON).
