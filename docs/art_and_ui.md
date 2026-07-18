# Art & UI Concept: The Medical Macabre Diorama

## 1. Overarching Visual Vision
The visual identity of *Synaptic Coma* merges **Tactile Diorama** (Approach 3) with **Dark Diagnostic** (Approach 2). The game should not feel like a clean, scientific simulation; it should feel like you are playing a heavy, antique board game in the dimly lit basement of an abandoned hospital. 

* **The Lighting (The Coma):** The screen is dominated by deep, oppressive shadows (heavy vignetting). The play areas are illuminated by harsh, flickering overhead spotlights, leaving the edges of the screen in pure blackness to represent the encroaching void of the coma.
* **The Tactility:** Everything on screen must look physically heavy. We rely on high-fidelity ambient occlusion (drop shadows) to make tiles look thick and chunky.
* **Language-Agnostic Etching:** Because there is no text, all ability icons and shapes are physically "etched," "branded," or "embossed" into the physical materials, rather than just painted on flatly.

## 2. Dimension A: The Id (Player 1)
The Id represents the primal, terrified subconscious. It feels organic, visceral, and wounded.

* **The Playmat (Hex Grid):** Looks like a thick mat of dark, bruised velvet or stitched, aged leather. Faint, erratic heat-map stains (like an fMRI scan) pulse slowly beneath the texture in deep purples and sickly crimson.
* **The Avatars & Entities:** The pieces are carved from jagged obsidian, coagulated resin, or yellowed bone. They look heavy and asymmetrical. 
* **The Hazards:** * *Repressed Fears (Lethal):* Shards of broken, blackened glass embedded in the board.
    * *Locked Doors:* Visceral, fleshy sphincters or walls of braided thorns.
* **Lighting:** Dominated by deep, shadowy reds and bruised purples.

## 3. Dimension B: The Superego (Player 2)
The Superego represents the rigid, dying logic of the brain. It feels cold, clinical, and mechanical, but suffering from severe decay and neglect.

* **The Playmat (Hex Grid):** A heavy slab of frosted glass or scratched surgical steel. Underneath the glass, faint, rigid X-ray grids and flatlining ECG traces flicker weakly in pale cyan.
* **The Avatars & Entities:** The pieces are made of heavy, tarnished surgical steel, brushed aluminum, and cracked ceramic. They are perfectly geometric, but visibly worn, rusted, or chipped.
* **The Hazards:** * *Firewall Lasers (Lethal):* Sputtering, dangerous electrical arcs between two rusted iron nodes.
    * *Locked Doors:* Heavy, rusted vault doors or intricate, jammed puzzle-locks.
* **Lighting:** Harsh, fluorescent hospital white mixed with cold, icy blues. The lighting occasionally flickers or buzzes.

## 4. The DNA Matrix: The Specimen Tray
The shared DNA Matrix sits between the two players (or in the corner of their UI) and serves as the tactile centerpiece of the game.

* **The Housing:** The matrix grid is not a flat UI element; it is rendered as a deep, recessed wooden or rusted-metal "Specimen Tray," lined with faded velvet. 
* **The Conduit Plates:** These are the most tactile objects in the game. They look like thick, heavy squares of **Bakelite** (vintage, heavy plastic) or clouded glass. 
* **The Routing Pipes:** The pipes etched into the conduits are deep grooves. When a path is successfully connected and powered, the grooves fill with a glowing, viscous fluid (representing spinal fluid or nerve energy) that physically flows from the source node to the ability node.
* **The Mechanics:** When a player slides a conduit into the column, it should visually "clack" into place, shoving the other heavy tiles down the track with a satisfying, physical friction. 

> **Shared Unlock Node Visual:** When both players reach their respective Shared Unlock nodes simultaneously, the node glows with a distinct pulse that differs from a standard ability activation — both nodes light in sync, a luminous thread traces between them through the Matrix, and the AP vials respond with the surge animation described above.

## 5. UI and HUD: Diegetic Integration
To maintain the dark, immersive atmosphere, standard video game UI elements are replaced with physical, diegetic (in-world) counterparts.

* **The AP Pool:** Instead of floating UI dots, the AP pool is represented by a row of thick, glass medical vials filled with glowing adrenaline.

  **AP State Changes:**
  - *Spending AP:* The fluid drains with a heavy bubbling animation. The drain is proportional to the AP spent.
  - *Gaining AP (Shared Unlock):* The vials do not "refill" — they surge. A strong visual pulse emanates from both players' positions simultaneously, and a glowing connection effect bridges the two dimensions through the DNA Matrix. The AP increase animates as luminous fluid flooding into the vials from below, not from a reset.
  - *Dead End (AP = 0, no unlocks remain):* The entire UI dims slightly. The vials sit empty. A subtle "no progress" indicator appears — a single faint icon, no text. The board does not flash or alarm. The silence communicates the state.

  **Anti-patterns (never implement):**
  - ❌ Automatic AP refill on any timer
  - ❌ Periodic regeneration
  - ❌ Any animation suggesting a "round reset" — the vials never violently refill as in a round-based system
* **The Scrap Pool:** Represented by a tarnished steel medical tray in deep shadow. You can see the thick conduit tiles piled face-down in the gloom.
* **The Inventory:** A personal wooden rack sitting just at the edge of the spotlight. When an avatar collects a `???` conduit on the board, a physical tile slides into the wooden rack, flipping face-up to reveal its shape.
* **Active Abilities:** When an ability is powered by the Matrix, a heavy brass indicator light next to the avatar's portrait mechanically snaps "ON," casting a warm, analogue glow.

## 6. The Threshold (Board Flip Animation)
When the players trigger the Threshold to move deeper into the coma:
1. The overhead "spotlight" snaps off, plunging the screen into total darkness.
2. A sound like a massive, heavy slab of stone turning over grinds through the audio.
3. The spotlight snaps back on with a loud electrical *BZZT*, revealing the completely new, flipped hex grid, with dust particles settling in the light shaft above the board.