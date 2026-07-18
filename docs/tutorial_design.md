# Tutorial System: The Monitor

A modular, trigger-driven tutorial layer that detects when a player first encounters a game element that needs explanation and delivers that explanation **inside the game's fiction**, with precise visual guidance toward the relevant control.

---

## 1. Narrative Framing: The Monitor

The game board is language-agnostic and stays that way — no text ever appears on game pieces (`architecture.md §1`). The tutorial therefore lives in a distinct, diegetic UI layer: **The Monitor**, the hospital's bedside monitoring system observing the patient's mind. Tutorial text renders as typed lines on a vintage CRT overlay strip — phosphor-green monospace on glass, with scanlines and a soft flicker — consistent with the Medical Macabre identity (`art_and_ui.md`).

This creates a clean rule:

> **The mind is wordless. The machine watching it is not.**
> Game pieces, boards, and icons: never any text. The Monitor overlay, menus, and lobby: localizable text (i18n string tables, `en`/`de` at launch).

The Monitor also carries the story: its clinical annotations before Level 1 ("SUBJECT: COMATOSE. DAY 214. INITIATING DEEP STIMULATION.") frame the silent cutscene panels and give the guided intro (§5) its voice.

## 2. Central Game Elements (the Concept Registry)

Every element that needs explanation is a **Concept** with a stable ID. This registry is the single extension point: adding a mechanic later means registering one concept — nothing else in the tutorial machinery changes.

| ConceptId | Element | Triggered when… |
|-----------|---------|-----------------|
| `MOVE` | Hex movement & AP cost | guided intro step 1 |
| `AP_POOL` | The shared AP vials | first AP spend |
| `COLLECT` | `???` collectible plates | first time a collectible is within 2 hexes of the avatar |
| `INVENTORY` | Private inventory rack | first plate collected |
| `MATRIX_INSERT` | Column slide insert | first time the player holds a plate and the matrix is interactable |
| `MATRIX_ROTATE` | Rotate in place | first level where rotation is part of the optimal solution |
| `ROUTING` | Power flow source→ability | first time an ability node becomes powered |
| `ABILITY_USE` | Using a routed ability | first tick an ability is active for the local player |
| `SCRAP_POOL` | Face-down scrap pile | first ejection event |
| `UNLOCK_NODE` | Shared Unlock node | first time an unlock node is within 2 hexes |
| `DEAD_END` | Dead End state & free restart | first Dead End |
| `EXIT_SEQUENCE` | Sequential exit order | first time either exit is within 2 hexes |
| `THRESHOLD` | Ready-confirm & board flip | first level with `thresholdEnabled` |
| `RESONANCE` | Base glyphs & ordered pairs | first level ≥ 6, first insert forming any adjacency |
| `CHAT` | Emoji chat strip | lobby, once connected |

Each concept is explained **exactly once per profile** (persisted, §4.3) and can be re-read anytime from a Monitor log menu.

## 3. The Highlight Presentation

When a concept fires, the tutorial presents it with strict visual discipline — the goal is that the eye lands exactly where the hand must go:

1. **Dim:** the whole screen darkens ~40% except the target.
2. **Frame:** the relevant control or board element gets a bright, animated rectangular frame (a "calibration bracket" in Monitor fiction) that isolates it visually.
3. **Explanation box:** a CRT text box appears in the nearest free screen region, containing, in order: *what this element is* → *what it does mechanically* → *what to do right now* (one imperative sentence, e.g. "Press **D** to move one hex east.").
4. **Arrow:** a drawn connector arrow leads from the box's edge to the framed element. The arrow is routed around, never across, other UI.
5. **Act to advance:** the box stays until the player *performs the described action* (not until they click "OK"). Input outside the highlighted action is ignored while a **blocking** step is active; **non-blocking** hints time out after 8 seconds instead.
6. A subtle "skip tutorial" affordance (hold ESC) exists for repeat players; skipping marks all current-level concepts as seen.

In networked play, tutorial state is **local per client** — each player gets their own explanations for their own screen; nothing crosses the wire.

## 4. Architecture

The tutorial adds one read-only ECS system, one plain-TS director, and one overlay renderer. No existing system changes.

```
src/tutorial/
├── concepts.ts           # ConceptId enum + registry (trigger spec per concept)
├── TutorialState.ts      # seen-concepts set; localStorage persistence
├── TutorialTriggerSystem.ts  # read-only ECS system; emits concept encounters
├── TutorialDirector.ts   # step queue; blocking logic; script playback (§5)
└── TutorialOverlay.ts    # dim/frame/box/arrow renderer (PixiJS layer above HUD)
```

### 4.1 `TutorialTriggerSystem` (detection)

Runs at the end of the pipeline, after `RenderSystem` — it only reads. Two trigger sources:

* **Proximity triggers:** entities carry an optional `TutorialTrigger { conceptId: ui8, radius: ui8 }` component (set by `LevelLoaderSystem` from the level JSON or by entity factories from defaults). The system checks the local player's avatar distance against `radius` each tick.
* **State triggers:** predicates over `GameState`/ECS ("an ability node just became active", "the scrap pool count went 0→1"). Each concept's predicate lives in its registry entry in `concepts.ts` — adding one never touches the system.

On a first encounter (`conceptId ∉ TutorialState.seen`), it pushes the concept to the `TutorialDirector` queue. That is its entire job.

### 4.2 `TutorialDirector` (sequencing)

Maintains a FIFO of pending concepts, shows at most one at a time, enforces blocking/non-blocking behavior, marks concepts seen when their required action completes. During normal play it is purely reactive. During the guided intro (§5) it switches to **script mode** and drives the sequence itself.

### 4.3 Persistence

`TutorialState` persists the seen-set under `synaptic_coma_tutorial` in `localStorage`, alongside the existing progression key. Deleting it (a "recalibrate" option in the menu) replays everything.

## 5. The Guided Intro: "Calibration"

Level 1 opens with an **extremely guided scripted passage** — Monitor fiction: the machine calibrates its connection to the two consciousness fragments. Every core control is exercised once, in order, with full highlight guidance:

```
1. MOVE        — "Motor cortex response required." Move 1 hex (blocking).
2. AP_POOL     — frame the vials; show the spend that just happened (non-blocking).
3. COLLECT     — a plate lies 2 hexes away; walk onto it (blocking).
4. INVENTORY   — frame the rack; the revealed shape (non-blocking).
5. MATRIX_INSERT — insert the plate into column 2 (blocking).
6. ROUTING     — the path powers a node; frame the flowing groove (non-blocking).
7. ABILITY_USE — use the routed ability to pass the obstacle (blocking).
8. UNLOCK_NODE — both players stand on their unlock hexes; AP surge (blocking).
9. EXIT_SEQUENCE — P1 exits first, then P2 (blocking).
```

### 5.1 Script Format

The script is data, not code — a JSON file per scripted passage:

```jsonc
// src/levels/tutorial_calibration.json
{
  "levelId": "level_01",
  "steps": [
    {
      "id": "cal_move",
      "concept": "MOVE",
      "focus": { "type": "hex", "q": 1, "r": 2, "z": 0 },   // or { "type": "ui", "ref": "matrix_col2" }
      "textKey": "tut.cal.move",       // i18n key — Monitor line
      "blocking": true,
      "completeOn": { "action": "MOVE_AVATAR" }
    }
  ]
}
```

Steps are **insertable**: a step declares only its predecessor by array position, and the Director tolerates unknown future step types. Adding the `RESONANCE` mechanic later meant adding one step object and one string — this is the modularity requirement, honored by construction.

### 5.2 Relationship to Levels 2–15

Only Level 1 uses script mode. From Level 2 on, the reactive trigger system (§4.1) carries tutorialization: each campaign level introduces exactly one mechanic (`level_design.md §5`), and that mechanic's concept fires naturally on first encounter. The level design *is* the curriculum; the Monitor only annotates it.

## 6. What the Tutorial Never Does

* ❌ Never puts text on game pieces or the board itself.
* ❌ Never explains a concept before the player can act on it.
* ❌ Never shows two boxes at once.
* ❌ Never repeats a seen concept unsolicited.
* ❌ Never blocks the partner's client — blocking is strictly local.
