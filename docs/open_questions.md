# Open Questions — Specifications Needed Before Implementation

This document lists every ambiguity, contradiction, or missing specification found across all design documents. Nothing here is decided. For each item, several propositions are offered — the final choice is yours.

Items are ordered by implementation priority: the top sections block early sprints, the lower sections can wait.

---

## CRITICAL — Blocks Sprint 4 (Movement) and Sprint 6 (Matrix Insert)

---

### 1. Turn Structure: How is a "round" defined?

The docs say "players share a pool of Action Points each round," but never define when a round ends, who goes when, or how AP resets.

**Why this matters:** The entire game loop, networking model, and AP deduction logic depends on this. A real-time model and a turn-based model require fundamentally different implementations.

**Propositions:**

**A — Real-time, shared pool.**
Both players spend from the same AP pool simultaneously and freely, in any order, until it hits 0. The round ends automatically when the pool is empty. Neither player "takes a turn" — they talk and spend as they please. AP resets at the start of the next round. This is the most fluid and cooperative-feeling approach. Risk: both players might try to spend the last AP at the same moment (requires tie-breaking logic).

**B — Turn-based, alternating.**
Player 1 spends 1 AP (one action), then Player 2 spends 1 AP, and so on, alternating until the pool is empty. Cleaner sequencing, easier to implement deterministically, more similar to traditional board games. Risk: feels slower and less organic for a cooperative game.

**C — Turn-based, full hand.**
Player 1 spends all their AP in sequence (e.g., 2 AP worth of actions), then Player 2 spends theirs. Each player has a private sub-pool drawn from the shared total. Risk: one player can "hoard" AP and leave the other with none, partially recreating the Alpha Player problem the communication rules are designed to prevent.

**D — Simultaneous declaration.**
Both players secretly plan their actions for the round, then both reveal and execute simultaneously (like Diplomacy). High tension, reinforces the "silent execution" rule thematically. Risk: complex conflict resolution when both actions affect the same tile; requires a planning phase UI.

---

### 2. AP: Complete cost table

Only three costs are documented. Everything else is undefined, which breaks level design from the start.

**Actions requiring a decision:**

#### 2a. Using an unlocked ability (Jump, Push, Phase Shift)
Once an ability is routed on the Matrix, does activating it cost AP, or is it free?

- **Option 1: Free.** Routing the ability is the cost. Once connected, the avatar uses it automatically (e.g., jumping over a chasm costs the same 1 AP as normal movement, because the jump IS the movement).
- **Option 2: Extra cost.** Routing gives access; using the ability costs 1 AP on top of normal movement cost.
- **Option 3: Replaces movement.** The ability replaces the 1 AP move — no extra cost, but the movement AP is spent.

#### 2b. Conduit rotation (choosing orientation before inserting)
Does rotating a conduit plate before insertion cost AP?

- **Option 1: Free.** Rotation is a decision step, not an action. Only the insertion itself costs AP.
- **Option 2: Each rotation costs 1 AP.** Adds strategic weight to plate orientation choices.

#### 2c. End-of-round (passing)
Can a player voluntarily end the round before all AP is spent (e.g., if no useful action is available)?

- **Option 1: No.** AP must be fully spent or the round never ends (forces players to always act).
- **Option 2: Yes, any player can trigger end-of-round.** The remaining AP is wasted.
- **Option 3: Yes, but both players must agree to end early.** Requires verbal coordination.

---

### 3. Ejected Conduit Ownership (explicitly flagged as unresolved in `communication_rules.md`)

When a conduit plate is pushed out of the Matrix by a column insertion, where does it go?

**Why this matters:** This is a balance and design question that was left intentionally open in the docs. It affects whether plates are a renewable or finite resource, which reshapes every puzzle. It also affects whether the communication rules are violated (if the other player gets your plate, they now hold one of your former pieces).

**Propositions:**

**A — Shared Scrap Pool (face-down).**
Ejected plates go into a communal pile, face-down. Either player can take a plate from the pool on their turn (costs 1 AP? or free?). Neither player knows what shape is in the pool until they take it. Reinforces the "silent execution" rule and adds a tactile draw mechanic.

**B — Shared Scrap Pool (face-up).**
Same as A, but the shapes are visible. Players can strategize about which plate to grab next. Slightly loosens information asymmetry.

**C — Returns to inserting player's inventory.**
The plate comes back to whoever inserted it. Simple. Encourages careful plate management. Risk: creates infinite loops where a player repeatedly inserts and retrieves the same plate.

**D — Returns to the column's "owner" (P1 owns column top, P2 owns bottom).**
If a plate was pushed from the top, it returns to P1. If from the bottom, to P2. Creates a directional economy. Complex to explain but thematically interesting.

**E — Permanently removed from the level.**
Ejected plates are discarded and cannot be recovered. Plates become a finite, precious resource. Makes every insertion an irreversible commitment. Hardest difficulty setting.

---

### 4. Failure Conditions

There are zero documented failure states. The game has no loss condition as currently designed.

**Why this matters:** Without failure, there are no stakes and no meaningful decisions. It also affects UI (a "Level Failed" screen vs. a "Restart" button) and the game loop state machine.

**Propositions:**

**A — No failure; infinite attempts.**
Players can never lose. If they get stuck, they can reset the level at any time. The challenge is purely cognitive — solving the puzzle — not resource management. Lowest frustration, most accessible. Risk: no tension.

**B — Soft failure (soft-lock detection).**
The game detects when no valid moves remain (all AP spent, no conduits available, avatars blocked) and prompts a restart. No explicit "death" — just a detected dead-end. The game restarts only when the players agree.

**C — AP starvation with level restart.**
If a round ends with both avatars unable to reach their exits AND no conduits remain to change the matrix, the level is lost and must be restarted from the beginning. Focuses the tension on resource conservation.

**D — Hazard-triggered failure.**
Stepping onto specific hazards (e.g., chasms, acid) immediately fails the level. Creates a "don't touch the floor" tension on top of the routing puzzle. The Hex Grid becomes spatially dangerous, not just blocked.

**E — Hybrid: hazards + soft-lock.**
Hazards can kill (Option D), but the game also detects soft-locks (Option B). This is probably the most standard game-feel approach.

---

## HIGH PRIORITY — Blocks Sprint 7 (Abilities)

---

### 5. Ability Mechanics: Exact Rules

These abilities are named in the docs but never precisely defined. The `AbilitySystem` cannot be implemented without knowing what each one does.

#### 5a. Jump
- **Does it cost AP?** (see Q2a above)
- **How far?** Jump over exactly 1 hex gap, or any number of gaps?
- **Can it land on hazards?** Or only on passable hexes?
- **Directionality?** Jump in any of the 6 hex directions, or restricted?

**Propositions:**
1. Jump replaces 1 move AP. Jumps over exactly 1 blocked or empty hex. Lands on any passable hex at distance 2.
2. Jump costs 1 extra AP (total 2 for a jumping move). Can jump over 1–2 hexes. More powerful, justifies the higher cost.
3. Jump is a free action that unlocks once per round. Can be used once, then the routing must supply it again next round.

#### 5b. Push
- **What gets pushed?** Movable blocks on the hex grid? Other avatars? Hazard tokens?
- **Who controls the direction?** The pushing player, or always in the avatar's facing direction?

**Propositions:**
1. Push lets the avatar shove one adjacent `Pushable` entity one hex in a straight line. Costs 1 AP. Used to solve block-pushing sub-puzzles on the hex grid (sokoban-style elements).
2. Push lets the avatar displace a hazard token one hex, temporarily unblocking a path. Costs 1 AP.
3. Push is used only on specific "pushable block" entities, never on hazards or avatars. Simple and unambiguous.

#### 5c. Phase Shift
- **What can be passed through?** All walls? Only phase-walls (specific hazard type)?
- **Duration?** One step through a wall, or sustained until the routing is broken?

**Propositions:**
1. Phase Shift allows the avatar to move through exactly 1 `PhaseWall` hazard hex per action. Costs 1 AP. The wall reappears behind them.
2. Phase Shift is a persistent state: while routed, the avatar is intangible to ALL walls. Deactivates when the matrix path is broken.
3. Phase Shift makes the avatar briefly occupy the same hex as a hazard without harm, but they must exit on the next move or the routing holds them in limbo.

#### 5d. Teleport (Tier 2 ability)
- **How does it work?** Distinguishing between the *hex-based teleporter tile* and the *Matrix-routed Teleport ability*.

**Propositions:**
1. The Tier 2 "Teleport" ability allows the avatar to jump to *any* teleporter hex on their board (not just a specific one), enabling cross-grid shortcuts.
2. The Tier 2 "Teleport" ability creates a temporary teleporter on the current hex, usable once. Costs 1 AP.
3. The Tier 2 "Teleport" ability sends the avatar to a predefined "Teleport destination" tile placed by the level designer (different from a teleporter hex, which always swaps dimensions).

---

### 6. Visibility: Can the player see conduit shapes lying on the hex grid?

When a conduit plate is lying uncollected on the Hex Grid, can the player see its shape and orientation?

**Why this matters:** If shapes are visible, the player can describe "I see a T-junction" to their partner, which leaks information that may violate the spirit of the communication rules (players must describe goals and obstacles, not inventory/pieces). If shapes are hidden (face-down), the game preserves strict asymmetry at the cost of some opacity.

**Propositions:**

**A — Fully visible (shape + orientation shown).**
The conduit's icon is visible on the hex. Players can describe what they see. Communication rules prohibit discussing inventory, but floor tiles are part of the environment — describing them is like describing a door. Simple and readable.

**B — Shape visible, orientation hidden.**
The icon shows the *type* (straight/curved/T) but not the rotation. Players know what they'll get but not its initial angle. They can rotate before inserting anyway, so orientation is less important.

**C — Fully hidden (silhouette or face-down).**
Floor conduits appear as generic "piece" icons with no shape information. Players cannot describe the shape. Forces them to communicate purely about goals. Strictest interpretation of the information asymmetry rules.

**D — Visible only after collecting.**
The shape is revealed only after the avatar walks onto the hex and collects it. Brief moment of discovery. Can be telegraphed with a question-mark icon before collection.

---

## MEDIUM PRIORITY — Blocks Sprint 9 (Levels) and Sprint 11 (UI)

---

### 7. Screen Layout (Digital)

No UI wireframe exists. The implementation plan assumes a side-by-side layout, but this is not specified in any design document.

**Key questions:**

**7a. What does each player see on their own screen (networked play)?**

- **Option 1: Own hex grid only + shared matrix.** Each player sees their dimension's hex grid on the left, the DNA Matrix on the right. The other dimension is invisible. Maximum information asymmetry.
- **Option 2: Own hex grid (full) + other dimension (silhouette) + matrix.** Players can see the spatial layout of the other dimension (hazard shapes, grid structure) but not collect or interact with it. Allows spatial reasoning across dimensions.
- **Option 3: Shared split view.** Both hex grids shown (own = full detail, other = fog of war), matrix in the center. Crowded, but gives full spatial awareness.

**7b. Where is the DNA Matrix placed on screen?**

- **Option 1: Center, between both hex grids.** Mirrors physical table layout. Both players approach the matrix "from the sides."
- **Option 2: Bottom panel, spanning full width.** Matrix is prominent below both grids. Easier to read complex routing.
- **Option 3: Right panel (sidebar).** Matrix as a vertical sidebar. Leaves more room for the hex grid.

**7c. Local / same-screen debug mode layout?**
For development and local play (same machine):
- **Option 1: Both hex grids side-by-side, matrix between them.** One player uses keyboard left-side, other uses right-side.
- **Option 2: Stacked vertically (hex A top, matrix middle, hex B bottom).** Better for portrait orientation or narrower screens.

---

### 8. Win Condition: Simultaneous vs. Sequential Exit

"Navigate avatars to designated exit hexes" — but in what sequence?

**Propositions:**

**A — Both must be on exits simultaneously (same tick).**
Both players step on their exits at the exact same moment. Requires tight coordination. High cooperation requirement.

**B — Both must exit within the same round.**
Both avatars reach their exits during the same AP round. They don't have to step on them in the same tick, but both must arrive before the round ends.

**C — Sequential: once P1 exits, P2 must exit.**
Once Player 1 reaches their exit, they "lock in" and wait. Player 2 must now reach theirs. No simultaneous requirement. Less tense but simpler to implement and communicate.

**D — Sequential, any order.**
Either player can exit first and wait. The level completes once the second player exits. Most forgiving.

---

### 9. Narrative Delivery

The game has rich thematic material (Id/Superego, coma, neural pathways) but is language-agnostic. There is no specified system for delivering this story.

**Propositions:**

**A — Environmental storytelling only.**
No cutscenes, no text. The hex grid tiles themselves tell the story through artwork (brain matter in Dimension A, circuitry in Dimension B). Players piece together the narrative from visual context. Pure show-don't-tell.

**B — Between-level illustrations.**
After completing each level, a full-screen illustration (no text) shows a fragment of the patient's memory or a neural "awakening" moment. Each illustration advances the narrative arc across the campaign. The visual sequence is the story.

**C — In-level symbolic events.**
At narrative moments (Threshold, key puzzles), a brief visual event plays — e.g., both hex grids pulse with light, a "memory fragment" symbol floats up from a completed exit. Non-verbal but present in-level.

**D — Optional lore layer (text, hidden).**
A separate menu shows translated "lore entries" — one per level — written as clinical notes from the patient's doctors. These are fully optional, skippable, and text-based. Keeps the gameplay layer language-agnostic while still providing lore for players who want it.

**E — Combination: B + C.**
Silent in-level events for atmosphere plus between-level illustrations for story beats.

---

### 10. Matrix Row Count: Is 5 confirmed?

The implementation plan sets `MATRIX_ROWS = 5` but no design document confirms this number.

The mechanics doc shows: 2 player sources + some ability nodes. The number of usable rows per column constrains how many abilities can exist per tier and how complex routing can get.

**Propositions:**

**A — Fixed at 5 rows across all levels.**
Simple to implement. Limits the number of abilities per tier to 5 (practical max). Easiest to balance.

**B — Fixed at 7 rows.**
More routing possibilities. Allows up to 7 ability nodes per tier. Larger matrix feels more complex but gives designers more flexibility.

**C — Variable per level (defined in JSON).**
Some levels use a 3×5 matrix, others a 5×7. Adds design depth but complicates UI (the matrix panel must resize).

---

### 11. Conduit Shapes: Complete List

The design specifies three shapes: straight, curved, T-junction. Is this the complete set?

**Propositions:**

**A — These three are the complete set.**
Straight (2 openings, opposite), Curved (2 openings, 90°), T-Junction (3 openings). All rotations are derived from these. This is enough to create complex routing puzzles.

**B — Add a Cross shape (4 openings, all directions).**
A plus-sign conduit. Powerful piece that connects everything. Rare in levels, but adds a "wildcard" element.

**C — Add a Dead End shape (1 opening).**
Used as a deliberate blocker or a puzzle piece that forces players to route around it. Introduces negative-space routing puzzles.

**D — A + B + C (4 shapes total).**
Full set: straight, curved, T-junction, cross, dead-end. Most design flexibility.

---

## LOWER PRIORITY — Can be decided during content sprints

---

### 12. Save / Resume

**Decision needed:** Can a mid-level state be saved and resumed, or only full-level completion?

**Propositions:**
1. **Completion-only save.** Progress saves only when a level is completed. Players must finish levels in one session. Simple.
2. **Mid-level checkpoint save.** The game auto-saves after each round. Players can close and resume from the last round. Requires serializing the full ECS world state to `localStorage`.
3. **No save at all.** The entire campaign restarts on each session. Only viable if individual levels are very short (<15 min each).

---

### 13. Campaign: Levels 11–15 (The Shift — content gap)

The design doc defines levels 1–5, 6–15 as a range, 16–30, 31–40. But only levels 1–10 are in the sprint plan. Levels 11–15 exist as a design range but have no authored content.

**Decision needed:** Are levels 11–15 part of the MVP (Sprint 12 scope), or deferred to a post-MVP sprint?

---

### 14. Multiplayer Scope: Strangers or Known Partners?

PeerJS allows anyone to connect via room code. But the communication rules require real verbal coordination (voice or in-person).

**Decision needed:**
1. **Known partners only.** The game is explicitly designed for friends playing together. No matchmaking. Room codes are shared out-of-band (voice, text).
2. **Built-in voice chat.** Integrate WebRTC audio (possible via PeerJS) so strangers can play together without external tools.
3. **Built-in text chat (restricted).** A chat panel that enforces the communication rules — only certain message types (goals, obstacle descriptions) are allowed; free-text describing inventory is blocked by the UI.

---

## Summary: Decisions Needed Before Each Sprint

| Sprint | Blocking Questions |
|--------|--------------------|
| Sprint 4 (Movement) | Q1 (turn structure), Q2 (AP costs), Q4 (failure conditions) |
| Sprint 6 (Matrix Insert) | Q3 (ejected conduit ownership) |
| Sprint 7 (Abilities) | Q5 (ability mechanics), Q6 (conduit visibility) |
| Sprint 9 (Levels 1–5) | Q5, Q8 (win condition), Q10 (matrix rows), Q11 (conduit shapes) |
| Sprint 11 (UI/HUD) | Q7 (screen layout) |
| Sprint 12 (Campaign) | Q9 (narrative delivery), Q13 (levels 11–15 scope) |
| Post-sprint | Q12 (save/resume), Q14 (multiplayer scope) |
