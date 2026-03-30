# Architecture: Dual-Format Entity Component System (ECS)

## 1. Architectural Philosophy
The game relies on a strict Entity Component System (ECS). This architecture is chosen because it perfectly mirrors how physical board games operate. To maintain parity between the digital and tabletop versions, we treat the human players in the board game as the "CPU" executing the Systems. 

Furthermore, the game architecture is strictly **language-agnostic**. Text is stripped from game pieces entirely. Logic and mechanics are conveyed through universal iconography, status tokens, and physical board placement.

## 2. Entities (The "Identity")
Entities have no inherent logic or data; they are simply unique identifiers.
* **Digital Implementation:** A UUID (Universally Unique Identifier) in the code (e.g., `Entity_001`).
* **Physical Implementation:** A physical token, meeple, or blank block. On its own, a wooden cube does nothing until components (properties) are assigned to it.

## 3. Components (The "Properties & State")
Components are pure data. They dictate what an entity is and what state it is currently in. Because the game is language-agnostic, **every active component must have a direct visual representation**.
* **Digital Implementation:** Structs or Data Classes (e.g., `Position {x, y, z}`, `Movable {true}`, `Teleporter {target_z}`). Tooltips handle the explanation of these components when hovered.

**Complete Component List (bitECS TypedArrays):**

| Component | Fields | Purpose |
|-----------|--------|---------|
| `Position` | `q: i16, r: i16, z: ui8` | Axial hex coordinates + dimension layer |
| `Renderable` | `spriteId: ui16, visible: ui8, layer: ui8, dirty: ui8` | PixiJS rendering data |
| `Dimension` | `layer: ui8` | Which dimension (0=Id, 1=Superego) owns this entity |
| `Movable` | `canMove: ui8` | Avatar or block can be moved by input |
| `Pushable` | `canBePushed: ui8` | Entity can be shoved by the Push ability |
| `Conduit` | `shape: ui8, rotation: ui8, faceMask: ui8` | Pipe shape, orientation, and computed connectivity bitmask |
| `MatrixNode` | `column: ui8, row: ui8, abilityType: ui8, active: ui8` | DNA Matrix cell data |
| `Avatar` | `playerId: ui8` | Marks a wisp entity; stores which player controls it |
| `Hazard` | `hazardType: ui8` | Type of obstacle (chasm, locked door, fire, laser, phase barrier) |
| `Lethal` | `hazardType: ui8` | Entity kills avatars on contact without matching `Resistance` |
| `Health` | `max: ui8, current: ui8` | Avatar vitality. `max: 1, current: 1` — one-hit destruction |
| `Resistances` | `fire: ui8, void: ui8, phase: ui8` | Boolean flags (0/1) blocking matching `Lethal` damage types |
| `Threshold` | `triggered: ui8` | Marks a Threshold hex; fires `BOARD_FLIP` when both avatars stand on their respective threshold hexes |
| `TeleporterComponent` | `targetZ: ui8` | Automatically flips the avatar's dimension on contact |
| `Collectible` | *(tag)* | Marks a conduit as collectible; renders as `???` icon until collected |
| `Static` | *(tag)* | Entity blocks movement; used for walls, locked doors |
| `PhaseBarrier` | *(tag)* | Passable only when `Phase Shift` ability is active for that dimension |
| `Exit` | `playerId: ui8` | Marks a Nexus Hex; P1 exit activates P2 exit on contact |

**ActionManager (Singleton Entity):** A single entity holding the global AP state is created on level load and destroyed on level end. Its components are: `APPool { current: ui8, max: ui8 }` and `RoundState { phase: ui8 }` (0=Active, 1=RoundOver). This entity is not rendered; it is queried by `APSystem` and `RoundSystem` each tick.
* **Physical Implementation:** * **Inherent Components:** Printed icons on the tokens (e.g., a "Lock" icon represents the `Static` component).
    * **Dynamic Components:** Colored bases, stacking chips, or slotted tokens attached to the main entity (e.g., a blue ring slipped over a meeple grants the `Phase_Shift` component).
* **The "Tooltip" Board Margin:** The physical board features a printed legend/margin. If a complex mechanic needs explanation, players place the relevant component token into a designated slot on the board's edge, which visually links the icon to its mechanical function using universally understood flowcharts (e.g., `[Player Icon] -> [Arrow] -> [Portal Icon]`).

## 4. Systems (The "Logic & Rules")
Systems contain all the logic. They iterate through entities that possess specific components and execute changes.
* **Digital Implementation:** The game loop functions executed in strict order every tick:

```
InputSystem → APSystem → RoundSystem → MovementSystem → CollectionSystem →
TeleportSystem → PushSystem → ThresholdSystem → MatrixInsertSystem →
MatrixRotateSystem → ScrapPoolSystem → MatrixRoutingSystem → AbilitySystem →
CollisionSystem → ExitSystem → RuleParsingSystem → RenderSystem → NetworkSystem
```

**System Responsibilities:**

| System | Responsibility |
|--------|---------------|
| `InputSystem` | Reads keyboard/mouse; produces `GameMessage` objects in `pendingInputs` |
| `APSystem` | Deducts AP costs; rejects inputs that exceed `apPool` |
| `RoundSystem` | Detects AP=0 or Pass action; resets AP pool for next round |
| `MovementSystem` | Moves avatars on Hex Grid; validates passability including ability checks |
| `CollectionSystem` | Collects `Collectible` conduits; reveals shape; adds to player inventory |
| `TeleportSystem` | Flips avatar Z-layer on teleporter contact (automatic, 0 AP) |
| `PushSystem` | Handles Push ability: moves `Pushable` entities 1 hex without moving the avatar |
| `ThresholdSystem` | Detects both avatars on threshold hexes; emits `BOARD_FLIP` |
| `MatrixInsertSystem` | Column-slide insert: ejects plate to Scrap Pool, shifts column, inserts new plate (2 AP) |
| `MatrixRotateSystem` | Rotates a single already-placed conduit 90° clockwise (1 AP); recomputes `faceMask` |
| `ScrapPoolSystem` | Handles blind draw from Scrap Pool into player inventory (1 AP) |
| `MatrixRoutingSystem` | BFS from source nodes; marks which ability nodes are powered |
| `AbilitySystem` | Diffs active ability set; adds/removes `Resistances`, `Movable` etc. on avatars |
| `CollisionSystem` | Checks avatar vs `Lethal` entities; applies `Health` damage; triggers failure |
| `ExitSystem` | Detects sequential exit: P1 on exit → spectator mode; P2 on exit → `LEVEL_COMPLETE` |
| `RuleParsingSystem` | Scans syntax hex positions; fires `RULE_CHANGED` on Baba Is You-style triplets |
| `RenderSystem` | Writes `RenderCommandBuffer`; applies dimension visibility mask |
| `NetworkSystem` | Drains `outboundMessages` via PeerJS; sorts incoming by `seq` into `pendingInputs` |

* **Physical Implementation:** The turn phases. The physical rulebook acts as the initialization script, teaching players the "algorithm" they must execute.
    * *Example:* The `MovementSystem` in code checks input and `Movable` components. In the board game, the rule is: "During the Move Phase, a player may move their wisp to an adjacent hex for 1 AP."

## 5. Architectural Handling of Core Mechanics

### 5.1 The Dimensional Flip (Rule Shifting)
The board has two distinct states (Dimension A and Dimension B). Architecturally, this is handled by a `DimensionLayer` component on the board/grid itself.
* **Digital:** The game holds two active grid arrays. Flipping the board toggles which grid array is rendered and which set of `GlobalRule` components is currently active.
* **Physical:** The board is double-sided or uses transparent overlays. When flipped, new icons printed on the physical board dictate the active `GlobalRule` components. For example, in Dimension A, [Water Icon] = [Block Icon]. In Dimension B, [Water Icon] = [Movement Bonus Icon].

### 5.2 Dimensional Teleportation (Z-Axis Shifting)
Teleportation moves an entity between the two dimensional states.
* **Digital Structure:** The position system uses X, Y, and Z coordinates. `Z=0` is Dimension A, `Z=1` is Dimension B. A `TeleporterComponent` simply updates an entity's Z-axis.
* **Physical Structure:** When an entity steps on a [Portal Icon], the player physically picks up the token, flips the board (or moves to the secondary side board), and places the token on the exact same X/Y coordinate in the new dimension. 

### 5.3 Rule Modification (*Baba Is You* Style)
Entities can change the rules of the game if they are pushed into specific configurations.
* **Digital Architecture:** A `RuleParsingSystem` constantly checks designated "Syntax Grids" (specific coordinates on the board). If `Entity(Icon_Block)` + `Entity(Operator_Is)` + `Entity(Icon_Pushable)` are aligned, the system globally adds the `Movable` component to all blocks.
* **Physical Architecture:** The board features "Rule Slots" cut into the margins. Players physically push icon tiles into these slots. The physical presence of the tiles in the slot dictates the active rules to the players.