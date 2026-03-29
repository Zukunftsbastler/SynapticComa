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
* **Physical Implementation:** * **Inherent Components:** Printed icons on the tokens (e.g., a "Lock" icon represents the `Static` component).
    * **Dynamic Components:** Colored bases, stacking chips, or slotted tokens attached to the main entity (e.g., a blue ring slipped over a meeple grants the `Phase_Shift` component).
* **The "Tooltip" Board Margin:** The physical board features a printed legend/margin. If a complex mechanic needs explanation, players place the relevant component token into a designated slot on the board's edge, which visually links the icon to its mechanical function using universally understood flowcharts (e.g., `[Player Icon] -> [Arrow] -> [Portal Icon]`).

## 4. Systems (The "Logic & Rules")
Systems contain all the logic. They iterate through entities that possess specific components and execute changes.
* **Digital Implementation:** The game loop functions (`MovementSystem`, `RuleEvaluationSystem`, `TeleportSystem`).
* **Physical Implementation:** The turn phases. The physical rulebook acts as the initialization script, teaching players the "algorithm" they must execute. 
    * *Example:* The `Movement System` in code checks input and `Movable` components. In the board game, the rule is simply: "During the Move Phase, a player may push an adjacent token with a [Push Icon] one space."

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