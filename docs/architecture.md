# Architecture: Dual-Format Entity Component System (ECS)

## 1. Architectural Philosophy

The game relies on a strict Entity Component System (ECS). This architecture is chosen because it perfectly mirrors how physical board games operate. To maintain parity between the digital and tabletop versions, we treat the human players in the board game as the "CPU" executing the Systems.

Furthermore, the game architecture is strictly **language-agnostic**. Text is stripped from game pieces entirely. Logic and mechanics are conveyed through universal iconography, status tokens, and physical board placement.

---

## 2. Entities (The "Identity")

Entities have no inherent logic or data; they are simply unique identifiers.

* **Digital Implementation:** A UUID (e.g., `Entity_001`)
* **Physical Implementation:** A token or meeple

---

## 3. Components (The "Properties & State")

Components are pure data. Every active component must have a visual representation.

### ActionManager (Singleton Entity)

A single entity manages the global AP state.

**Components:**

* `APPool { current: ui8, max: ui8 }`

❌ Removed:

* `RoundState`

### Key Change

* AP is no longer tied to a round lifecycle
* AP persists across the entire level
* AP is only modified by:

  * player actions (spend)
  * shared unlock events (gain)

---

## 4. Systems (The "Logic & Rules")

### Updated System Order

```
InputSystem → APSystem → MovementSystem → CollectionSystem →
PushSystem → ThresholdSystem → APUnlockSystem →
MatrixInsertSystem → MatrixRotateSystem → ScrapPoolSystem →
MatrixRoutingSystem → AbilitySystem → CollisionSystem →
ExitSystem → LevelTransitionSystem → RenderSystem → NetworkSystem
```

---

### System Changes

#### ❌ Removed

* `RoundSystem`

---

### 🆕 `APUnlockSystem`

| Responsibility                       |
| ------------------------------------ |
| Detects Shared Unlock conditions     |
| Verifies both players meet condition |
| Grants AP to shared pool             |
| Disables unlock after activation     |

---

### 🔄 Updated Systems

#### `APSystem`

* Deducts AP from persistent pool
* Rejects actions if insufficient AP
* No reset logic

---

#### `ThresholdSystem`

* Still handles board flip
* Now also contributes to AP gating (level-dependent)

---

## 5. Architectural Handling of Core Mechanics

### 5.1 Shared Unlock as System-Level Mechanic

Shared Unlocks are implemented as ECS-driven interactions:

* Entities with `Threshold` or new `APUnlock`-like behavior
* Triggered when:

  * both players occupy required positions
  * optional ready confirmation is true

**Digital:**

* `APUnlockSystem` detects condition
* Emits AP gain event (or directly mutates `APPool`)
* Marks unlock as consumed

**Physical:**

* Both players stand on marked nodes
* Visually indicated activation (token flip, light, etc.)
* AP resource increased manually

---

### 5.2 Dimensional Flip (unchanged)

Handled via:

* `DimensionLayer`
* `BoardFlipEvent`

No dependency on round system.

---

### 5.3 Threshold (Updated Role)

The Threshold remains:

* A synchronized condition
* A controlled board state change

Additionally:

* Can act as an **AP unlock trigger** in early levels

---

## 6. Removed Systems & Concepts

The following are fully removed from architecture:

* Round lifecycle
* Round-based AP reset
* Pass action
* Global lockout tied to rounds

---

## 7. Architectural Implication

The system now operates as:

* **Continuous execution model**
* No artificial phase boundaries
* All progression is driven by:

  * spatial position
  * system interaction
  * cooperative triggers

---

## 8. Design Alignment

This architecture now aligns with:

* **Mechanics.md** → Persistent AP system
* **Level Design** → AP gating and unlock-based progression
* **Communication Rules** → Timing based on state, not rounds

---

## 9. Summary

The architecture shifts from:

> Round-based execution loop

to:

> Continuous, state-driven puzzle system

Where:

* AP is a **shared, persistent resource**
* Systems react to **player actions**, not time steps
* Progression emerges from **interaction, not iteration**
