# 🧬 DNA Matrix Game – Game Design Document (GDD)

---

# 1. 🎮 Game Overview

**Title:** DNA Matrix  
**Genre:** Co-op Puzzle / Strategy  
**Platform:** (PC / Web / Mobile – TBD)  
**Players:** 2+ (Co-op)

---

## 🧠 Core Idea

Players cooperate to build functional cells using DNA base pairing in order to solve biological challenges.

The game is not about competition, but about:
- coordination  
- planning  
- problem-solving  

---

# 2. 🔁 Core Gameplay Loop

1. A player receives a base (`A`, `T`, `C`, `G`)  
2. The player chooses a column (1–6)  
3. The base is pushed into the matrix  
4. The matrix updates (push mechanic)  
5. Base pairs are formed  
6. Cell type and abilities are updated  
7. Players use abilities to solve situations  

---

# 3. 🧱 Game Board

## Matrix

- 2 × 6 grid (expandable for more players)  
- One row per player  


---

## 🔄 Push Mechanic

- A base is inserted from the top  
- Existing bases are pushed downward  
- The bottom base is removed  

👉 Players affect each other → cooperation is required  

---

# 4. 🧬 DNA System

## Base Types

| Base | Color |
|------|------|
| A | Red |
| T | Orange |
| C | Green |
| G | Blue |

---

## Base Pairing

Order matters:

- AT ≠ TA  
- CG ≠ GC  

---

# 5. 🧬 Cell Types (Pair 1)

| Base Pair | Cell Type | Function |
|----------|----------|----------|
| TA | Kidney Cell | Handles kidney-related problems |
| AT | Skin Cell | Operates on surfaces |
| CG | Lung Cell | Related to oxygen/air systems |
| GC | Brain Cell | Advanced control |
| other | No Type | No special function |

👉 Cell type determines:
- movement rules  
- interaction capabilities  

---

# 6. ⚔️ Abilities (Pairs 2 and 3)

Abilities are used to overcome obstacles in the environment.

---

## Ability List

| Ability | Effect |
|--------|-------|
| Ultrasound | Destroys kidney stones |
| Acid | Removes blood clots |
| Poison Injector | Kills cancer cells |
| Camouflage | Bypasses immune system |
| Fire Resist | Withstands fire |
| Vein Drill | Drills into blood vessels |
| Jump | Jumps over obstacles |
| Super Heat | Kills bacteria |

---

## Ability Logic

- Ability = base pair + position  
- Pair 2 = Ability 1  
- Pair 3 = Ability 2  

---

# 7. 🌍 Obstacles / Challenges

| Obstacle | Required Ability |
|---------|----------------|
| Kidney Stone | Ultrasound |
| Blood Clot | Acid |
| Cancer Cells | Poison Injector |
| Immune System | Camouflage |
| Fire | Fire Resist |
| Bacteria | Super Heat |
| Obstacles | Jump |
| Blood Vessels | Vein Drill |

---

# 8. 🤝 Co-op Design

## Cooperation

Players must:
- coordinate which bases they insert  
- help each other build abilities  
- prioritize who needs what  

---

## Example

- Player A builds **Ultrasound**  
- Player B builds **Camouflage**  
- Together they solve a sequence of challenges  

---

## Interdependence

- Players cannot solve everything alone  
- The system encourages teamwork  

---

# 9. 🎯 Game Goals

- Solve biological puzzles  
- Support teammates  
- Optimize the matrix  
- Build effective cells  

---

# 10. 🖥️ UI Design

## Layout

- Left: Players and cell types  
- Center: Shared DNA matrix  
- Right: Active abilities  

---

## Visual Elements

- Color-coded bases  
- Frames around pairs (1-2, 3-4, 5-6)  
- Grey for invalid pairs  

---

# 11. 🧠 Design Principles

- Simple system → deep strategy  
- Cooperation over competition  
- Order matters  
- Players constantly influence each other  

---

# 12. 🔮 Future Features

- More players (3–4 co-op)  
- New cell types  
- Additional abilities  
- Level progression  
- Boss mechanics  
- Random events  

---

# 13. 📦 Scope

## MVP

- 2 players  
- 2×6 matrix  
- 4 cell types  
- 8 abilities  
- Basic obstacles  

---

## Extensions

- Dynamic levels  
- Ability upgrades  
- Multiple environments  

---

# 14. 💡 Vision

A cooperative game where players:

- think together  
- build solutions together  
- experience biology through gameplay  

---

🧬 *“Build the right cell, at the right time — together.”*
