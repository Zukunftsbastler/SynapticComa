# Mechanics: The Dual-Board System

## 1. Core Gameplay Loop

The game is a deterministic logic puzzle distributed across two interconnected boards:

* **The Hex Grid (The Environment):** Where avatars move, explore, and collect resources.
* **The DNA Matrix (The Control Panel):** A square grid where players manipulate routing tiles to unlock abilities required to navigate the Hex Grid.

### Action Point System (Shared, Persistent Pool)

Players share a single **Action Point (AP) pool** across the entire level.

* AP does **not reset**.
* When AP reaches 0, players cannot perform further actions.
* Additional AP can only be gained by completing **Shared Unlock conditions** (see below).
* AP is a **finite resource** that must be expanded through correct play and cooperation.

**Shared Unlock (AP Gain):**

* Certain positions or conditions on the Hex Grid act as **Shared Unlock Nodes**.
* When both players satisfy the condition simultaneously, the team gains additional AP.
* Each unlock can only be triggered **once**.

The ultimate goal is to navigate both avatars to their designated Nexus Hexes (exits) in the correct sequence.

---

## 2. Complete AP Cost Table

| Action                                  | Board      | AP Cost                    | System                         |
| --------------------------------------- | ---------- | -------------------------- | ------------------------------ |
| Move (1 hex)                            | Hex Grid   | 1                          | MovementSystem                 |
| Collect Conduit (automatic on movement) | Hex Grid   | 0                          | CollectionSystem               |
| Use a Routed Ability                    | Hex Grid   | 0 — treated as normal Move | AbilitySystem + MovementSystem |
| Insert Conduit (column slide)           | DNA Matrix | 2                          | MatrixInsertSystem             |
| Rotate an already-inserted Conduit      | DNA Matrix | 1                          | MatrixRotateSystem             |
| Orient a Conduit before insertion       | DNA Matrix | 0                          | —                              |
| Draw from the Scrap Pool (blind)        | DNA Matrix | 1                          | ScrapPoolSystem                |

**Key rule:** Routing power on the DNA Matrix is the cost of gaining an ability. Using a routed ability costs only normal movement (1 AP). Abilities are never double-charged.

---

## 3. Board 1: The Hex Grid (Exploration)

The Hex Grid is a strictly spatial puzzle. Avatars begin here with basic movement only.

* **Movement (1 AP):** Move to an adjacent hex
* **Collection (0 AP):** Conduits are collected automatically
* **Using Abilities (0 extra AP):** Abilities modify movement rules
* **Hazards:** Entering a lethal hazard without protection destroys the avatar

### 3.1 Conduit Visibility Rule

Conduits appear as a generic `???` icon until collected. Their shape is unknown beforehand, enforcing strict information asymmetry.

---

## 4. Board 2: The DNA Matrix (The Labyrinth)

The DNA Matrix is a fixed **5×5 grid**.

### 4.1 Matrix Architecture

| Column | Role             | Content           |
| ------ | ---------------- | ----------------- |
| 1      | Sources          | Player nodes      |
| 2      | Conduit Layer 1  | Player-controlled |
| 3      | Tier 1 Abilities | Static            |
| 4      | Conduit Layer 2  | Player-controlled |
| 5      | Tier 2 Abilities | Static            |

Energy flows **left → right**.

---

### 4.2 Matrix Manipulation

* **Insert Conduit (2 AP):** Slide into column, shifting tiles
* **Rotate Conduit (1 AP):** Rotate 90°
* **Draw Scrap (1 AP):** Draw blind from pool

---

### 4.3 The Scrap Pool

Face-down shared pool. Known by count, never by content.

---

### 4.4 Conduit Shapes

**Standard Set (rotatable):**

* Straight
* Curved
* T-Junction

**Master Set (non-rotatable):**

* Cross (+)
* Splitter (Y)

---

## 5. Ability Rules

Abilities are active only while a valid Matrix path exists. Breaking a path instantly removes the effect.

### 5.1 Jump

Move up to 2 hexes in a straight line. Must land safely.

### 5.2 Push

Push adjacent object 1 hex. Avatar does not move.

### 5.3 Phase Shift

Phase barriers become traversable.

### 5.4 Unlock

Matching doors lose `Static` while active.

### 5.5 Fire Immunity

Fire hazards no longer destroy the avatar.

### 5.6 Ability Scope Rule

Abilities apply only to the connected player unless both sources are routed.

---

## 6. Win Condition: Sequential Exit

1. Player 1 reaches exit → becomes spectator
2. Player 2 exit activates
3. Player 2 exits → level complete

Matrix state is locked when Player 1 exits.

---

## 7. Failure Condition

* Entering lethal hazard without protection → instant death
* First failure → restart
* Second failure → return to level select

### Soft-lock Prevention

If:

* AP = 0
* No conduits remain
* No path to exit exists

→ The game detects a **Dead End** and allows restart.

---

## 8. Design Implication: AP as Progression

AP is not a timer or round-based resource.

Instead:

* AP represents **available cognitive energy**
* Players must **earn more AP by solving parts of the puzzle**
* Running out of AP is not failure by itself — it is a signal that the correct path has not yet been discovered

This ensures:

* No stalling through waiting
* No artificial round structure
* All progress is tied to player action and cooperation

