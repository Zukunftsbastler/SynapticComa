# Digital Implementation: ECS Execution Model

## 1. Overview

The game is implemented as a deterministic, network-synchronized **Entity Component System (ECS)**.

All gameplay emerges from:

* shared state
* system execution order
* player input translated into actions

There is **no turn or round system**. The game runs continuously, with progression driven by player actions and state changes.

---

## 2. Core Execution Loop

Each frame (tick), the following pipeline is executed in strict order:

```
InputSystem → APSystem → MovementSystem → CollectionSystem →
PushSystem → ThresholdSystem → APUnlockSystem →
MatrixInsertSystem → MatrixRotateSystem → ScrapPoolSystem →
MatrixRoutingSystem → AbilitySystem → CollisionSystem →
ExitSystem → LevelTransitionSystem → RenderSystem → NetworkSystem
```

---

## 3. Action Point System (AP)

### 3.1 Core Rules

* AP is a **shared, persistent resource**
* Stored in a singleton entity: `APPool`
* AP does **not reset**
* AP is only modified by:

  * player actions (spend)
  * unlock events (gain)

---

### 3.2 APPool Component

```ts
APPool {
  current: number
  max: number
}
```

---

### 3.3 APSystem

**Responsibilities:**

* Validate incoming actions against available AP
* Deduct AP cost if valid
* Reject action if insufficient AP

**Important:**

* No round logic
* No refill behavior
* No phase switching

---

## 4. AP Unlock System

### 4.1 Purpose

Handles all logic related to **gaining AP through gameplay progression**.

---

### 4.2 APUnlock Entity

Unlock points are represented as entities:

```ts
APUnlock {
  id: number
  value: number
  triggered: boolean
}
```

Combined with:

* `Position`
* `Dimension`

---

### 4.3 APUnlockSystem

**Responsibilities:**

* Detect when both players satisfy unlock conditions:

  * same time
  * correct positions
* Verify unlock is not already triggered
* Increase `APPool.current`
* Mark unlock as consumed (`triggered = true`)

---

### 4.4 Trigger Conditions

Handled via:

* position checks
* optional ready flags
* threshold reuse

---

## 5. Input Handling

### 5.1 InputSystem

* Converts player input into `GameMessage`
* Queues actions into `pendingInputs`

---

### 5.2 Validation Flow

1. Input received
2. Passed to `APSystem`
3. If valid → executed
4. If invalid → rejected silently or with feedback

---

## 6. Matrix Systems

### 6.1 MatrixInsertSystem

* Handles column slide insertion
* Deducts 2 AP
* Ejects conduit to Scrap Pool

---

### 6.2 MatrixRotateSystem

* Rotates conduit
* Deducts 1 AP

---

### 6.3 ScrapPoolSystem

* Handles blind draw
* Deducts 1 AP

---

### 6.4 MatrixRoutingSystem

* BFS traversal from source nodes
* Updates powered ability nodes

---

## 7. Ability System

Continuously evaluates routing state:

* Adds/removes components:

  * `Resistances`
  * movement modifiers
* Applies only while path exists

---

## 8. Movement & Interaction

### MovementSystem

* Validates movement
* Applies ability modifiers

### CollectionSystem

* Adds conduits to inventory
* Reveals shape on pickup

### PushSystem

* Moves `Pushable` entities

---

## 9. Failure & Dead-End Detection

### 9.1 CollisionSystem

* Detects lethal hazards
* Triggers `AvatarDestroyedEvent`

---

### 9.2 Dead-End Detection

Triggered when:

* `APPool.current == 0`
* No available unlocks remain
* No valid path to exit exists

Result:

* UI shows "Dead End"
* Players may restart

---

## 10. Exit & Progression

### ExitSystem

* Detects Player 1 exit
* Locks matrix state
* Activates Player 2 exit

---

### LevelTransitionSystem

* Processes:

  * `LevelCompleteEvent`
  * `AvatarDestroyedEvent`
* Cleans up event entities

---

## 11. Networking Model

### 11.1 Authority

* Host-authoritative model
* Host validates all AP usage and unlock triggers

---

### 11.2 Synchronization

* Shared state:

  * APPool
  * Matrix state
  * Entity positions

---

### 11.3 Messages

```ts
MOVE
INSERT_CONDUIT
ROTATE_CONDUIT
DRAW_SCRAP
STATE_UPDATE
```

---

## 12. UI Integration

### AP Display

* Always shows current AP
* No refill animation
* AP increases only when unlock is triggered

### Feedback

* Unlock activation:

  * visual pulse
  * AP increase animation

---

## 13. Removed Systems

The following systems no longer exist:

* `RoundSystem`
* AP reset logic
* Pass action handling

---

## 14. Summary

The system operates as:

* continuous
* state-driven
* deterministic

There are:

* no turns
* no rounds
* no passive resource gain

All progression is achieved through:

* player action
* cooperation
* system interaction
