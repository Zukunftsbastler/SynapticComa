# Updated Section: Foundational Design Decisions (Pre-Sprint)

Replace your existing Decisions 2 and 3, and add the new ones below to establish the corrected architecture:

### Decision 2: The "Host Authority" Network Pattern
Lockstep networking with simultaneous AP expenditure is mathematically impossible without desyncs. Instead, the game uses strict Host Authority. Player 0 (Host) runs the authoritative ECS simulation. Player 1 (Guest) runs a predictive client. When Player 1 presses a key, the input is sent directly to the Host. The Host queues all inputs, evaluates them in sequence against the AP pool, mutates the ECS, and sends state updates back to the Guest. This guarantees 100% determinism.

### Decision 3: AP as Shared Singleton
AP lives in a plain TypeScript singleton `GameState` (`{ apPool: number, apMax: number }`). Only the Host mutates this pool. A dedicated `APPool` singleton entity (bitECS components: `APPool { current: ui8, max: ui8 }`) mirrors this state for HUD rendering on both clients.

### Decision 7: Event Entities (No Pub/Sub)
Standard JavaScript Event Emitters (Pub/Sub) break the linear, data-oriented flow of an ECS. Systems must communicate via Data. If a system needs to broadcast an event (e.g., a Board Flip), it creates a new, blank entity and attaches a specific Tag Component (e.g., `BoardFlipEvent`). Downstream systems query for this component, react, and physically destroy the event entity at the end of the tick.

### Decision 8: Separation of Logical and Visual State
To prevent the ECS and the Tween engine from fighting over Sprite positions every frame, `Renderable` entities utilize an `isTweening` flag. When the `MovementSystem` updates `Position`, the `RenderSystem` detects the delta, hands the animation off to the `TweenManager`, and sets `isTweening = 1`. While `isTweening` is true, the `RenderSystem` ignores the ECS `Position` coordinates, preventing visual stuttering.
Updated Section: Sprint 4 — Movement System and Avatar Input

Markdown
### Sprint 4 — Movement System and Avatar Input (Host Authority)

**Goal**: Avatars move on the hex grid via keyboard. Movement costs 1 AP. `APSystem` enforces the shared pool with global lockout. Local input on the Guest client is routed to the Host for authoritative processing. 

**Duration**: 2 days | **Depends on**: Sprint 3

**Files to Create**:
- `src/systems/MovementSystem.ts`
- `src/systems/APSystem.ts`
- `src/systems/InputSystem.ts`
- `src/state/GameState.ts`
- `src/input/KeyboardInput.ts`

**Key Logic**:

`KeyboardInput.ts` — On keydown, create a `MoveAvatarMessage`. 
* If `GameState.localPlayerId === 0` (Host), push directly to `GameState.pendingInputs`. 
* If `localPlayerId === 1` (Guest), immediately dispatch via `peerManager.send(msg)` and do NOT execute locally.

`MovementSystem.ts`: (Runs strictly on the Host, or relies on Host state updates for the Guest).
```typescript
export function MovementSystem(world: IWorld, state: GameStateData): void {
  // Only the Host processes pending movement requests
  if (state.localPlayerId !== 0) return; 
  
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
    
    // Broadcast the confirmed state change to the Guest
    state.outboundMessages.push({ type: 'STATE_UPDATE', entityId: input.entityId, q: tq, r: tr, apPool: state.apPool });
  }
  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'MOVE_AVATAR');
}
```

Acceptance Criteria:

Guest inputs are ignored locally and sent to the Host.

Host processes inputs and decrements the AP pool correctly.

Host broadcasts updated positions; Guest snaps to correct positions smoothly.


***

### Updated Section: Sprint 7 — Matrix Routing System and Ability Activation

*(Note: Updated to remove the "diffing" anti-pattern in favor of continuous evaluation).*

```markdown
### Sprint 7 — Matrix Routing System and Ability Activation

**Goal**: After matrix mutations, `MatrixRoutingSystem` determines which ability nodes are powered. `AbilitySystem` applies exact ability effects through continuous evaluation (no state caching). `CollisionSystem` handles lethal hazard contact.

**Duration**: 3 days | **Depends on**: Sprint 6

**Files to Create**:
- `src/systems/MatrixRoutingSystem.ts`
- `src/systems/AbilitySystem.ts`
- `src/utils/MatrixGraph.ts`

**Key Logic**:

`MatrixRoutingSystem.ts` — Resets `MatrixNode.active = 0` for all nodes, then runs BFS from source rows. Connects via face-mask. 

`AbilitySystem.ts` — Evaluates current state continuously.
```typescript
export function AbilitySystem(world: IWorld): void {
  const redDoors = lockedRedQuery(world);
  const unlockRedNodeActive = checkNodeActive(AbilityType.UNLOCK_RED);
  
  for (let i = 0; i < redDoors.length; i++) {
    const eid = redDoors[i];
    // Continuous evaluation: let the ECS handle archetype migrations safely
    if (unlockRedNodeActive) {
      if (hasComponent(world, Static, eid)) removeComponent(world, Static, eid);
    } else {
      if (!hasComponent(world, Static, eid)) addComponent(world, Static, eid);
    }
  }
}
```
***

### Updated Section: Sprint 8 — Teleport, Threshold, and Rule Parsing

*(Note: Updated to replace `EventBus.ts` with Event Entities).*

```markdown
### Sprint 8 — Teleport System, Threshold System, and Rule Parsing

**Goal**: `TeleportSystem` flips avatar Z-layer. `ThresholdSystem` triggers board-flip using Event Entities. `RuleParsingSystem` implements Baba Is You style logic.

**Duration**: 3 days | **Depends on**: Sprint 7

**Files to Create**:
- `src/systems/TeleportSystem.ts`
- `src/systems/ThresholdSystem.ts`
- `src/systems/RuleParsingSystem.ts`
- `src/components/Events.ts` // Contains BoardFlipEvent, LevelCompleteEvent tags

**Key Logic**:

`Events.ts` — Define tag components: `export const BoardFlipEvent = defineComponent();`

`ThresholdSystem.ts` — Queries all threshold hexes. If P1 and P2 avatars are on their respective threshold hexes in the same tick:
```typescript
// Do not use callbacks. Create an event entity.
const eventEid = addEntity(world);
addComponent(world, BoardFlipEvent, eventEid);
LevelTransitionSystem.ts (or RenderSystem) — Runs at the end of the pipeline.

TypeScript
const flips = flipQuery(world); // defineQuery([BoardFlipEvent])
if (flips.length > 0) {
  executeBoardFlipVisualsAndLogic();
  // Clean up the event entity at the end of the tick
  for (let i = 0; i < flips.length; i++) {
    removeEntity(world, flips[i]);
  }
}
```
***

### Updated Section: Sprint 9 — Level Loader System and JSON Pipeline

*(Note: Updated to fix the memory leak by dropping the world).*

```markdown
### Sprint 9 — Level Loader System and JSON Pipeline

**Goal**: Parse full JSON level schema. Prevent memory leaks by destroying and recreating the bitECS `world` object entirely on level load. `ExitSystem` implements sequential exit.

**Duration**: 2 days | **Depends on**: Sprint 8

**Files to Create**:
- `src/systems/LevelLoaderSystem.ts`
- `src/entities/PlayerFactory.ts`, etc.
- `src/levels/level_01.json` through `level_05.json`

**Key Logic**:

`LevelLoaderSystem.ts` — **CRITICAL**: Do not manually remove entities. 
```typescript
export function loadLevel(currentWorld: IWorld, levelId: string): IWorld {
  // 1. Nuke the existing world to prevent ECS component memory leaks
  deleteWorld(currentWorld);
  
  // 2. Create a mathematically pure slate
  const newWorld = createWorld();
  
  // 3. Reset singletons
  entityRegistry.clear();
  GameState.reset();
  
  // 4. Parse JSON and instantiate entities into newWorld
  const def = fetchLevelDef(levelId);
  def.entities.forEach(e => instantiateFactory(newWorld, e));
  
  return newWorld;
}
```
Acceptance Criteria:

loadLevel() fully clears memory. Loading Level 2 after Level 1 leaves zero ghost entities or residual component data in the TypedArrays.

P1 stepping on exit removes P1 movement ability and activates P2 exit.