# Dimensional Nexus / Synaptic Coma — Digital Implementation Plan

## Foundational Design Decisions (Pre-Sprint)

Before sprints begin, these architectural commitments are locked and must never be revisited mid-project.

### Decision 1: bitECS Entity Addressing
bitECS uses dense integer entity IDs (not UUIDs) internally. A separate `entityRegistry: Map<string, number>` maps designer-facing string keys (e.g., `"avatar_p1"`, `"conduit_7"`) to bitECS numeric IDs at load time. UUID strings appear only in JSON level files and network messages, never in hot-path ECS queries.

### Decision 2: The "Host Authority" Network Pattern
Lockstep networking with simultaneous AP expenditure is mathematically impossible without desyncs. Instead, the game uses strict **Host Authority**. Player 0 (Host) runs the authoritative ECS simulation. Player 1 (Guest) runs a predictive client. When Player 1 presses a key, the input is sent directly to the Host. The Host queues all inputs, evaluates them in sequence against the AP pool, mutates the ECS, and sends `STATE_UPDATE` messages back to the Guest. This guarantees 100% determinism.

The system pipeline runs strictly on the Host:
```
InputSystem → APSystem → RoundSystem → MovementSystem → CollectionSystem →
PushSystem → ThresholdSystem → MatrixInsertSystem → MatrixRotateSystem →
ScrapPoolSystem → MatrixRoutingSystem → AbilitySystem → CollisionSystem →
ExitSystem → LevelTransitionSystem → RenderSystem → NetworkSystem
```

### Decision 3: AP as Shared Singleton (Host-Authoritative)
AP lives in a plain TypeScript singleton `GameState` (`{ apPool: number, apMax: number }`). **Only the Host mutates this pool.** A dedicated `APPool` singleton entity (bitECS components: `APPool { current: ui8, max: ui8 }`) mirrors this state for HUD rendering on both clients. The Guest's AP display is updated by incoming `STATE_UPDATE` messages from the Host.

### Decision 4: Conduit Pipe Connectivity Model
Each conduit shape encodes its open faces as a bitmask over 4 cardinal directions (East, South, West, North = bits 0–3). A straight conduit horizontal = `0b0101` (E+W open). Curved NE = `0b0011` (E+N). T-junction open to E/S/W = `0b0111`. Rotation applies a bit-rotate operation. Connection is valid if and only if adjacent conduit faces are both open toward each other.

### Decision 5: Rendering Architecture
The `RenderSystem` does not directly drive PixiJS. Instead it writes to a `RenderCommandBuffer` (a plain array of typed command objects). A thin `PixiDriver` class (not a bitECS system) consumes that buffer once per frame and calls PixiJS APIs. This keeps bitECS systems testable without a DOM.

### Decision 6: Two-Layer Matrix Routing
The DNA Matrix uses two independent 2D arrays: `conduitGrid` for columns 2 and 4, and `nodeGrid` for columns 1, 3, and 5. `MatrixRoutingSystem` performs breadth-first traversal from each source node (col 1) and marks which ability nodes (col 3 and 5) are reachable. Routing re-runs every time any matrix mutation occurs.

### Decision 7: Event Entities (No Pub/Sub)
Standard JavaScript Event Emitters (Pub/Sub) break the linear, data-oriented flow of an ECS. Systems communicate via **data**, not callbacks. If a system needs to broadcast an event (e.g., a Board Flip), it creates a new blank entity and attaches a specific tag component (e.g., `BoardFlipEvent`). Downstream systems query for that component, react, and destroy the event entity at the end of the tick. There is no `EventBus.ts`.

### Decision 8: Separation of Logical and Visual State
To prevent the ECS and the Tween engine from fighting over sprite positions, `Renderable` entities use an `isTweening: ui8` flag. When `MovementSystem` updates `Position`, `RenderSystem` detects the coordinate delta, hands the animation off to `TweenManager`, and sets `Renderable.isTweening[eid] = 1`. While `isTweening` is `1`, `RenderSystem` does not overwrite the sprite's screen position with the ECS `Position` coordinates, preventing visual stuttering.

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
  spriteId:   Types.ui16,
  visible:    Types.ui8,
  layer:      Types.ui8,   // PixiJS z-order layer index
  dirty:      Types.ui8,   // 1 = needs re-render this frame
  isTweening: Types.ui8,   // 1 = tween owns the sprite position; RenderSystem ignores ECS coords
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

// src/components/Collectible.ts — tag component, no fields
export const Collectible = defineComponent({});

// src/components/Static.ts — tag component
export const Static = defineComponent({});

// src/components/PhaseBarrier.ts — tag component
export const PhaseBarrier = defineComponent({});

// src/components/Lethal.ts
export const Lethal = defineComponent({ hazardType: Types.ui8 });

// src/components/Health.ts  — avatars only; max:1 current:1
export const Health = defineComponent({ max: Types.ui8, current: Types.ui8 });

// src/components/Resistances.ts — boolean flags as ui8 (0/1)
export const Resistances = defineComponent({ fire: Types.ui8, laser: Types.ui8 });

// src/components/Exit.ts
export const Exit = defineComponent({ playerId: Types.ui8 }); // which player's exit this is

// src/components/APPool.ts — singleton entity only
export const APPool = defineComponent({ current: Types.ui8, max: Types.ui8 });

// src/components/Events.ts — tag components; created and destroyed within a single tick
export const BoardFlipEvent    = defineComponent({});
export const LevelCompleteEvent = defineComponent({});
export const AvatarDestroyedEvent = defineComponent({ playerId: Types.ui8 });
export const P1ExitedEvent     = defineComponent({});
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
      { "id": "exit_a1",         "type": "exit",      "q": 3,  "r": -2, "z": 0 }
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
  shape:          0 | 1 | 2 | 3 | 4;  // 3=Cross, 4=Splitter (Master Set)
  rotation:       0 | 1 | 2 | 3;
  sourceEntityId: string;
  apCost:         2;                   // always 2 AP
}

interface RotateConduitMessage extends BaseMessage {
  type:     'ROTATE_CONDUIT';
  entityId: string;   // matrix conduit entity to rotate
  apCost:   1;
}

interface DrawScrapMessage extends BaseMessage {
  type:   'DRAW_SCRAP';
  apCost: 1;
}

interface ThresholdReadyMessage extends BaseMessage {
  type:  'THRESHOLD_READY';
  ready: boolean;
}

interface PassMessage extends BaseMessage {
  type: 'PASS';  // declares round end, 0 AP
}

// Host → Guest only: authoritative avatar/entity position after each mutation
interface StateUpdateMessage {
  type:    'STATE_UPDATE';
  entityId: string;
  q:       number;
  r:       number;
  apPool:  number;
}

// Host → Guest only: full 5×5 matrix state after any matrix mutation
interface MatrixStateUpdateMessage {
  type: 'MATRIX_STATE_UPDATE';
  grid: { shape: number; rotation: number; active: boolean }[][];
}

// Host → Guest only: reveals the shape drawn blind from the Scrap Pool
interface InventoryUpdateMessage {
  type:        'INVENTORY_UPDATE';
  playerId:    0 | 1;
  drawnShape:  number;
}

interface ChatMessage {
  type:     'CHAT';    // NOT a GameMessage — separate channel, no ECS effect
  emoji:    string;    // single emoji character
  senderId: 0 | 1;
}

type GameMessage =
  | MoveAvatarMessage
  | InsertConduitMessage
  | RotateConduitMessage
  | DrawScrapMessage
  | ThresholdReadyMessage
  | PassMessage
  | StateUpdateMessage
  | MatrixStateUpdateMessage
  | InventoryUpdateMessage;

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

`src/gameLoop.ts` — fixed-timestep accumulator loop. `world` is declared with `let` (not `const`) so `loadLevel()` can replace it:
```typescript
let accumulator = 0, lastTime = 0;
export let world = createWorld();  // reassigned by loadLevel()

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

**Goal**: All 26 bitECS components defined (including `Health`, `Resistances`, `Lethal`, `PhaseBarrier`, `Exit`, `APPool`, `Events`, and the `isTweening` field on `Renderable`). Reusable `EntityRegistry` mapping string keys to bitECS IDs. `SpriteRegistry` mapping `spriteId` numbers to asset paths.

**Duration**: 1 day | **Depends on**: Sprint 1

**Files to Create**:
- `src/components/Position.ts`, `Renderable.ts` (with `isTweening`), `Dimension.ts`, `Movable.ts`, `Pushable.ts`, `Conduit.ts`, `MatrixNode.ts`, `Avatar.ts`, `Hazard.ts`, `Threshold.ts`, `Collectible.ts`, `Static.ts`, `PhaseBarrier.ts`, `Lethal.ts`, `Health.ts`, `Resistances.ts`, `Exit.ts`, `APPool.ts`, `Events.ts`, `index.ts`
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

`SpriteRegistry.ts` — `const enum SpriteId { HEX_ID_FLOOR=0, HEX_SUPEREGO_FLOOR=1, AVATAR_P1=2, AVATAR_P2=3, CONDUIT_STRAIGHT=4, CONDUIT_CURVED=5, CONDUIT_T=6, CONDUIT_CROSS=7, CONDUIT_SPLITTER=8, CONDUIT_UNKNOWN=9, HAZARD_CHASM=10, ... }` mapped to asset paths. `CONDUIT_UNKNOWN` is the `???` icon used for uncollected floor conduits.

**Acceptance Criteria**:
- Smoke test: create 10 entities, add `Position` + `Dimension` + `Health`, verify correct TypedArray types and default values.
- `Health.max[eid] = 1; Health.current[eid] = 1` readable after `addComponent`.
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
```

`RenderSystem.ts` — dimension visibility mask: hex-grid entities (`Dimension` component) only drawn when `Dimension.layer[eid] === localPlayerId`. DNA Matrix entities (`MatrixNode`) always drawn.

**Acceptance Criteria**:
- Two hex grids render side-by-side at 40px hex size.
- Player 1 sees only Dimension A tiles; toggling `localPlayerId` shows Dimension B.
- DNA Matrix renders as a 5×5 square grid with placeholder colored rectangles.
- 60 FPS with 200 entities.

---

### Sprint 4 — Movement System and Avatar Input (Host Authority)

**Goal**: Avatars move on the hex grid via keyboard. Movement costs 1 AP. `APSystem` enforces the shared pool with global lockout. Local input on the Guest client is routed to the Host for authoritative processing; the Guest never mutates ECS state directly.

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

`KeyboardInput.ts` — Flat-top hex direction mapping: `W/S` → `(0,-1)/(0,1)`, `Q/E` → `(-1,0)/(1,0)`, `A/D` → `(-1,1)/(1,-1)`. On keydown, create a `MoveAvatarMessage`.
- If `GameState.localPlayerId === 0` (Host): push directly to `GameState.pendingInputs`.
- If `localPlayerId === 1` (Guest): call `peerManager.send(msg)` immediately and **do not** add to `pendingInputs` — the Guest never executes movement locally.

`MovementSystem.ts` — Runs strictly on the Host. Returns immediately if called on Guest:
```typescript
export function MovementSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return;  // Host-only

  const moveInputs = state.pendingInputs.filter(m => m.type === 'MOVE_AVATAR');
  for (const input of moveInputs) {
    const eid = entityRegistry.get(input.entityId);
    if (Movable.canMove[eid] !== 1) continue;
    const tq = Position.q[eid] + input.dq;
    const tr = Position.r[eid] + input.dr;
    if (!isHexPassable(world, tq, tr, Position.z[eid])) continue;
    if (state.apPool < 1) continue;

    Position.q[eid] = tq;
    Position.r[eid] = tr;
    state.apPool -= 1;
    Renderable.dirty[eid] = 1;

    // Broadcast authoritative result to Guest
    state.outboundMessages.push({
      type: 'STATE_UPDATE',
      entityId: input.entityId,
      q: tq, r: tr,
      apPool: state.apPool,
    });
  }
  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'MOVE_AVATAR');
}
```

`NetworkSystem` (Guest-side) — On receiving a `STATE_UPDATE` message: looks up the entity by `entityId`, sets `Position.q/r`, sets `APPool.current`, marks `Renderable.dirty = 1`. The Guest's visual state is entirely driven by these messages.

**Acceptance Criteria**:
- Guest key presses are sent over the network and **not** applied locally.
- Host processes inputs, decrements AP, and broadcasts `STATE_UPDATE`.
- Guest avatar position snaps to Host-authoritative coordinates on receipt.
- At AP=0, Host rejects all inputs; Guest sees the locked pool immediately via `STATE_UPDATE.apPool`.
- `Pass` action (spacebar) resets AP pool; Host broadcasts updated pool.
- Avatars cannot enter cells with `Static` entities.
- `APPool.current[apPoolEid]` stays in sync with `GameState.apPool` every tick on both clients.

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

**Goal**: The DNA Matrix renders as a 5-column grid. Players insert conduit plates (costs **2 AP**) — the column-shift mechanic ejects the opposite-end tile **face-down into the shared Scrap Pool**. Players may also rotate an already-placed conduit for 1 AP (`MatrixRotateSystem`), or draw from the Scrap Pool blind for 1 AP (`ScrapPoolSystem`). New files: `src/state/ScrapPoolState.ts`.

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

`MatrixInsertSystem.ts` — **Host-only** (`if (state.localPlayerId !== 0) return`). On `INSERT_CONDUIT` input: collect all entities in the target column sorted by row; eject the last (or first) entity to the Scrap Pool; shift remaining entities; create new entity; deduct **2 AP**; consume the conduit from player inventory. After mutation, push a `MATRIX_STATE_UPDATE` to `state.outboundMessages`.

`MatrixRotateSystem.ts` — **Host-only**. On `ROTATE_CONDUIT` input: increments `Conduit.rotation[eid]` by 1 (mod 4), recomputes `faceMask`, deducts 1 AP. After mutation, pushes `MATRIX_STATE_UPDATE` to `state.outboundMessages`.

`ScrapPoolSystem.ts` — **Host-only**. On `DRAW_SCRAP` input: pops a random entry from `ScrapPoolState.plates`, reveals its shape, pushes it to the drawing player's inventory, deducts 1 AP. Pushes **both** a `MATRIX_STATE_UPDATE` (scrap pool count changed) and an `INVENTORY_UPDATE { playerId, drawnShape }` to `state.outboundMessages`. The Guest's `NetworkSystem` applies the `INVENTORY_UPDATE` to the Guest's local inventory state, revealing the drawn shape.

`ScrapPoolState.ts` — `{ plates: { shape: ConduitShape; rotation: number }[] }` — a plain TS singleton. Plates are stored with their shape (hidden from render until drawn). The HUD shows only `scrapPool.plates.length` (count), never the contents.

`MatrixUI.ts` — handles mouse events on the matrix grid. Shows the local player's inventory as an insertion palette. `R` key pre-orients conduit before insertion (0 AP). Click on a column edge arrow fires `InsertConduitMessage`. Click on an existing matrix conduit fires `RotateConduitMessage`. Only fires messages for `senderId === GameState.localPlayerId`.

**Acceptance Criteria**:
- Insert from top costs 2 AP, shifts all tiles down; bottom tile added to Scrap Pool (not inventory).
- Insert from bottom costs 2 AP, shifts up; top tile added to Scrap Pool.
- Rotate an inserted conduit costs 1 AP; face mask updates immediately; routing re-evaluates.
- Draw from Scrap Pool costs 1 AP; shape revealed to drawing player only.
- Scrap Pool count visible on HUD; contents never shown.
- Player 2 inventory never visible in Player 1 UI.

---

### Sprint 7 — Matrix Routing System and Ability Activation

**Goal**: After every matrix mutation, `MatrixRoutingSystem` runs BFS from source nodes to determine which ability nodes are powered. `AbilitySystem` applies exact ability effects. `CollisionSystem` handles lethal hazard contact using `Health`/`Lethal`/`Resistances` components. `PushSystem` handles the Push ability sokoban mechanic.

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

`AbilitySystem.ts` — Uses **continuous evaluation** (no state diffing or caching). Runs every tick; evaluates the current powered state and reconciles component presence directly:

```typescript
export function AbilitySystem(world: IWorld): void {
  // UNLOCK_RED: continuous evaluation — no diff, no cache
  const redDoors = lockedRedQuery(world);  // defineQuery([Hazard, Static]) filtered by hazardType
  const unlockRedActive = checkNodeActive(world, AbilityType.UNLOCK_RED);
  for (let i = 0; i < redDoors.length; i++) {
    const eid = redDoors[i];
    if (unlockRedActive) {
      if (hasComponent(world, Static, eid)) removeComponent(world, Static, eid);
    } else {
      if (!hasComponent(world, Static, eid)) addComponent(world, Static, eid);
    }
  }
  // FIRE_IMMUNITY: update Resistances on sourced avatars
  const fireImmunityActive = checkNodeActive(world, AbilityType.FIRE_IMMUNITY);
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    Resistances.fire[avatars[i]] = fireImmunityActive ? 1 : 0;
  }
  // ... same pattern for all other abilities
}
```

This pattern is safe for bitECS archetype migrations because `hasComponent` guards against redundant add/remove calls. It also eliminates the bug class where a missed deactivation transition leaves a door permanently unlocked.

**Ability effects (exact):**
- `JUMP` → `MovementSystem` allows movement up to 2 hexes in a straight axial line, bypassing the intermediate hex. No extra AP.
- `PUSH` → `PushSystem` activates: when the avatar attempts to enter a `Pushable` entity's hex, the entity is moved 1 hex in the same direction (target must be empty). Avatar stays in place. Costs 1 AP.
- `PHASE_SHIFT` → `MovementSystem` allows movement through `PhaseBarrier` entities for standard 1 AP.
- `UNLOCK_RED` → Continuous: remove `Static` from matching locked doors while active; add it back when inactive.
- `FIRE_IMMUNITY` → Continuous: `Resistances.fire = 1` on all avatars while active; `0` when inactive.

`CollisionSystem.ts` — Runs after `MovementSystem`. For each avatar, checks for a `Lethal` entity at the same `(q,r,z)`. If found and matching `Resistance` flag is `0`: set `Health.current[avatarEid] = 0`, create an `AvatarDestroyedEvent` entity (Decision 7). `GameState` detects the event entity at end-of-tick and handles the failure screen.

`PushSystem.ts` — Runs after `MovementSystem`. When `MovementSystem` encounters a `Pushable` entity at the target hex and the `PUSH` ability is active, it: aborts the avatar's coordinate change, deducts **1 AP**, and writes a `PUSH_ATTEMPT { avatarEid, pushableEid, dq, dr }` object to a plain array on `GameState`. `PushSystem` reads that array, validates the hex behind the pushable entity is empty, moves the pushable entity 1 hex, and clears the array. Avatar does not move.

**Acceptance Criteria**:
- Straight pipe connecting source → ability node activates it each frame.
- Breaking the path deactivates the ability on the next frame.
- Jump moves avatar 2 hexes, bypassing a blocked intermediate hex.
- Push moves a Pushable block 1 hex without moving the avatar.
- Phase Shift allows movement through PhaseBarrier; normal walls still block.
- Locked red door has `Static` when `UNLOCK_RED` inactive; no `Static` when active; re-locks instantly on path break.
- Avatar entering a Fire Hazard without Fire Immunity emits `AVATAR_DESTROYED`.
- Avatar entering a Fire Hazard WITH Fire Immunity (`Resistances.fire = 1`) passes through safely.
- T-junction simultaneously activates two ability nodes.
- Full 5-column path activates a Tier 2 ability.

---

### Sprint 8 — Collision System and Threshold System

**Goal**: `CollisionSystem` handles lethal hazard contact (Health/Lethal/Resistances). `ThresholdSystem` triggers board-flip using Event Entities, gated by a two-player Ready toggle. `LevelTransitionSystem` consumes all event entities. **No `EventBus.ts`**, no `TeleportSystem`, no `RuleParsingSystem`.

**Duration**: 3 days | **Depends on**: Sprint 7

**Files to Create**:
- `src/systems/ThresholdSystem.ts`
- `src/systems/LevelTransitionSystem.ts`
- `src/components/Events.ts` (already defined in Sprint 2 component schema)

**Key Logic**:

`ThresholdSystem.ts` — Stepping on a Threshold hex does **not** instantly flip the board. It enables a per-player "Ready" toggle in the UI. The system only creates a `BoardFlipEvent` entity when all four conditions hold simultaneously:
```typescript
export function ThresholdSystem(world: IWorld, state: GameStateData): void {
  if (!state.thresholdEnabled) return;
  let p1OnThreshold = false, p2OnThreshold = false;
  // ... position checks against thresholdQuery(world) ...
  if (
    p1OnThreshold && p2OnThreshold &&
    state.thresholdState.p1Ready && state.thresholdState.p2Ready
  ) {
    const eventEid = addEntity(world);
    addComponent(world, BoardFlipEvent, eventEid);
    // Lock threshold hexes so this fires exactly once
    thresholdEntities.forEach(eid => addComponent(world, Static, eid));
    state.thresholdState.p1Ready = false;
    state.thresholdState.p2Ready = false;
  }
}
// Ready state is set by the UI: a "Confirm Threshold" button appears when the avatar is on the hex.
// The button fires a ThresholdReadyMessage (existing network message), which the Host applies to GameState.
```

A `LevelTransitionSystem` runs at the end of the pipeline, queries `BoardFlipEvent` and `LevelCompleteEvent` entities, executes their effects, then destroys all event entities:
```typescript
export function LevelTransitionSystem(world: IWorld): void {
  const flips = flipQuery(world);   // defineQuery([BoardFlipEvent])
  if (flips.length > 0) {
    executeBoardFlipLogic(world);
    for (let i = 0; i < flips.length; i++) removeEntity(world, flips[i]);
  }
  const completes = completeQuery(world);  // defineQuery([LevelCompleteEvent])
  if (completes.length > 0) {
    triggerLevelCompleteScreen();
    for (let i = 0; i < completes.length; i++) removeEntity(world, completes[i]);
  }
}
```

**Acceptance Criteria**:
- Avatars on threshold hexes without both Ready flags set do **not** trigger the board flip.
- Both players confirming Ready (via `ThresholdReadyMessage`) with avatars on threshold hexes creates exactly one `BoardFlipEvent` entity.
- `BoardFlipEvent` entity exists for exactly one tick; destroyed by `LevelTransitionSystem` at end of tick.
- Threshold cannot fire a second time after the first flip (threshold hexes have `Static`).
- Avatar entering a Lethal hex without the matching Resistance creates an `AvatarDestroyedEvent` entity.
- No `EventBus.ts` file exists; no `.on()` / `.emit()` calls anywhere in the codebase.

---

### Sprint 9 — Level Loader System and JSON Pipeline

**Goal**: `LevelLoaderSystem` parses full JSON level schema. Prevents ECS memory leaks by **destroying and recreating the bitECS `world` object entirely** on level load (no manual `removeEntity` teardown). `ExitSystem` implements sequential exit. `CutscenePlayer` handles the intro panel sequence before Level 1. Levels 1–5 authored in JSON.

**Duration**: 2 days | **Depends on**: Sprint 8

**Files to Create**:
- `src/systems/LevelLoaderSystem.ts`
- `src/entities/PlayerFactory.ts`, `HazardFactory.ts`, `ConduitFactory.ts`, `MatrixNodeFactory.ts`, `ExitFactory.ts`
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

`LevelLoaderSystem.ts` — **CRITICAL**: Do not manually iterate and `removeEntity`. Instead, nuke and recreate the world to prevent ECS TypedArray memory leaks from archetype migrations:
```typescript
import { createWorld, deleteWorld } from 'bitecs';

export function loadLevel(currentWorld: IWorld, levelId: string): IWorld {
  // 1. Destroy entire world — frees all SoA TypedArrays cleanly
  deleteWorld(currentWorld);

  // 2. Fresh world with zero residual component data
  const newWorld = createWorld();

  // 3. Reset all singletons
  entityRegistry.clear();
  GameState.reset();
  inventory.player0 = [];
  inventory.player1 = [];
  scrapPool.plates = [];

  // 4. Parse JSON and instantiate entities
  const def = fetchLevelDef(levelId);
  def.entities.forEach(e => dispatchEntityFactory(newWorld, e));
  createMatrixFromDef(newWorld, def.matrix);
  applyStaticRules(newWorld, def.rules);

  return newWorld;  // caller must replace the world reference in the game loop
}
```

The game loop in `main.ts` must accept and store the returned `world`:
```typescript
world = loadLevel(world, 'level_02');
// Re-run all defineQuery registrations with the new world on next tick
```

**Note:** All `defineQuery` calls in `queries.ts` are registered against the world passed to them at query-time, not at define-time. After `deleteWorld`, the new world is clean; queries re-register automatically on first call in bitECS.

Level progression for levels 1–5:
- **Level 1**: Movement only. No hazards. Matrix has one pre-routed path. Teaches basic controls.
- **Level 2**: Single locked door. One conduit already in inventory. Teaches matrix insertion.
- **Level 3**: Scrap Pool introduced. The required conduit is not on the hex grid — it must be drawn blind from the Scrap Pool. Teaches resource uncertainty.
- **Level 4**: Column-shift required. Inserting new conduit breaks an existing path. Teaches sequencing.
- **Level 5**: T-junction + shared routing. Both players must coordinate matrix state.

`levelIndex.ts` — `export const LEVEL_ORDER: string[] = ['level_01', 'level_02', ...]`.

**ExitSystem (sequential exit):**
```typescript
export function ExitSystem(world: IWorld, state: GameStateData): void {
  const exits = exitQuery(world);  // defineQuery([Exit, Position])
  for (let i = 0; i < exits.length; i++) {
    const exitEid = exits[i];
    const playerId = Exit.playerId[exitEid];
    const eq = Position.q[exitEid], er = Position.r[exitEid], ez = Position.z[exitEid];
    // find the matching avatar
    const avatars = avatarQuery(world);
    for (let j = 0; j < avatars.length; j++) {
      const aeid = avatars[j];
      if (Avatar.playerId[aeid] !== playerId) continue;
      if (Position.q[aeid] === eq && Position.r[aeid] === er && Position.z[aeid] === ez) {
        if (playerId === 0 && !state.p1Exited) {
          state.p1Exited = true;
          state.phase = 'P1_SPECTATING';
          removeComponent(world, Movable, aeid);   // P1 can no longer act
          Renderable.visible[aeid] = 0;            // wisp disappears from board
          // Create a P1ExitedEvent entity — LevelTransitionSystem activates P2 exit
          const evtEid = addEntity(world);
          addComponent(world, P1ExitedEvent, evtEid);
        } else if (playerId === 1 && state.p1Exited) {
          const evtEid = addEntity(world);
          addComponent(world, LevelCompleteEvent, evtEid);
        }
      }
    }
  }
}
```
P2's exit hex has `Static` initially. `LevelTransitionSystem` responds to the `P1ExitedEvent` entity by removing `Static` from P2's exit. No `EventBus.emit()` call — the event entity IS the signal.

**Acceptance Criteria**:
- `loadLevel(world, 'level_01', ...)` returns a new world; the old world is fully deleted.
- Loading level 2 after level 1 leaves zero ghost entities or residual TypedArray data.
- Intro cutscene (3 panels) plays before Level 1; skippable by click.
- P1 stepping on exit: `Movable` removed from P1 avatar; `P1ExitedEvent` entity created; P2 exit unlocked in same tick.
- P2 stepping on (now-active) exit: `LevelCompleteEvent` entity created; `LevelTransitionSystem` shows win screen.
- Levels 1–5 playable end-to-end with correct sequential exit.

---

### Sprint 10 — Networking (PeerJS WebRTC)

**Goal**: Two browser tabs connect via PeerJS. Lobby generates a 6-character room code. `NetworkSystem` serializes and transmits `GameMessage` objects. `ChatManager` routes emoji-only messages on a separate data channel with no ECS effect. Determinism validated by periodic state hash comparison.

**Duration**: 3 days | **Depends on**: Sprint 9

**Files to Create**:
- `src/network/PeerJSManager.ts`
- `src/network/NetworkSystem.ts`
- `src/network/messages.ts`
- `src/network/StateHasher.ts`
- `src/network/ChatManager.ts`
- `src/ui/LobbyUI.ts`
- `src/ui/ChatUI.ts`

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
- Conduit insert (2 AP) on guest updates matrix on both tabs.
- Rotate conduit (1 AP) on host updates matrix on both tabs.
- Emoji sent by Player 1 appears in Player 2's chat strip within 1 frame; no ECS state changes.
- Chat UI shows only emoji picker (no text input field).
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

### Sprint 12 — Campaign Flow and Levels 6–10

**Goal**: Progression system advancing through `LEVEL_ORDER`. Level Complete screen. `NeuralCollapseScreen` (second-failure state). Levels 6–10 authored in JSON using the complete AP table (2 AP inserts, Scrap Pool economy, tight budgets). Level 8 red herring confirmed unsolvable.

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
- **Level 9**: Forced Rotation puzzle. A conduit is pre-placed in the Matrix at the wrong orientation; the only winning route requires spending 1 AP on Rotate rather than inserting a new piece. Tests AP prioritization with the Rotate action.
- **Level 10**: Tight AP budget. All inserts cost 2 AP; routing requires 3 inserts. Sequential exit requires careful AP timing between P1 exit and P2 exit.

**Acceptance Criteria**:
- Completing level 1 shows Level Complete overlay.
- "Next Level" loads level 2 on both clients simultaneously.
- `localStorage` persists progress across browser refreshes.
- First failure on any level reloads instantly.
- Second failure shows `NeuralCollapseScreen` and returns to Level Select.
- All 10 levels playable end-to-end.
- Level 8's red herring confirmed unsolvable (regression test).

---

### Sprint 13 — Levels 11–15 (Threshold Mechanic)

**Goal**: Author levels 11–15 in JSON. Level 11 introduces the Threshold for the first time: a tutorialized one-way board flip with asymmetric warning icons and a Fire Immunity pre-requisite. Levels 12–15 build on it with multi-route Threshold prep and Rotate action puzzles.

**Duration**: 3 days | **Depends on**: Sprint 12

**Files to Create**:
- `src/levels/level_11.json` through `level_15.json`
- Updated `src/levels/levelIndex.ts`

**Level Design Notes**:

- **Level 11 (Threshold Tutorial):** P1's board has a prominent fire hazard icon near the Threshold hex. P2 holds Fire Immunity conduit plates. No other Tier 2 abilities available. Players must route Fire Immunity on the matrix *before* stepping on Threshold hexes, or P1 is destroyed immediately on arrival. Tutorialization is environmental — no text.
- **Level 12**: Matrix state from before the flip must include a routed Jump ability (needed to cross a post-flip chasm). Post-flip boards have no conduit pickups near the start.
- **Level 13**: First use of the Rotate action as the critical move. A pre-placed conduit in the matrix is one rotation off from completing a path; players must spend 1 AP to rotate it instead of burning 2 AP on a new insert.
- **Level 14**: Both players must coordinate to reach their Threshold hexes at low AP. Sequential exit is especially tight post-flip (P2 must navigate without matrix support after P1 exits).
- **Level 15**: Master set conduit teaser — a Cross (+) piece appears in the Scrap Pool at game start. Drawing it (1 AP) enables the only viable routing solution.

**Acceptance Criteria**:
- Level 11 plays as a Threshold tutorial: Fire Immunity required, visible warning icon confirms cause.
- Failing to route Fire Immunity before Threshold → P1 destroyed on arrival → retry.
- Level 15 requires drawing from the Scrap Pool to win.
- All 15 levels playable end-to-end.
- `LEVEL_ORDER` contains all 15 entries in `levelIndex.ts`.

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
                                                                └──► Sprint 8  (Collision/Threshold/LevelTransition)
                                                                          └──► Sprint 9  (Level Loader + Levels 1-5)
                                                                                    └──► Sprint 10 (Networking)
                                                                                              └──► Sprint 11 (HUD + Polish)
                                                                                                        └──► Sprint 12 (Campaign + Levels 6-10)
                                                                                                                  └──► Sprint 13 (Levels 11-15 + Threshold)
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
| `src/systems/LevelLoaderSystem.ts` | Must call `deleteWorld()` not `removeEntity()`; any direct entity removal leaks SoA TypedArray state |
| `src/network/PeerJSManager.ts` | Guest inputs must never mutate local ECS; only Host-sent `STATE_UPDATE` messages may do so |
| `src/systems/AbilitySystem.ts` | Continuous evaluation (no diff) — `hasComponent` guard is mandatory to avoid redundant archetype migrations |
| `src/systems/LevelTransitionSystem.ts` | Must destroy all event entities at end of tick; surviving event entities re-trigger their effects next tick |
| `src/systems/CollisionSystem.ts` | Must run after MovementSystem; missed collision = undetected player death |
| `src/systems/MatrixRotateSystem.ts` | Must recompute faceMask and trigger routing re-run in same tick |
| `src/state/ScrapPoolState.ts` | Shape data must be hidden from RenderSystem until a DRAW_SCRAP message resolves |

---

## Post-Sprint 13 Roadmap (Post-MVP)

- **Sprint 14**: Levels 16–30 (Spatial Complexity — larger hex grids, Master Set conduits in regular rotation).
- **Sprint 15**: Levels 31–40 (Deep Subconscious — multiple Threshold flips, subtle asymmetric clues).
- **Sprint 16**: Audio (neural/organic soundscape for Dimension A, electronic/sterile for Dimension B).
- **Sprint 17**: Visual polish (Dimension A — pulsing purples/reds; Dimension B — cold blues/neon; cutscene illustration assets).
- **Sprint 18**: Self-hosted PeerJS server deployment.
- **Sprint 19**: Accessibility pass (icon contrast, colorblind mode for conduit shapes).
- **Sprint 20**: Physical board game asset export pipeline (printable hex grid PDFs from level JSON).
