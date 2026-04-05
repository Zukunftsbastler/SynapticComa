# Synaptic Coma — Project Overview

This document explains what the project is, how it is organized, and how to use a dedicated AI assistant (GPT or Claude) to contribute new content without needing to understand the entire codebase at once.

---

## 1. What Is This Game?

**Synaptic Coma** is a two-player cooperative puzzle game — available as both a physical board game and a digital browser game. Two players each control a small light (called a "wisp") navigating through the fractured mind of a coma patient. They each see a completely different game board and must talk to each other to solve puzzles.

There are two interconnected game boards:

- **The Hex Grid** — where the wisps move around, collect items, and face obstacles
- **The DNA Matrix** — a shared control panel in the center where players insert tiles to unlock special abilities for their wisp

The core tension: you can only see your own board, but the shared Matrix affects both of you. Every decision ripples across both players.

---

## 2. The Folder Structure

The repository is split into two major areas: **design documents** and **source code**.

```
/docs/                   ← All game design documents (you are here)
/src/                    ← All source code (TypeScript)
/public/                 ← Sprites, icons, cutscene images
```

### The Design Documents (`/docs/`)

Each file documents a specific aspect of the game. They are the source of truth for how the game is *supposed* to work — the code implements what these files describe.

| File | What it covers |
|------|---------------|
| `mechanics.md` | All rules: movement, AP costs, the DNA Matrix, abilities, win/fail conditions |
| `architecture.md` | How the code is structured (ECS), what all the components and systems are |
| `digital_implementation.md` | Tech stack, screen layout, file structure, how to build sprints |
| `implementation_plan.md` | The full sprint-by-sprint build plan with code examples |
| `level_design.md` | How levels are designed, how difficulty progresses across 15 levels |
| `narrative.md` | The story, the two dimensions (Id and Superego), silent cutscenes |
| `art_and_ui.md` | Visual style, atmosphere, how UI elements look and behave |
| `communication_rules.md` | What players are and are not allowed to say to each other |
| `open_questions.md` | All major design decisions, recorded with their final answers |

> **Rule of thumb:** If you want to change *how the game plays*, edit `mechanics.md`. If you want to change *how the code is built*, edit `architecture.md` or `implementation_plan.md`. If you want to change *how it looks or feels*, edit `art_and_ui.md`.

### The Source Code (`/src/`)

The code is organized by **ECS domain** — that is, by the role each file plays in the system, not by the feature it belongs to. This is explained in detail in the next section.

```
/src/components/    ← Data definitions (what things ARE)
/src/systems/       ← Logic definitions (what things DO)
/src/entities/      ← Factories that create game objects
/src/levels/        ← JSON files describing each puzzle
/src/network/       ← Multiplayer (PeerJS)
/src/rendering/     ← PixiJS drawing layer
/src/ui/            ← HUD, panels, screens
/src/state/         ← Global game state
```

---

## 3. What Is ECS? (And Why Should You Care?)

ECS stands for **Entity–Component–System**. It is a way of organizing code that is very popular in game development. Here is what each word means in plain language.

---

### Entity — "a thing in the game"

An **Entity** is just a number. That's it. `Entity 42`. It has no name, no color, no position. By itself, it is nothing — just an ID tag, like a blank sticky note.

In the physical board game, an entity is the equivalent of a blank wooden cube sitting on the table. The cube means nothing until you put labels on it.

---

### Component — "a property attached to a thing"

A **Component** is a piece of data you attach to an entity. It answers the question: *what kind of thing is this?*

For example:
- Attach a `Position { q: 2, r: 3 }` component → now the entity is *located somewhere on the grid*
- Attach a `Movable { canMove: 1 }` component → now it *can be moved*
- Attach a `Hazard { hazardType: fire }` component → now it *is a fire hazard*

A single entity can have many components at once. A fire hazard tile might have `Position`, `Renderable`, `Hazard`, and `Lethal` all at the same time.

In the physical board game, components are the printed icons on a tile. A tile printed with a flame icon has the "Hazard" component. A tile printed with a lock icon has the "Static" component. Stacking chips on a meeple adds dynamic components.

**All components are stored in `/src/components/`.** Each file is one component, about 5–10 lines of TypeScript. They contain no logic — only data.

---

### System — "a rule that acts on things"

A **System** is a function that runs every single frame. It looks through all entities, finds the ones that have a specific combination of components, and does something to them.

For example:
- `MovementSystem` → finds all entities with `Position` + `Movable`, then checks if a player pressed a direction key, and if so moves the entity
- `CollisionSystem` → finds all entities with `Position` + `Lethal`, checks if a wisp is standing on that hex, and if so destroys the wisp
- `MatrixRoutingSystem` → looks at all the conduit tiles in the Matrix, traces paths, and decides which ability nodes are powered

Systems run in a strict, fixed order every frame:

```
InputSystem → APSystem → MovementSystem → CollectionSystem →
PushSystem → ThresholdSystem → MatrixInsertSystem →
MatrixRotateSystem → ScrapPoolSystem → MatrixRoutingSystem →
AbilitySystem → CollisionSystem → ExitSystem →
LevelTransitionSystem → RenderSystem → NetworkSystem
```

This order matters. Movement runs before collision, so the wisp moves *before* the game checks if it walked into a hazard. Routing runs before ability checking, so the game recalculates power paths *before* granting abilities.

**All systems are stored in `/src/systems/`.** Each file is one system.

---

## 4. Why ECS? The Benefits for This Project

The ECS pattern solves a problem that kills small game projects: **everything becoming tangled together**.

In a traditional approach, you might write a class called `Player` that handles movement, collision, abilities, rendering, and networking all in one file. Change one thing and you accidentally break three others. This is the nightmare that ECS prevents.

In ECS:

- **Components know nothing about systems.** `Position.ts` has no idea that `MovementSystem` uses it.
- **Systems know nothing about each other.** `MovementSystem` has no idea that `CollisionSystem` exists.
- **Each system is a complete, self-contained unit of logic.**

This has one enormous practical benefit:

> **You can understand, modify, or add a single system without reading any other file in the project.**

If you want to change how the Push ability works, you open `PushSystem.ts`. That file contains the complete logic for pushing. You do not need to open `MovementSystem.ts` or `CollisionSystem.ts` or `AbilitySystem.ts`. They are separate.

This is why the project is structured this way — it allows a team of people (or a person working with an AI assistant) to work on one piece at a time.

---

## 5. How to Use a GPT to Create New Content

Because the project is built with ECS, you can give a GPT a very small, focused slice of the project and ask it to work on just that piece. The GPT does not need to understand the whole game to add a new system, modify a component, or design a new level.

Here is how to do it effectively.

---

### Rule 1: Always give the GPT the relevant docs first

Before asking the GPT to write or modify code, paste in the relevant documentation. The docs are the single source of truth for how everything is supposed to work.

For most tasks, you will need:
- The relevant section of `mechanics.md` (the rule you are implementing)
- The relevant section of `architecture.md` (the components and systems involved)
- The specific source file(s) you want to change

---

### Rule 2: Match the task to the ECS layer

Different tasks require different files. Here is a quick map:

| What you want to do | Files to give the GPT |
|---------------------|----------------------|
| Add a new kind of game object | `/src/components/` (the new component) + `architecture.md §3` |
| Add a new rule or behavior | `/src/systems/` (the relevant system) + `mechanics.md` (the relevant rule) |
| Create a new level puzzle | `/src/levels/level_01.json` (as an example) + `level_design.md` |
| Change how something looks | `/src/rendering/` or `/src/ui/` + `art_and_ui.md` |
| Change what players can say | `/src/network/ChatManager.ts` + `communication_rules.md` |

---

### Rule 3: Ask for one thing at a time

Because each system is self-contained, the best prompts are narrow and specific.

**Too broad (avoid this):**
> "Add a new ability that lets the wisp slow down time."

**Better (do this):**
> "I want to add a new Tier 1 ability called 'Time Dilation'. According to `mechanics.md §5`, abilities are passive states applied by `AbilitySystem`. Here is the current `AbilitySystem.ts`: [paste file]. Please add a new `TimeDilation` ability that makes the wisp's movement cost 0 AP for 2 moves. The ability should follow the same pattern as the `Phase Shift` ability in this file."

The second prompt works because:
- It names the specific system to edit
- It gives the existing file as context
- It asks for a change that follows an existing pattern in that file
- It does not ask the GPT to touch anything else

---

### Rule 4: Use the component list as your vocabulary

When describing what you want, use the component names from `architecture.md §3` as your vocabulary. This tells the GPT exactly what data is available and prevents it from inventing things that do not exist in the project.

For example: instead of saying "the player character", say "the entity with `Avatar { playerId: 0 }`". Instead of "a wall", say "an entity with the `Static` tag component".

---

### Example Prompt Template

Here is a template you can reuse:

```
Context:
- Project: Synaptic Coma (ECS game in TypeScript / bitECS)
- Task: [describe what you want in one sentence]

Relevant design rule (from docs):
[paste the relevant paragraph from mechanics.md or architecture.md]

Relevant file(s):
[paste the content of the file(s) to modify]

Request:
[specific, narrow ask — one system, one component, or one level file]
Please follow the existing patterns in the file and do not modify any other files.
```

---

### Example: Designing a New Level

Level files are JSON — no code at all. They are the easiest entry point for contributing without any programming knowledge.

Give the GPT:
1. `level_design.md` — so it understands the philosophy
2. An existing level file (e.g. `level_01.json`) — as the format template
3. A description of the puzzle you want to create

```
Here is the level design philosophy: [paste level_design.md]
Here is an example level file format: [paste level_01.json]

Please design a new level for Levels 6–10 (The Shift phase). 
The level should introduce the Scrap Pool as a resource. 
Player 1 needs the Jump ability to cross a chasm but lacks the right conduit plate.
The required plate is accessible in the Scrap Pool, but Player 2 must spend 1 AP to draw it blind.
Generate the JSON file following the exact format of level_01.json.
```

---

## 6. Quick Reference: Which File Does What

| I want to... | Read this doc | Edit this code |
|-------------|--------------|----------------|
| Understand the whole game | `mechanics.md` | — |
| Change an AP cost | `mechanics.md §2` | `APSystem.ts` |
| Add a new obstacle type | `mechanics.md §3` | new component in `/components/`, `HazardFactory.ts` |
| Add a new ability | `mechanics.md §5`, `architecture.md §4` | `AbilitySystem.ts`, new component if needed |
| Change the Matrix rules | `mechanics.md §4` | `MatrixInsertSystem.ts`, `MatrixRoutingSystem.ts` |
| Design a new level | `level_design.md` | new JSON in `/levels/` |
| Change communication rules | `communication_rules.md` | `ChatManager.ts`, `ChatUI.ts` |
| Change how something looks | `art_and_ui.md` | `/src/rendering/`, `/src/ui/`, `/public/sprites/` |
| Add a new narrative panel | `narrative.md §5` | new image in `/public/cutscenes/`, update level JSON |
| Change the network model | `digital_implementation.md §5.2` | `/src/network/` |

---

## 7. The Golden Rule

The design documents and the code must always agree. If you change a rule in `mechanics.md`, the corresponding system in `/src/systems/` must be updated to match — and vice versa. When they disagree, the document is the authority, and the code needs to be fixed.

This is the reason the docs exist: they are the specification. The code is just one implementation of that specification.
