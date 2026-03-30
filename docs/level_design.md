# Level Design Pipeline & Philosophy

## 1. Core Design Philosophy
In *Dimensional Nexus*, a level is a lock, and the players' verbal communication is the key. Because the game relies on pre-constructed scenarios without text-based rules, the level design itself must act as the tutorial, the challenge, and the narrative. 

* **Design for the Blind Spot:** Player 1 often has the *solution* (a specific Conduit Plate) to Player 2's *problem*. They must discover this through descriptive communication.
* **The Illusion of Choice (Red Herrings):** To prevent linear "breadcrumb" gameplay, levels must feature deliberate dead ends, decoy locks, and inefficient paths. The puzzle is not just *how* to open a door, but deciding *if* that door is even worth opening.
* **Language-Agnostic Teaching:** New mechanics are introduced in isolation. If you introduce the "Phase Shift" ability, the level should feature a phase-wall directly in front of the spawn point, with the exact Conduit Plates needed to bypass it laying nearby. 

## 2. Anatomy of a Scenario
Every level in the game consists of three tightly coupled data structures:

1.  **Dimension A (Hex Grid):** Player 1's starting position, hazards, exit node, and collectible Conduit Plates.
2.  **Dimension B (Hex Grid):** Player 2's starting position, hazards, exit node, and collectible Conduit Plates.
3.  **The DNA Matrix (Square Grid):** The initial starting state of the Matrix. 

## 3. The Reverse-Engineering Pipeline
Because the Hex Grid relies on the DNA Matrix, design levels backward.

### Step 1: Define the Bottleneck (The Matrix)
Define the required ability sequence on the DNA Matrix. Map out the exact sequence of Conduit Plate insertions required to shift the power from start to finish.

### Step 2: Distribute the Pieces & The Decoys
Distribute the necessary Conduit Plates across the two Hex Grids. Then, add the noise:
* **Decoy Obstacles:** Place a hazard (e.g., a locked Green Door) on Player 1's board, but ensure the solution (the Green Key ability node) is either impossible to reach on the Matrix or the required conduits don't exist on Player 2's board. This forces Player 2 to tell Player 1 to abandon that route.
* **Inefficient Routes:** Create a long, safe path that costs too much AP, forcing players to figure out how to route the "Teleport" ability for a shortcut.

### Step 3: Build the Hex Grids
Construct the physical layout of Dimension A and B, placing the avatars, hazards, and items.

## 4. Advanced Mechanics: The Threshold (The One-Way Flip)
In the "Spatial Complexity" phase of the campaign, levels are expanded using the **Threshold Mechanic**. This is a synchronized, one-way journey to a new set of dimensional layouts.

### 4.1 The Trigger
Both players must navigate their avatars to specific "Threshold Hexes" and end their turn simultaneously. Since there is no going back, both players must verbally agree to initiate the jump.

### 4.2 The Execution
* **Physical:** Players flip their hidden Hex Grids to the reverse side (or swap out the board). 
* **Matrix Persistence:** The DNA Matrix is **NOT** reset. The abilities currently routed remain active.
* **No Return:** The Threshold hexes on the new boards are inactive. Players cannot return to the previous layout.

### 4.3 Asymmetric Foresight
To survive the Threshold, players must prepare the DNA Matrix *before* jumping.
* The pre-Threshold boards contain fragmented, asymmetric clues about what awaits on the other side. 
* *Example:* Player 1's board features a permanent, visual warning icon for "Fire Hazards" near the Threshold hex. Player 2's board does not, but Player 2 has access to the "Fire Immunity" Conduit Plates. Player 1 must warn Player 2 to route the Fire Immunity ability on the shared Matrix *before* they agree to flip the boards, otherwise they will instantly fail upon arriving in the new dimension.

## 5. Difficulty Progression (The Campaign)

### MVP Scope (Levels 1–15)
* **Levels 1–5 (The Basics):** Teach movement, the sequential exit win condition, basic Matrix routing, and the strict communication rules. Each level introduces exactly one new mechanic in isolation with obvious conduit placement.
* **Levels 6–10 (The Shift):** Introduce the 2 AP Insert cost, forcing AP budget discipline. Introduce red herrings, decoy locks, and the Scrap Pool as a resource. First tight AP budgets.
* **Level 11 (Threshold Introduction):** The first level with the Threshold mechanic. The pre-flip boards contain asymmetric warning icons. Tutorialization: Player 1's board has a prominent fire hazard icon near their Threshold hex; Player 2 holds the Fire Immunity conduit plates. Players must communicate and route the ability before agreeing to flip.
* **Levels 12–15 (The Threshold — Advanced):** Multi-step Threshold puzzles. The Matrix state carries over; players must route abilities that are useful *after* the flip, not just before it. Introduce the Rotate action as a precision tool.

### Post-MVP (Deferred — Levels 16–40)
* **Levels 16–30 (Spatial Complexity):** Larger hex grids. Navigation to conduits requires multi-round AP planning. Master Set conduit shapes (Cross, Splitter) introduced.
* **Levels 31–40+ (The Deep Subconscious):** Multiple Threshold flips per level. Asymmetric foresight clues become subtle and indirect. End-game puzzles designed for experienced cooperative pairs.