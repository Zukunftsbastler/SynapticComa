# Mechanics: The Dual-Board System

## 1. Core Gameplay Loop
The game is a deterministic logic puzzle distributed across two interconnected boards: 
1.  **The Hex Grid (The Environment):** Where avatars move, explore, and collect resources.
2.  **The DNA Matrix (The Control Panel):** A square grid where players manipulate routing tiles to unlock abilities required to navigate the Hex Grid.

Players share a pool of Action Points (AP) each round. AP can be spent to perform actions on either board. The ultimate goal is to navigate the avatars to the designated exit hexes.

## 2. Board 1: The Hex Grid (Exploration)
The Hex Grid is a strictly spatial puzzle. Avatars begin here with basic movement.
* **Movement (1 AP):** Move an avatar to an empty, adjacent hex.
* **Collection (0 AP):** If an avatar moves onto a hex containing a "Conduit Plate," it is immediately collected into the team's shared physical inventory.
* **Obstacles:** The grid features hazards (e.g., chasms, locked doors, laser barriers) that cannot be bypassed without specific abilities unlocked on the DNA Matrix.

## 3. Board 2: The DNA Matrix (The Labyrinth)
The DNA Matrix is a separate, physical square-grid board (or a dedicated digital UI panel). It uses a slide-puzzle mechanic to route "energy" from the players to various abilities.

### 3.1 Matrix Architecture
The matrix is structured in rigid columns (or rings, if designed circularly):
* **Column 1 (Sources):** The Player Avatars. These act as the permanent power sources. Energy flows left-to-right from these nodes.
* **Column 2 (Conduit Layer 1):** A column of square conduit plates featuring straight, curved, or T-junction pipes.
* **Column 3 (Tier 1 Abilities):** Static nodes containing basic abilities (e.g., "Jump," "Push," "Unlock Red Door").
* **Column 4 (Conduit Layer 2):** A second column of conduit plates.
* **Column 5 (Tier 2 Abilities):** Static nodes containing advanced abilities (e.g., "Teleport," "Phase Shift").

### 3.2 Matrix Manipulation
Players use Conduit Plates collected from the Hex Grid to alter the DNA Matrix.
* **Insert Conduit (1 AP):** A player may take a Conduit Plate from their inventory and push it into the top or bottom of any Conduit Layer column (Column 2 or 4). 
* **The Shift:** Just like in *Das verrückte Labyrinth*, pushing a plate in forces the entire column to shift by one space. The plate that is pushed out the opposite end is returned to the team's inventory.
* **Orientation:** Before inserting, the player chooses the 90-degree rotational orientation of the plate to ensure the pipes align correctly.

## 4. Ability Activation & Tracing
Abilities are completely fluid and temporary. They are only active as long as an unbroken path exists on the DNA Matrix.
* **The Trace:** If a continuous pipe line connects Player 1 (in Column 1) to the "Jump" ability (in Column 3), Player 1 instantly gains the ability to jump over one hex gap on the Hex Grid.
* **Shared Paths:** Multiple players can route their energy into the same ability node if the pipe layout allows it.
* **Severing Connections:** If a player pushes a new plate into a column and breaks an existing connection, that ability is instantly lost. This forces players to sequence their moves carefully—sometimes you must willingly lose an ability to route power to a different one needed for the next step.