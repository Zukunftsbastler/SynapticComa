# Synaptic Coma

A cooperative 2-player asymmetric puzzle game for two browser tabs, connected peer-to-peer via WebRTC. Two "wisps" — fragments of a coma patient's consciousness — navigate separate hex-grid dimensions (the Id and the Superego) and collaborate through a shared DNA Matrix to route abilities and escape each level together.

> **Art direction:** Medical Macabre Diorama. Dim A (The Id) — bruised purples, crimson, obsidian. Dim B (The Superego) — surgical steel, fluorescent blue. The Matrix is a rusted Specimen Tray with Bakelite conduit plates; etched grooves fill with viscous nerve-fluid when powered.

## Documentation

The design documents in [`docs/`](docs/) are the **single source of truth** — the code implements what they describe. Start with [`docs/project_overview.md`](docs/project_overview.md) for a plain-language guide to the project and its ECS architecture.

| Topic | Document |
|---|---|
| All game rules (AP, Matrix, abilities, win/fail) | [`docs/mechanics.md`](docs/mechanics.md) |
| Code architecture (ECS components & systems) | [`docs/architecture.md`](docs/architecture.md) |
| Tech stack, screen layout, file structure, level JSON | [`docs/digital_implementation.md`](docs/digital_implementation.md) |
| Sprint-by-sprint build plan | [`docs/implementation_plan.md`](docs/implementation_plan.md) |
| Level design & campaign | [`docs/level_design.md`](docs/level_design.md) |
| Campaign audit & future mechanic proposals | [`docs/mechanic_roadmap.md`](docs/mechanic_roadmap.md) |
| Project-wide roadmap: next steps | [`docs/roadmap.md`](docs/roadmap.md) |
| Procedural generation, solver, difficulty model | [`docs/generative_levels.md`](docs/generative_levels.md) |
| Tutorial layer ("The Monitor") | [`docs/tutorial_design.md`](docs/tutorial_design.md) |
| Story & dimensions | [`docs/narrative.md`](docs/narrative.md) |
| Visual identity & UI | [`docs/art_and_ui.md`](docs/art_and_ui.md) |
| Generative artwork pipeline (concept) | [`docs/art_pipeline_roadmap.md`](docs/art_pipeline_roadmap.md) |
| Player communication rules | [`docs/communication_rules.md`](docs/communication_rules.md) |
| Design decision record | [`docs/open_questions.md`](docs/open_questions.md), [`docs/decisions_needed.md`](docs/decisions_needed.md) |

Sprint history and decisions live in [`SPRINTS/`](SPRINTS/).

## Gameplay in One Paragraph

Each player sees only their own dimension and their own inventory. The shared 5×5 DNA Matrix is visible to both: sliding conduit plates into its columns routes power from source nodes to ability nodes (Jump, Push, Unlock, Phase Shift, Fire Immunity), which changes what is possible on the hex grids. The two players spend from a single **persistent AP pool** — it never resets; the only ways to gain AP are cooperative **Shared Unlock** nodes (both players present simultaneously) and well-formed **Neuro-Resonance** base pairs in the Matrix. Talk about the goal, stay silent about the method: inventories and plate shapes may never be described. P1 must exit first, then P2 — and if AP runs dry with no unlock left, the level enters a Dead End with a free restart. Full rules: [`docs/mechanics.md`](docs/mechanics.md).

## Getting Started

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/Zukunftsbastler/SynapticComa.git
cd SynapticComa
npm install
npm run dev
```

Open two browser tabs at `http://localhost:5173`. In the first tab click **HOST** and share the 6-character room code. In the second tab click **JOIN** and enter the code.

**Local single-machine testing** (no networking): press `1` or `2` to switch which player you control.

## Controls

| Key | Action |
|---|---|
| Q/E, A/D, W/S | P1 hex movement (flat-top axial directions) |
| I/K, J/L, U/O | P2 hex movement |
| Tab | Cycle selected inventory slot |
| R | Rotate selected conduit (clockwise, before insertion) |
| Click matrix column | Insert selected conduit from top or bottom (2 AP) |
| Click conduit in matrix | Rotate that conduit in place (1 AP) |
| Click scrap pile (below matrix) | Blind draw from the Scrap Pool (1 AP) |
| 1 / 2 | (Dev) Switch controlled player |

## Tech Stack

TypeScript (strict) · [bitECS](https://github.com/NateTheGreatt/bitECS) · [PixiJS](https://pixijs.com) · [PeerJS](https://peerjs.com) (WebRTC) · [Vite](https://vitejs.dev). Rationale and versions: [`docs/digital_implementation.md §2`](docs/digital_implementation.md).

## Development

```bash
npm run dev            # Vite dev server (HMR)
npm run build          # tsc strict check + production bundle
npm run preview        # Serve dist/ locally
npm run validate:levels # Solvability + fairness + interaction + witness-replay proof for all levels
npm test               # Vitest — ECS/network-protocol unit & integration tests (src/**/*.test.ts)
```

Common workflows (adding levels, abilities, hazards) are documented in [`docs/project_overview.md §6`](docs/project_overview.md).

## Repository

[https://github.com/Zukunftsbastler/SynapticComa](https://github.com/Zukunftsbastler/SynapticComa)
