# Project: Dimensional Nexus (Working Title)

## Overarching Vision
This project is a cooperative, language-agnostic puzzle game strictly designed for exactly 2 players. It is engineered to be played seamlessly as either a tabletop board game or a digital computer game. It blends spatial exploration on a hex grid with a tactile, routing-based ability management system. 

The core design philosophy is "easy to learn, hard to master," driven by asymmetric information to enforce genuine cooperation, and built on a strictly modular architecture to ensure physical and digital parity.

## Core Mechanics
* **The Dual-Board System:** * **The Hex Grid:** A hidden, spatial puzzle where players move avatars, navigate hazards, and collect items.
    * **The DNA Matrix:** A shared, public square grid where players slide conduit tiles to route power and unlock the abilities needed to traverse the Hex Grid.
* **Information Asymmetry (The Dimensional Screen):** Player 1 exists in Dimension A. Player 2 exists in Dimension B. They cannot see each other's Hex Grid or collected inventory. They must rely entirely on the shared DNA Matrix and verbal communication to bridge the gap.
* **Restricted Communication:** To prevent "Quarterbacking" (the Alpha Player problem), players may only talk about their *goals* and *obstacles*. They are strictly forbidden from describing the pieces in their inventory or explaining their actions when manipulating the DNA Matrix. Execution must be done in silence.
* **Pre-Determined Scenarios:** The game relies on hand-crafted, sequential levels (spanning ~8 hours of gameplay) to guarantee tightly tuned, "Aha!" logic puzzles rather than random generation.

## Technical Architecture: Entity Component System (ECS)
To maintain perfect parity between the physical and digital versions, the game relies on an ECS model. 
* **Entities:** Pure identifiers digitally, or physical tokens/tiles in the board game.
* **Components:** Raw data (e.g., `Position`, `ConduitShape`, `DimensionLayer`). Because the game is language-agnostic, **every active component has a direct visual representation** (icons, shapes) on the physical pieces.
* **Systems:** The logic that processes entities. In the digital version, this is code (e.g., `MatrixRoutingSystem`). In the physical version, the "Systems" are the strict rules the human players execute.

## Documentation Structure
This project relies on strict, modular markdown documentation. Development is sequential, starting with the complete drafting of the following core documents before coding begins:
* `docs/README.md`: This document.
* `docs/architecture.md`: Detailed breakdown of the dual-format ECS implementation.
* `docs/mechanics.md`: In-depth explanation of the Hex Grid, the DNA Matrix, and action point resolution.
* `docs/communication_rules.md`: The strict rulebook governing information asymmetry and silent execution.
* `docs/level_design.md`: Guidelines for conceptualizing and documenting pre-constructed puzzles across two hidden boards.
* `docs/physical_materials.md`: Specifications for the board game components (e.g., dimensional screens, hex tiles, sliding matrix tracks).

## Development Roadmap
1.  **Phase 1: Design Documentation:** Finalize all markdown documents in the `docs/` folder to establish a single source of truth.
2.  **Phase 2: Core Loop Prototype (Paper):** Create a minimum viable physical prototype using cardboard and markers to test the DNA Matrix sliding mechanics and the strict communication rules.
3.  **Phase 3: Digital ECS Foundation:** Implement the base ECS architecture structure using Claude Code.
4.  **Phase 4: Matrix & Hex Integration:** Build the logic that links abilities routed on the Matrix to entities on the Hex Grid.
5.  **Phase 5: Level Implementation & Playtesting:** Build the first introductory levels to test the tutorialization of the language-agnostic icons.