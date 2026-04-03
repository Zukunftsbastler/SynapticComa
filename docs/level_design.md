# Level Design: AP-Gated Cooperative Puzzles

## 1. Core Principle

Levels are designed as **resource-gated puzzles**, not time-based challenges.

* Players do not wait for new resources
* Players must **unlock progression through correct actions**
* Action Points (AP) represent **available progress**, not time

A level is solved when players understand:

* where to go
* what to unlock
* when to commit

---

## 2. AP as Progression

### 2.1 Starting State

* Players begin each level with a **limited AP pool** (typically 2–4)
* This is intentionally insufficient to complete the level

### 2.2 AP Exhaustion as Signal

When AP reaches 0:

* This is **not failure**
* It indicates:

  > “You have not yet discovered the correct progression path”

Players must:

* explore alternative routes
* coordinate positioning
* discover Shared Unlock opportunities

---

## 3. Shared Unlock Design

### 3.1 Purpose

Shared Unlocks are the **primary method of progression**.

They:

* grant additional AP
* require cooperation
* create synchronization challenges

---

### 3.2 Rules

* Must require **both players**
* Must be **clearly visible** in each dimension
* Must be **one-time activation**
* Must grant **shared benefit**

---

### 3.3 Types of Unlock Conditions

Levels may use:

* **Simultaneous Positioning**

  * Both players stand on matching nodes

* **End-State Alignment**

  * Both players reach specific areas before triggering

* **Threshold-based Unlock**

  * Reusing existing threshold logic

---

### 3.4 Unlock Effects

Primary effect:

* +AP to shared pool

Optional variations:

* Temporary matrix cost reduction
* Ability unlock
* Path activation

---

## 4. AP Gating Patterns

### 4.1 Hard Gate

Players cannot proceed without unlocking more AP.

Example:

* Initial AP allows reaching only partial objective
* Unlock node required to continue

---

### 4.2 Split Responsibility Gate

Each player must:

* solve their own spatial challenge
* reach their node independently

---

### 4.3 Sequential Gate

* First unlock enables access to second unlock
* Creates multi-step cooperation

---

### 4.4 False Path / Soft Trap

* Players can spend AP inefficiently
* Leads to AP exhaustion
* Forces rethink

---

## 5. Relationship to DNA Matrix

The Matrix remains the **core puzzle system**.

Level design must ensure:

* AP is often needed for:

  * conduit collection
  * matrix insertion
  * repositioning

* Shared Unlocks do NOT replace matrix solving

* Instead, they:

  > enable the opportunity to solve the matrix

---

## 6. Difficulty Scaling

### Early Levels

* 1 unlock
* obvious positioning
* minimal matrix complexity

### Mid Levels

* multiple unlocks
* misleading paths
* increased matrix dependency

### Late Levels

* chained unlocks
* tight AP margins
* heavy coordination + matrix planning

---

## 7. Failure & Recovery

### 7.1 Hard Failure

* lethal hazards → death → restart

### 7.2 Soft Failure (Primary)

* AP reaches 0
* no unlock triggered

System response:

* show “Dead End” indicator
* allow restart without penalty

---

## 8. Player Experience Goals

Levels should create:

* **Discovery:** “Oh, we need to go there first”
* **Coordination:** “We both need to be ready”
* **Commitment:** “If we spend AP now, we might be stuck”

---

## 9. Design Anti-Patterns (Avoid)

❌ AP farming
❌ Repeatable unlock loops
❌ Optional unlocks that trivialize puzzles
❌ Hidden unlocks with no visual cues
❌ Solutions that rely on trial-and-error brute force

---

## 10. Summary

Level design is built around one core loop:

> Explore → Spend AP → Get Stuck → Discover Unlock → Gain AP → Progress

There are:

* no turns
* no waiting
* no passive recovery

Only:

* action
* coordination
* understanding
