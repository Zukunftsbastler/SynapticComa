# Narrative & Thematic Integration: The Synaptic Coma

## 1. The Core Premise
The game takes place entirely within the fractured mind of a patient trapped in a deep, medically inexplicable coma. The players do not control traditional human characters; instead, they play as "Consciousness Fragments"—sparks of the patient's identity trying to navigate the damaged neural architecture to wake the host.

## 2. The Dimensional Asymmetry
The human brain is divided, and the coma has violently separated the patient's psyche into two isolated realities. This psychological split justifies the physical "Dimensional Screen" separating the players.

### Dimension A: The Id (Player 1)
* **The Theme:** The primal, emotional, and subconscious mind. It is chaotic, organic, and driven by instinct.
* **Visual Identity:** Deep purples, fleshy pinks, pulsing reds, and dark shadows.
* **Hex Grid Environment:** The board looks like living tissue, brain matter, and tangled veins.
* **Hazards:** Acidic enzymes (water hazards), grasping synapses (locked doors), and repressed fears (static or moving obstacles).

**Gameplay role (see decisions_needed.md D14):** the Id is the *gatherer* — impulses (conduit plates) surface in its flesh; it feels where resources lie. Its tasks should always answer: "only raw instinct could reach this."

### Dimension B: The Superego (Player 2)
* **The Theme:** The critical, moral, and logical mind. It is rigid, mechanical, and driven by rules.
* **Visual Identity:** Cold blues, sterile whites, metallic silvers, and sharp neon lines.
* **Hex Grid Environment:** The board looks like a pristine, clinical laboratory crossed with a supercomputer's motherboard.
* **Hazards:** Firewall lasers (barriers), logic gates (locked doors), and automated security protocols (static or moving obstacles).

**Gameplay role (see decisions_needed.md D14):** the Superego is the *orderer* — it imposes structure on what the Id unearths. Its tasks should always answer: "only discipline could arrange this."

## 3. The DNA Matrix: The Neural Pathways
The shared square board in the center of the table represents the patient's core neural pathways—the only place where the Id and the Superego still connect.
* **Conduit Plates:** These are physical "Synapses" or "Neural Links."
* **Routing Power:** By sliding the synapses into place, the players are literally firing neurons, sending bursts of cognitive energy to the isolated fragments in the hemispheres.
* **The Abilities:** When a connection is made, a "Thought" is completed. For example, connecting a path to the "Phase Shift" icon represents the brain temporarily remembering how to be intangible or abstract, applying that rule to the avatars on the hex grid.
* **The Bases (Neuro-Resonance):** Each synapse plate carries a neurotransmitter glyph — Glutamate, GABA, Dopamine, Serotonin. When two plates stack in the right order, the chemistry *fires*: a correct excitatory-over-inhibitory stack releases a surge of energy (AP), a stabilizing stack steadies the next action. The mind rewards well-formed chemistry — this is the thematic ground for the ordered base pairing in `mechanics.md §4.5`.

## 4. The Threshold: Trauma Landmarks — cut (SPRINT_026)

The Threshold mechanic was formally removed from the project in SPRINT_026 (`decisions_needed.md` D15). No board-flip narrative beat exists to illustrate anymore — don't generate "Trauma Landmark" or board-flip artwork. Kept below for historical/design-record purposes only.

<details>
<summary>Original design text (historical)</summary>

The mid-game board flips (The Threshold mechanic) represent diving deeper into the patient's subconscious. To progress, the fragments must push past "Trauma Landmarks"—core memories that caused the coma. Crossing a Threshold is a violent mental shift, instantly rewriting the landscape of both the Id and the Superego, which is why the Hex Grids must physically flip to the next phase of the puzzle.

</details>

## 5. Narrative Delivery: Static Silent Cutscenes

> **Status (SPRINT_023 audit, `docs/roadmap.md` §0):** this section is a complete design specification — no code implements it yet. There is no panel-display system, no cutscene player, and `public/cutscenes/` is empty. `decisions_needed.md` D13 already decided *which* levels get panels (1, 3, 5, 8, 11, 15) — the design question is answered; only the implementation and the actual artwork are outstanding.

The game's story is delivered through **language-agnostic static illustration panels** — no text, no voice, no subtitles. This preserves the language-agnostic design principle at the narrative layer.

### 5.1 The Opening Sequence (Before Level 1)
Before the first level loads, three full-screen illustration panels play in sequence:
1. **Panel 1 — The Flatline:** A hospital bed in darkness. A monitor showing a flatline. Clinical, cold, silent.
2. **Panel 2 — The Split:** A human brain, cracking down the center. Two voids open on either side — one warm and purple, one cold and blue.
3. **Panel 3 — The Wisps:** Two small points of light awakening in their separate dark voids. Player 1's wisp (a chaotic, glowing orb) in the purple Id. Player 2's wisp (a geometric, structured spark) in the cold Superego.

Players tap/click to advance panels. No button labels. The arrow icon is universal.

### 5.2 Between-Level Narrative Beats
After completing specific levels, a single narrative panel appears (not every level). These panels show fragments of the patient's memories surfacing — a child's toy, a broken relationship, a moment of trauma — rendered as surrealist imagery bleeding between the two dimensions. The sequence of panels across the original 15-level MVP forms a complete arc: coma onset → neural reactivation → confrontation with trauma → emergence. *(The campaign has since grown to 23 levels, SPRINT_017/020 — the panel schedule was never revisited for 16–23; a future pass should decide whether the arc extends or the epilogue simply lands earlier than the credits.)*

### 5.2b The Monitor (The One Voice Outside the Mind)

The single exception to the wordless world is **The Monitor** — the hospital's bedside machine observing the coma from outside. Its clinical, typed CRT annotations frame the story ("SUBJECT: COMATOSE. DAY 214. INITIATING DEEP STIMULATION.") and carry the entire tutorial layer (`tutorial_design.md`). The rule: *the mind is wordless; the machine watching it is not.* Game pieces and boards never show text; the Monitor overlay may.

### 5.2c The Body: A Meta-Progression Layer (Concept, 2026-07-23)

> **Status: concept only, not reviewed, nothing implemented.** Full proposal in `docs/body_awakening.md` — a body-silhouette meta-screen where the patient's regions gradually "wake up," scaled to a planned 100-level campaign (~13 regions, dense guaranteed story beats across levels 1–10), delivered as silent illustrated panels (Monitor text exception for clinical dialogue, same rule as §5.2b) plus a third "clinical reality" visual palette distinct from both dimensions. A single late-game soft fork (Id/motor vs. Superego/perception track) gates the final Head/Consciousness milestone. Proposed as `decisions_needed.md` D16.

### 5.3 The Threshold Transition — cut (SPRINT_026)

The Threshold mechanic was formally removed from the project in SPRINT_026 (`decisions_needed.md` D15). No board-flip transition exists to animate or illustrate. Kept below for historical/design-record purposes only.

<details>
<summary>Original design text (historical)</summary>

Crossing a Threshold triggers a brief full-screen visual event: the two hex grids convulse, a shockwave of light pulses through the DNA Matrix, and the boards slam into their new configurations. No text. The violence of the transition communicates the narrative weight (a Trauma Landmark is being crossed) through pure visual and audio response.

</details>

## 6. Language-Agnostic Translation
Because the game uses no text, the psychological theme must be conveyed entirely through art and icons.
* **Avatars:** Player 1 is a chaotic, glowing wisp. Player 2 is a geometric, structured spark.
* **Keys & Doors:** Instead of literal keys, the game uses matching abstract concepts. A "Key" ability on the Matrix might be an icon of an *Open Eye*, and the "Door" hazard on the Hex Grid is a *Closed Eye* that opens when the neural pathway is routed.
* **Movement Abilities:** A "Jump" ability could be represented by a firing neuron arc spanning across a gap, signaling to the players that their fragment can now leap over empty spaces.