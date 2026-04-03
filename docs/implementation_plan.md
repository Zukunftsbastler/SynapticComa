# Implementation Plan

## Overview

This plan outlines the step-by-step implementation of the game systems using ECS.

The implementation follows a **continuous, state-driven model**:

* No turn system
* No round lifecycle
* All progression is driven by player actions and system interactions

---

## Phase 1: Core ECS Foundation

### Goals

* Establish entity/component structure
* Basic rendering and input

### Tasks

* Implement ECS framework (bitECS or equivalent)
* Create core components:

  * `Position`
  * `Renderable`
  * `Dimension`
* Implement:

  * `RenderSystem`
  * `InputSystem`

---

## Phase 2: Movement & Interaction

### Goals

* Enable player movement on Hex Grid
* Basic interaction with environment

### Tasks

* Implement `MovementSystem`
* Implement `CollisionSystem`
* Implement `Hazard` + `Lethal` handling
* Implement `CollectionSystem`

---

## Phase 3: Action Point System (Core)

### Goals

* Introduce shared AP system
* Enforce cost-based actions

### Tasks

* Implement `APPool` singleton
* Implement `APSystem`:

  * validate actions
  * deduct AP
  * reject invalid actions

### Rules

* AP is persistent (no reset)
* No round or phase logic

---

## Phase 4: DNA Matrix Systems

### Goals

* Enable core puzzle mechanic

### Tasks

* Implement `MatrixInsertSystem`
* Implement `MatrixRotateSystem`
* Implement `MatrixRoutingSystem`
* Implement `ScrapPoolSystem`

---

## Phase 5: Ability System

### Goals

* Enable dynamic rule changes via matrix

### Tasks

* Implement `AbilitySystem`
* Add/remove:

  * `Resistances`
  * movement modifiers
* Ensure continuous evaluation

---

## Phase 6: AP Unlock System

### Goals

* Enable progression-based AP gain

### Tasks

* Define `APUnlock` component
* Implement `APUnlockSystem`:

  * detect shared conditions
  * verify both players are in position
  * grant AP
  * mark unlock as consumed

### Design Constraints

* Unlocks are one-time only
* Must require both players
* Must be clearly visible in level design

---

## Phase 7: Threshold & Progression

### Goals

* Handle board state transitions

### Tasks

* Implement `ThresholdSystem`
* Trigger `BoardFlipEvent`
* Preserve matrix state across transitions

---

## Phase 8: Win / Loss Conditions

### Goals

* Define success and failure states

### Tasks

* Implement `ExitSystem`
* Implement `LevelTransitionSystem`
* Implement death handling (`AvatarDestroyedEvent`)

---

## Phase 9: Dead-End Detection

### Goals

* Prevent soft-lock frustration

### Tasks

* Detect:

  * AP = 0
  * No remaining unlocks
  * No valid path to exit
* Trigger "Dead End" UI state

---

## Phase 10: Networking

### Goals

* Synchronize shared state between players

### Tasks

* Implement `NetworkSystem`
* Sync:

  * APPool
  * Matrix state
  * entity positions
* Ensure host-authoritative validation

---

## Phase 11: UI & Feedback

### Goals

* Communicate system state clearly

### Tasks

* Display AP pool (no refill behavior)
* Add feedback for:

  * AP spending
  * AP unlock activation
* Visualize shared unlock nodes

---

## Phase 12: Playtesting & Iteration

### Goals

* Validate new AP system

### Tasks

* Test:

  * starting AP values (2 vs 4)
  * unlock placement
  * difficulty pacing
* Identify:

  * soft-lock frequency
  * player confusion points

---

## Removed Systems

The following systems are intentionally excluded:

* RoundSystem
* AP reset logic
* Turn phases
* Pass action

---

## Summary

The implementation follows a clear progression:

1. Core ECS
2. Movement & interaction
3. Persistent AP system
4. Matrix mechanics
5. Ability system
6. AP unlock progression
7. Win/loss + polish

The system is:

* continuous
* deterministic
* fully action-driven

No part of the implementation relies on time-based progression.
