# Digital Implementation & Tech Stack

## 1. Development Philosophy for AI Assistance
This game is designed to be built using an AI coding assistant (Claude Code). Therefore, the tech stack avoids visual editors (like Godot or Unity) in favor of a 100% code-based, web-native environment. This ensures the AI can read, understand, and modify the entire codebase without breaking serialized scene files.

## 2. The Tech Stack
* **Language:** **TypeScript**. Strict typing is mandatory for a stable ECS, ensuring components have predictable data structures.
* **ECS Framework:** **bitECS**. A blazing-fast, data-oriented ECS library for JavaScript/TypeScript. It forces strict separation of data (Components) and logic (Systems), perfectly mirroring our physical board game rules.
* **Rendering Engine:** **PixiJS**. A lightweight 2D WebGL rendering engine. It handles hexagonal math, sprite manipulation, and the UI Matrix effortlessly without forcing an overarching engine architecture.
* **Networking:** **PeerJS (WebRTC)**. For the asymmetric multiplayer. It allows direct peer-to-peer connections between two browsers, sending lightweight JSON state updates (e.g., "Player 1 pushed Conduit X") without needing a dedicated backend server.
* **Build Tool:** **Vite**. For rapid local development and hot-module replacement.

## 3. Project File Structure
The repository is structured by ECS domain rather than by feature. This modularity allows the AI to update a specific System without touching the rest of the game loop.

```text
/dimensional-nexus
├── /docs                   # All game design markdown files
├── /public                 # Static assets (language-agnostic SVG icons, sprites)
│   ├── /sprites
│   │   ├── hex_id_floor.webp
│   │   ├── hex_superego_wall.webp
│   │   └── avatar_id.png
│   └── /ui
│       ├── icon_phase_shift.svg
│       ├── conduit_straight.svg
│       └── matrix_board.webp
├── /src
│   ├── /components         # Pure data definitions (bitECS structs)
│   │   ├── Position.ts     # { q: number, r: number, z: number }
│   │   ├── Renderable.ts   # { spriteId: number, visible: boolean }
│   │   ├── MatrixNode.ts   # { active: boolean, abilityType: number }
│   │   └── Dimension.ts    # { layer: number } (0 for Id, 1 for Superego)
│   ├── /systems            # Pure logic functions
│   │   ├── MovementSystem.ts
│   │   ├── MatrixRoutingSystem.ts
│   │   └── RenderSystem.ts # Bridges bitECS data to PixiJS sprites
│   ├── /entities           # Prefab assembly functions
│   │   ├── PlayerFactory.ts
│   │   └── HazardFactory.ts
│   ├── /levels             # Pre-determined scenarios
│   │   ├── level_01.json   # JSON arrays defining initial entity states
│   │   └── level_02.json
│   ├── /network            # PeerJS WebRTC connection logic
│   └── main.ts             # Game loop and initialization
├── package.json
├── tsconfig.json
└── vite.config.ts
```
## 4. ECS Implementation Details
### 4.1 Data-Oriented Components

In bitECS, components are FlatArrays (TypedArrays). This means a component holds no functions.

```TypeScript
// Example: A component is just memory allocation
export const Position = defineComponent({
  q: Types.i16, // Axial Q coordinate
  r: Types.i16, // Axial R coordinate
  z: Types.ui8  // Dimension layer (0 or 1)
});
```
### 4.2 Handling the Dimensional Screen (Networking)

* The game runs the identical deterministic ECS simulation on both clients.
* State Sync: Only inputs (Action Point expenditures) are sent over the network.
* Rendering Mask: The RenderSystem checks the local client's assigned Player ID. If the client is Player 1, it only draws entities where Dimension.layer === 0 and the shared MatrixNodes.

### 4.3 Level Loading (JSON)

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
## 5. Claude Code Sprint Guidelines
To maintain a stable architecture, development should follow sequential, isolated sprints. All prompts and sprint descriptions must be written in English to ensure maximum comprehension and output quality from the AI agent.

* Sprint 1: "Initialize Vite + TypeScript project. Set up bitECS and create the core game loop in main.ts."
* Sprint 2: "Create the Position, Renderable, and Dimension components. Implement PixiJS to render simple colored hexagons based on bitECS entity data."
* Sprint 3: "Implement the MatrixRoutingSystem. Create logic that checks a 2D array of conduits to verify continuous paths from column 1 to column 5."
* Sprint 4: "Implement PeerJS. Create a lobby system where Player A can generate a room code and Player B can join, syncing a shared text string."