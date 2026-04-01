# 🧬 DNA Matrix System – Game Design Overview

## 🎮 Core Concept

The DNA Matrix is a shared system where **5 biological cells (players)** evolve by inserting DNA base pairs into a central matrix.

These are **not characters**, but **cells navigating a hostile environment**.

Each cell:

* Gains abilities to **overcome obstacles**
* Is affected by a **shared DNA system**

---

## 👥 Player Structure (Left Side)

* There are **x numbers af player listet downworth**
* Each cell is displayed on the **left side**
* Each cell has a horizontal row of:

👉 **6 DNA output slots (● ● ● ● ● ●)**

These represent the cell’s current DNA sequence.

---

## 🧬 DNA Output → Abilities (Right Side)

* Each cell’s 6-base sequence determines its **abilities**
* Abilities are shown on the **right side**

Examples:

* Toxic attack
* Consume other cells
* Phase through obstacles
* Speed boost
* Poison immunity
* Regeneration

👉 Important:
Cells use these abilities to **interact with obstacles and the environment**, not each other.

---

## ⚙️ DNA Rules (CRITICAL)

Only **valid base pairs** generate abilities:

| Pair  | Result      |
| ----- | ----------- |
| A + T | ✅ Ability   |
| C + G | ✅ Ability   |
| A + C | ❌ No effect |
| T + G | ❌ No effect |

---

## 🧠 Ability Calculation

Each row of 6 bases is evaluated:

### Example:

ACACAC → ❌ No valid pairs → No abilities

ACATCG →

* AT = ✅ ability
* CG = ✅ ability
  → Total: 2 abilities

---

## 🔁 Matrix System (Center Gameplay)

The DNA Matrix is a **shared vertical grid system**:

### Input (Top)

* Players insert bases (A, T, C, G) into columns
* Input is visualized with **downward arrows**

### Flow

* Bases move **top → bottom**
* Each insertion pushes all bases down

### Output (Bottom)

* Bases exit the matrix
* These outputs fill the **player DNA rows**

---

## 🔄 Core Mechanic: Shared Mutation

Every time a player inserts a base:

1. A base is inserted at the top
2. All bases shift downward
3. A base exits at the bottom
4. ALL players’ DNA rows are updated
5. ALL abilities are recalculated

👉 This means:

* One action affects everyone
* Players indirectly control each other

---

## ☣️ Gameplay Meaning

Cells are trying to:

* Survive obstacles
* Adapt through DNA
* Gain abilities to progress

Examples:

* A toxic cell can destroy obstacles
* A resistant cell can pass through hazards
* A fast cell can bypass traps

---

## 🎨 Visual Layout

### LEFT

* x numbers of cells (biological entities)
* Each with 6 DNA slots

### CENTER

* DNA Matrix (grid with vertical flow)

### RIGHT

* Ability list per cell
* Clearly linked to DNA output

---

## 🧭 Design Principles

### 1. Clarity First

* Players must instantly see:

  * their DNA
  * their abilities
  * how changes affect them

### 2. Cause → Effect

* Insert → shift → output → ability change

### 3. Shared System

* No isolated players
* Everything is interconnected

### 4. Visual Feedback

* Movement and change must be animated
* No hidden calculations

---

## 🚀 Summary

The DNA Matrix is a **shared evolutionary system** where:

* x numbers af cells compete and adapt
* DNA is constantly shifting
* Abilities emerge from structure
* Every move reshapes the entire system

👉 “You don’t control your evolution alone — you influence everyone’s.”

