# Level Design Pipeline & Philosophy

## 1. Core Design Philosophy
In *Synaptic Coma*, a level is a lock, and the players' verbal communication is the key. Because the game relies on pre-constructed scenarios without text-based rules, the level design itself must act as the tutorial, the challenge, and the narrative. 

* **Design for the Blind Spot:** Player 1 often has the *solution* (a specific Conduit Plate) to Player 2's *problem*. They must discover this through descriptive communication.
* **The Illusion of Choice (Red Herrings):** To prevent linear "breadcrumb" gameplay, levels must feature deliberate dead ends, decoy locks, and inefficient paths. The puzzle is not just *how* to open a door, but deciding *if* that door is even worth opening.
* **Language-Agnostic Teaching:** New mechanics are introduced in isolation. If you introduce the "Phase Shift" ability, the level should feature a phase-wall directly in front of the spawn point, with the exact Conduit Plates needed to bypass it laying nearby. 

## 2. Anatomy of a Scenario
Every level in the game consists of three tightly coupled data structures:

1.  **Dimension A (Hex Grid):** Player 1's starting position, hazards, exit node, and collectible Conduit Plates.
2.  **Dimension B (Hex Grid):** Player 2's starting position, hazards, exit node, and collectible Conduit Plates.
3.  **The DNA Matrix (Square Grid):** The initial starting state of the Matrix. 

## 3. The Reverse-Engineering Pipeline
Because the Hex Grid relies on the DNA Matrix, design levels backward.

### Step 1: Define the Bottleneck (The Matrix)
Define the required ability sequence on the DNA Matrix. Map out the exact sequence of Conduit Plate insertions required to shift the power from start to finish.

### Step 2: Distribute the Pieces & The Decoys
Distribute the necessary Conduit Plates across the two Hex Grids. Then, add the noise:
* **Decoy Obstacles:** Place a hazard (e.g., a locked Green Door) on Player 1's board, but ensure the solution (the Green Key ability node) is either impossible to reach on the Matrix or the required conduits don't exist on Player 2's board. This forces Player 2 to tell Player 1 to abandon that route.
* **Inefficient Routes:** Create a long, safe path that costs too much AP, forcing players to figure out how to route the "Phase Shift" ability for a shortcut.

### Step 3: Build the Hex Grids
Construct the physical layout of Dimension A and B, placing the avatars, hazards, and items.

## 4. Advanced Mechanics: The Threshold — cut (SPRINT_026)
The Threshold (a one-way board-flip mid-level, described below for historical/design-record purposes only) was formally removed from the project in SPRINT_026 — see `decisions_needed.md` D15 and `architecture.md §5.2`. It had been stripped from the shipped campaign since SPRINT_013 and was a functionless engine stub even before that (trigger detection worked; the flip itself was never implemented beyond a debug log). No level uses it and none is planned to.

<details>
<summary>Original design text (historical)</summary>

In the "Spatial Complexity" phase of the campaign, levels were to be expanded using the **Threshold Mechanic**: a synchronized, one-way journey to a new set of dimensional layouts.

### 4.1 The Trigger
Both players must navigate their avatars to specific "Threshold Hexes" and both confirm ready while standing on them. Since there is no going back, both players must verbally agree to initiate the jump.

### 4.2 The Execution
* **Physical:** Players flip their hidden Hex Grids to the reverse side (or swap out the board). 
* **Matrix Persistence:** The DNA Matrix is **NOT** reset. The abilities currently routed remain active.
* **No Return:** The Threshold hexes on the new boards are inactive. Players cannot return to the previous layout.

### 4.3 Asymmetric Foresight
To survive the Threshold, players must prepare the DNA Matrix *before* jumping.
* The pre-Threshold boards contain fragmented, asymmetric clues about what awaits on the other side. 
* *Example:* Player 1's board features a permanent, visual warning icon for "Fire Hazards" near the Threshold hex. Player 2's board does not, but Player 2 has access to the "Fire Immunity" Conduit Plates. Player 1 must warn Player 2 to route the Fire Immunity ability on the shared Matrix *before* they agree to flip the boards, otherwise they will instantly fail upon arriving in the new dimension.

</details>

## 5. Difficulty Progression (The Campaign)

### The 15-Level MVP Campaign (hand-crafted narrative spine)

| # | Name | Key mechanic introduced |
|---|------|------------------------|
| 1 | Tutorial: Movement | Basic hex movement, sequential exit (extended by the guided tutorial script, see `tutorial_design.md`) |
| 2 | Locked Door | Matrix insertion, UNLOCK_RED |
| 3 | Column Shift | Insert order matters — shifting breaks paths; JUMP bypasses the chasm (clean, undisguised) |
| 4 | Scrap Pool | Blind draw as risk/reward; the locked door and its UNLOCK_RED node are a decoy — JUMP (already learned in level 3) bypasses the still-locked door entirely |
| 5 | Shared Routing | Both conduit columns, T-junction coordination |
| 6 | Insert Sequence | Two locks, insert ordering. *(Neuro-Resonance was long planned for this slot; it's now built (SPRINT_026) but demonstrated at level 26 instead, not retrofitted here — see `mechanic_roadmap.md` F1.)* |
| 7 | T-Junction Coordination | col4 routing + Tier 2 abilities |
| 8 | Red Herring | Impossible route — teaches constraint reading |
| 9 | Forced Rotation | Rotate (1 AP) beats insert (2 AP) |
| 10 | Tight Budget | Low AP slack: `initialAP − optimalCost ≤ 2` (formal definition, see §6.3) |
| 11 | Convergence | Fire Immunity now genuinely required (SPRINT_019 redesign: proper wall funnel added, matching `mechanic_roadmap.md` F4's fix) — Threshold-era name retained, but Threshold itself was stripped in SPRINT_013 (`mechanic_roadmap.md` F2) |
| 12 | Leap of Faith | JUMP over chasms in both dimensions (renamed from "Pre-Flip Jump" in SPRINT_013; no Threshold dependency remains) |
| 13 | Critical Rotation | Rotate the pre-placed conduits correctly — no board-flip context remains, just precision routing |
| 14 | Low Reserves | Offset start/exit positions; tight AP, both RED and BLUE required (renamed from "Threshold at Low AP" in SPRINT_013) |
| 15 | Master Set Teaser | Cross (+) conduit in Scrap Pool is the only solution |
| 16 | Airlock | Shared mutation as a trap: the second insert kills RED and enables BLUE at once — anyone still behind their red door is locked out (re-lock commitment) |
| 17 | Signal Chain | Three-stage dependency: RED → plate hidden ON the red door → push-chain enables BLUE → plate ON the blue door → tier-2 Fire Immunity → fire gates |
| 18 | Ghost Step | *(new, SPRINT_019)* Clean, undisguised PHASE_SHIFT introduction — teaches that Tier-2 abilities need power routed through **both** conduit columns (col2 AND col4), a lesson no earlier level covers |
| 19 | Phased Rendezvous | Inverted economy: the Shared Unlock nodes sit UNDER phase barriers — the AP relief must be earned by routing tier-2 Phase Shift on a tight budget; lasers as lethal walls |
| 20 | Dead Column | Column 2 starts full but dead; rotation is the decoy — the solution is ejection-as-transport through a deterministic single-plate Scrap Pool; Unlock Blue sits in tier 2 |
| 21 | Synapse Toggle | Static Splitter spine: bottom insert = RED mode (sacrifices JUMP), top insert with the drawn-back plate = JUMP mode; the sequential-exit rule forces the toggle-back; both Shared Unlocks mathematically required |
| 22 | Clot | *(new, SPRINT_019)* First genuinely required use of PUSH — an Impulse Block (`mechanic_roadmap.md` #2) sits on the sole path; the only way past is approaching from the correct side and shoving it into a purpose-built alcove. Proven required by the solver's Push model (`generation/LevelSolver.ts`), not just by level geometry |
| 23 | Second Thoughts | *(new, SPRINT_019)* Introduces the Focus Vault (`mechanic_roadmap.md` #8) — an optional joint AP-spend that opens a bonus Master Set plate. The level's *required* solution never depends on it; the solver has no awareness of the mechanic at all, by design |
| 24 | Crossed Wires | *(new, SPRINT_024)* Introduces Role Asymmetry (`decisions_needed.md` D14) — a JUMP node restricted to P1 and an UNLOCK_RED node restricted to P2, each powered by the *other* player's own held plate. Neither player can solve their own obstacle by routing alone |
| 25 | Thin Place | *(new, SPRINT_025)* Introduces Echo Tiles (`mechanic_roadmap.md` #3) — a clean RED-door puzzle with one Echo Tile directly on P1's path; standing on it briefly reveals P2's board layout. Wholly optional and cosmetic — the solver has no awareness of the entity type at all |
| 26 | First Spark | *(new, SPRINT_026)* Introduces Neuro-Resonance (`mechanics.md §4.5`) — a RED-door puzzle (level-2 shape) where the one required Insert also forms an EX→IN base pair with a pre-placed plate, Discharging +1 AP the level's budget is built to need. Clean and undisguised: the same insert that powers the door is the only insert in the level |

### MVP Scope (Levels 1–26)
* **Levels 1–5 (The Basics):** Teach movement, the sequential exit win condition, basic Matrix routing, and the strict communication rules. Each level introduces exactly one new mechanic in isolation with obvious conduit placement. Exception: level 4 gives JUMP a single early decoy (a locked door that looks like it needs UNLOCK_RED but doesn't) — deliberately placed *after* level 3's clean, undisguised JUMP lesson, so it reads as "trust what you just learned" rather than as the first taste of the mechanic. Full red-herring design (`level_design.md §1`) proper starts at level 6.
* **Levels 6–10 (The Shift):** Introduce the 2 AP Insert cost, forcing AP budget discipline. Introduce red herrings, decoy locks, and the Scrap Pool as a resource. First tight AP budgets.
* **Levels 11–15 (post-Threshold-removal, as shipped):** This block was originally designed around the Threshold board-flip; SPRINT_013 stripped Threshold from the engine entirely ("no dead mechanics on the board" — it was a functionless stub) and renamed the affected levels. Level 11's Fire Immunity lesson was under-delivering (`mechanic_roadmap.md` F4) until SPRINT_019 gave it a proper wall funnel; 12–15 stand on their own without any Threshold dependency (a JUMP level, a Rotate-precision level, a tight-AP level, and the Master Set/Scrap Pool capstone). Threshold itself was formally cut in SPRINT_026 (`decisions_needed.md` D15) — the spec and its code (`ThresholdSystem` et al.) are both gone now, not just unassigned.
* **Levels 16–21 (Unconventional Combinations):** Known mechanics recombined against expectation — abilities that must be *sacrificed* and re-earned (mode toggling), plates hidden on door hexes, unlock nodes behind the very ability they would fund, pre-filled dead columns where ejection is the transport mechanism, jump-proof geometry, and (level 18, added in SPRINT_019 to close a teaching gap `mechanic_roadmap.md` F4 flagged) the campaign's first Tier-2 ability taught cleanly on its own. Interaction demand rises: level 21 is the first with two mathematically required Shared Unlocks.
* **Levels 22–23 (New Mechanics, SPRINT_019):** The first two proposals from `mechanic_roadmap.md` Part 2 — chosen as the lowest-risk pair (both purely additive to the existing solver/proof pipeline; see the roadmap's closing recommendation). Level 22 activates Push for the first time anywhere in the campaign (previously fully dormant — see `mechanic_roadmap.md` F3); level 23 introduces the game's first wholly optional mechanic.
* **Level 24 (Role Asymmetry, SPRINT_024):** Resolves `decisions_needed.md` D14 in scoped form — ability nodes can now be marked as benefiting only one player. Level 24 is the first to demonstrate it, and does so at maximum clarity: each player's own held plate powers the *other* player's ability node.
* **Level 25 (Echo Tiles, SPRINT_025):** The third `mechanic_roadmap.md` Part 2 proposal shipped — a purely optional, cosmetic reveal of the far board's layout, reusing the existing local-testing `revealBothDims` rendering flag rather than any new UI.
* **Level 26 (Neuro-Resonance, SPRINT_026):** D15's resolution (`decisions_needed.md`) — Neuro-Resonance built at last, scoped down like D14 was: `Conduit.base` defaults to NONE, so every earlier level is unaffected. "First Spark" demonstrates the simplest case, Discharge (+1 AP), as a single insert that's both load-bearing for routing and for the resonance pair.

### Post-MVP (Deferred — Levels 27–40)
* **Levels 27–31 (Spatial Complexity):** Larger hex grids. Navigation to conduits requires long-horizon AP planning across multiple Shared Unlocks. Remaining `mechanic_roadmap.md` proposals (Synaptic Fatigue, Pulse Gates, Scar Tissue, Bruised Fragments, Short Circuit, Static Field, Convergence Nodes) are candidates for this range, pending team selection. Neuro-Resonance's other three effects (Dampening, Anchor, Clarity) are still undemonstrated in the campaign — good candidates here too. **Two concrete concepts from Till (2026-07-23), both buildable with existing mechanics, no new engine work needed:** (1) a maze-like level reachable only via 3–4 well-placed Shared Unlock AP refills scattered through it, combined with other mechanisms already in play; (2) levels with multiple viable-looking routes to a floor `Collectible` (any bonus — AP, an ability plate, a key) where only one route's move-count actually fits the AP budget — exactly what the solver's `optimal`/`slack` columns already score per level, just not yet deliberately designed *around* as the puzzle's centerpiece.
* **Levels 32–40+ (The Deep Subconscious):** Asymmetric foresight clues become subtle and indirect. End-game puzzles designed for experienced cooperative pairs.

## 6. Generative Levels (The Deep Coma)

> **Status (SPRINT_023 audit):** this whole section describes an unbuilt feature — see `generative_levels.md`'s own status note. §6.1's contract (points 1, 3, 4) is already true in spirit for the hand-crafted campaign, since `validate:levels` enforces the same solver/fairness/difficulty discipline; §6.2's Deep Coma and Daily Synapse modes don't exist.

Beyond the hand-crafted campaign, levels are **procedurally generated with a mathematical solvability guarantee**. The full technical specification lives in `generative_levels.md`; this section defines the design contract.

### 6.1 The Contract
1. **Every shipped or generated level is provably solvable.** A level only reaches players if the solver (`generative_levels.md §2`) has found a complete solution path from the initial state.
2. **`initialAP` is derived, not guessed:** `initialAP = optimalCost + margin`, where `optimalCost` is the solver's minimal AP expenditure and `margin` shrinks as difficulty rises. This resolves decision D3 (option C) — every level is designed backward from its solution.
3. **Difficulty is a computed score, not a feeling.** The difficulty model (`generative_levels.md §4`) scores solution length, coordination steps, AP slack, and hidden-information load. Generated levels target a monotonically increasing difficulty curve.
4. **Determinism:** A level is fully determined by its seed. Both clients generate the identical level from the seed exchanged in the network handshake — no level data crosses the wire.

### 6.2 Where Generated Levels Appear
* **The Deep Coma (endless mode):** After Level 15, players descend an unbounded sequence of generated levels with strictly increasing target difficulty.
* **Daily Synapse:** One shared daily seed — all player pairs worldwide face the same generated level.
* **Validation of hand-crafted levels:** The same solver verifies Levels 1–15 (solvability proof, optimal cost, Dead-End distance) at build time. The generator and the campaign share one source of truth for what "solvable" means.

### 6.3 Formal Definition: Tight Budget
A level is a *tight budget* level when `apSlack = initialAP + Σ(unlockValues) + Σ(achievableDischarges) − optimalCost ≤ 2`. The campaign uses this as a tuning dial: tutorial levels run at slack ≥ 6, mid-campaign at 3–5, "tight" levels at ≤ 2.

> **🔢 Balance flag (Chris):** The margin curve (slack as a function of target difficulty) and the difficulty weight vector in `generative_levels.md §4` are the two knobs that need mathematical review before the generator ships.