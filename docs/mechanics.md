# Mechanics: The Dual-Board System

## 1. Core Gameplay Loop
The game is a deterministic logic puzzle distributed across two interconnected boards:
1. **The Hex Grid (The Environment):** Where avatars move, explore, and collect resources.
2. **The DNA Matrix (The Control Panel):** A square grid where players manipulate routing tiles to unlock abilities required to navigate the Hex Grid.

**Turn Structure: Persistent Shared Pool with Cooperative Unlock.**
Players share a single AP pool with no round structure and no automatic reset. Both players may spend from it simultaneously, in any order, via verbal coordination ("I'm taking 2 AP to grab that conduit, okay?"). AP is only gained by triggering a Shared Unlock node — a special location that requires both players to be present simultaneously. The game has no Pass action and no round end. When AP reaches 0 and no Shared Unlock remains available, the system enters a Dead End state.

The ultimate goal is to navigate both avatars to their designated Nexus Hexes (exits) in the correct sequence.

---

## 2. Complete AP Cost Table

| Action | Board | AP Cost | System |
|--------|-------|---------|--------|
| Move (1 hex) | Hex Grid | 1 | `MovementSystem` |
| Collect Conduit (automatic on movement) | Hex Grid | 0 | `CollectionSystem` |
| Use a Routed Ability (e.g. Jump, Phase Shift) | Hex Grid | 0 — treated as a normal Move | `AbilitySystem` + `MovementSystem` |
| Insert Conduit (column slide) | DNA Matrix | **2** | `MatrixInsertSystem` |
| Rotate an already-inserted Conduit | DNA Matrix | 1 | `MatrixRotateSystem` |
| Orient a Conduit before insertion | DNA Matrix | 0 — part of the Insert action | — |
| Draw from the Scrap Pool (blind) | DNA Matrix | 1 | `ScrapPoolSystem` |
| Rotate Source/Ability nodes | DNA Matrix | N/A — impossible, static | — |
| Trigger Shared Unlock (both players on node) | Either | +AP gained | `APUnlockSystem` |
| Open a Focus Vault (both players on node, see §5.7) | Hex Grid | −AP spent (optional, never required) | `FocusVaultSystem` |
| Push an Impulse Block (see §5.2) | Hex Grid | 1 | `PushSystem` |
| Neuro-Resonance (specified, not yet implemented — see §4.5) | DNA Matrix | 0 — passive; may grant AP or discounts | *(none yet)* |

**Key rule:** AP is a finite resource that shrinks with use and only grows through cooperation. Shared Unlock nodes are the sole mechanism for gaining AP. When AP reaches 0, the game does not reset — it pauses in a Dead End state and allows a manual restart. There is no round, no turn, and no Pass action.

---

## 3. Board 1: The Hex Grid (Exploration)
The Hex Grid is a strictly spatial puzzle. Avatars (wisps) begin here with basic movement only.

* **Movement (1 AP):** Move an avatar to an empty, adjacent hex.
* **Collection (0 AP):** If an avatar moves onto a hex containing a Conduit Plate, it is immediately collected into the player's private hidden inventory. The conduit's shape is **hidden until collected** — it appears on the grid as a generic `???` icon with no shape information.
* **Using Abilities (0 extra AP):** If an ability is currently routed on the DNA Matrix, the avatar may use it as part of their normal 1 AP movement action.
* **Hazards:** The grid features lethal hazards (Repressed Fears, Firewall Lasers, etc.) that instantly destroy the avatar if entered without the appropriate defensive ability routed.

### 3.1 Conduit Visibility Rule
Conduit Plates lying on the hex grid are rendered as a generic, language-agnostic `???` icon. Their shape and orientation are hidden until the avatar walks onto the hex and collects them. This enforces strict information asymmetry: players cannot describe the shape of uncollected conduits because they genuinely do not know it.

---

## 4. Board 2: The DNA Matrix (The Labyrinth)
The DNA Matrix is a fixed **5×5 grid** with five rigid columns and five rows, constant across all levels.

### 4.1 Matrix Architecture

| Column | Role | Content |
|--------|------|---------|
| 1 | Sources | Player avatar nodes (permanent power emitters, one per player, static) |
| 2 | Conduit Layer 1 | Sliding conduit plates routed by players |
| 3 | Tier 1 Abilities | Static ability nodes (Jump, Push, Unlock Red/Blue, etc.) |
| 4 | Conduit Layer 2 | Sliding conduit plates routed by players |
| 5 | Tier 2 Abilities | Static ability nodes (Phase Shift, Fire Immunity, etc.) |

Energy flows strictly **left to right** (Column 1 → 5). Source nodes and ability nodes are static — they cannot be inserted, ejected, or rotated.

### 4.2 Matrix Manipulation

**Insert Conduit (2 AP):** A player takes a Conduit Plate from their private inventory and pushes it into the top or bottom of Column 2 or Column 4. Pushing a plate in shifts the entire column by one space. The plate ejected from the opposite end goes **face-down** into the **Scrap Pool** (see Section 4.3). The player chooses the plate's orientation before inserting at no extra cost.

**Rotate Inserted Conduit (1 AP):** A player may rotate any conduit plate that is **already placed** in Column 2 or Column 4 by 90° clockwise. This does not slide the column; it only changes the orientation of that single plate and immediately re-runs routing.

**Draw from Scrap Pool (1 AP):** Either player may draw one plate from the Scrap Pool. The plate is face-down — the player does not know its shape until they draw it. The drawn plate goes into the drawing player's private inventory.

### 4.3 The Scrap Pool
When a conduit is ejected from a matrix column, it is placed **face-down** in a central shared pile called the Scrap Pool. Neither player knows what shapes are in the pool. The pool is public knowledge as a *count* (e.g., "there are 3 plates in the pool") but private as to *content*. This enforces silent execution: players cannot describe what is in the pool without violating the communication rules.

### 4.4 Conduit Shapes: The Complete Set

**Standard Set (available from Level 1):** All shapes can be freely rotated before insertion or via the Rotate action.

| Shape | Icon Description | Face Mask (bits: E/S/W/N) | Rotations |
|-------|-----------------|---------------------------|-----------|
| Straight | Two openings, opposite sides | `0b0101` (E+W) | 2 effective (0°, 90°) |
| Curved | Two openings, 90° corner | `0b0011` (E+N) | 4 effective |
| T-Junction | Three openings | `0b0111` (E+S+W) | 4 effective |

**Master Set (introduced Level 10+):** These shapes are **static — they cannot be rotated** after insertion.

| Shape | Icon Description | Face Mask | Notes |
|-------|-----------------|-----------|-------|
| Cross (+) | Four openings, all directions | `0b1111` | Powerful wildcard; rare in levels |
| Splitter (Y) | Three openings, asymmetric | `0b1110` (S+W+N) | Acts as a non-standard T-junction |

### 4.5 Neuro-Resonance: Ordered Base Pairing (specified, not yet implemented)

> **Status (SPRINT_019 audit):** this section is a complete design specification — no code implements it yet. `Conduit` has no `base` field, level JSON has no way to set one, and there is no `ResonanceSystem`. Formally deferred rather than silently half-true; see `mechanic_roadmap.md` F1. Build or drop before any campaign row claims it again.

Every Conduit Plate carries, in addition to its pipe shape, a **neurotransmitter glyph** (its "base") etched into one corner. There are four bases, each with a distinct language-agnostic icon and color:

| Base | Theme | Icon |
|------|-------|------|
| `EX` | Glutamate (excitatory) | Outward-radiating spark |
| `IN` | GABA (inhibitory) | Inward-collapsing ring |
| `MOD` | Dopamine (modulating) | Ascending wave |
| `STAB` | Serotonin (stabilizing) | Level horizon line |

**The Pairing Rule (order matters):** Whenever two conduit plates sit **vertically adjacent in the same conduit column** (Column 2 or 4), the ordered pair *(upper base → lower base)* is evaluated. Exactly four ordered pairs are valid — and direction matters, mirroring DNA base pairing (`EX→IN` is not the same as `IN→EX`):

| Ordered Pair (top → bottom) | Resonance | Effect |
|------------------------------|-----------|--------|
| `EX → IN` | **Discharge** | +1 AP surge, credited to the shared pool |
| `IN → EX` | **Dampening** | The next Rotate action costs 0 AP |
| `MOD → STAB` | **Clarity** | The topmost Scrap Pool plate is revealed face-up to both players until the next matrix mutation |
| `STAB → MOD` | **Anchor** | The next Insert action costs 1 AP instead of 2 |

All other combinations produce no effect.

**Trigger rules:**
* A Resonance fires **once, at the moment the pair is formed** by an Insert (column slide) or by loading the level.
* Re-forming the *same* pair between the *same two plates* does not re-trigger it. Breaking the pair (a slide separates the plates or ejects one) re-arms the slot: a **new** pair formed there triggers normally.
* Resonances are evaluated by `ResonanceSystem` after every matrix mutation, before routing effects are applied.
* Rotation never changes a plate's base — the base is a property of the plate, not of its orientation.

**Design intent:** Every Insert is now a **two-layer decision** — it changes the routing topology *and* rewrites the vertical base sequence of the column. Since a slide moves every plate in the column, one action can simultaneously power an ability, break a pair, and form a new one. This is the "shared mutation" principle: no matrix action is ever local.

> **🔢 Balance flag (Chris):** The Discharge (+1 AP) pairing interacts directly with the AP economy (starting AP, Shared Unlock values). The generator/solver must count achievable Discharges as part of the AP budget; hand-authored levels 6–15 need a pass to confirm no unintended AP farming loop exists (Discharge re-arm requires plate ejection, which costs a 2-AP insert — net negative by design, but verify with the solver).

---
**Technical Note:** For details on the ActionManager singleton and the implementation of the persistent AP pool logic, see the cross-reference in architecture.md.

## 5. Ability Rules

Abilities are active only while an unbroken path exists on the DNA Matrix. Severing a path instantly deactivates the ability — mid-traversal consequences are intentional and immediate; there is no undo.

### 5.1 Jump (Icon: Rising Neuron Arc)
**Tier 1.** When active, the avatar may spend 1 AP to move up to **2 hexes in a straight axial line**, bypassing any obstacle or chasm in the intermediate hex. The avatar must land on an empty, safe hex. Jump does not allow landing on hazard hexes.

**Input semantics (decided in SPRINT_010 after playtest):** the 1-hex step is always the default action; it is never replaced by the jump. The 2-hex jump fires only when the player explicitly requests it (clicking a straight-line tile 2 hexes away) or when the 1-hex step in that direction is blocked and the jump can bypass the obstacle. The intermediate hex is bypassed entirely — its content (wall, door, chasm, barrier) is irrelevant; only the landing hex is validated.

### 5.2 Push (Icon: Hex with Arrow)
**Tier 1.** When active, the avatar may spend 1 AP to **push one adjacent Pushable entity** exactly 1 hex in the chosen direction, provided the target hex behind the entity is empty. The **avatar does not move** — the action is a pure push from the avatar's current position. The avatar remains in place; only the pushed entity moves.

**Impulse Blocks** (`mechanic_roadmap.md` #2, first used level 22 "Clot"): the level entity this ability acts on. Rendered as a Repressed Clot (Id board) or Logic Block (Superego board) — a hex that is **solid until shoved**: it blocks passage exactly like a wall (it carries `Static`) whenever Push isn't currently routed, or in any direction other than the one being pushed. A push with a blocked destination (another Static entity, or a Pushable already occupying it) fails silently — the 1 AP is still spent.

### 5.3 Phase Shift (Icon: Ghost / Dotted Silhouette)
**Tier 2.** When active, all **Phase Barrier** hazard entities on the avatar's Hex Grid become traversable. The avatar may move through Phase Barriers for the standard 1 AP movement cost. Phase Shift is a persistent passive state — it remains active as long as the routing path on the Matrix is unbroken. Only the local player's avatar is affected (no cross-dimensional Phase Shift).

### 5.4 Unlock Abilities (Icon: Open Eye over a color symbol)
**Tier 1.** When active, all matching locked doors (`LOCKED_RED`, `LOCKED_BLUE`, etc.) on the avatar's Hex Grid lose their `Static` component and become traversable. If the routing path is severed, the doors **instantly re-lock** — an avatar mid-traversal of a re-locked door is blocked in place.

### 5.5 Fire Immunity (Icon: Flame with Shield)
**Tier 2.** When active, Fire Hazard entities on the avatar's Hex Grid do not destroy the avatar on contact.

### 5.6 Ability Scope Rule
All abilities granted by the Matrix apply **only to the avatar whose player source is connected to the ability node**. If both player sources route to the same ability node, both avatars gain that ability simultaneously.

---

## 6. Win Condition: Sequential Exit

Level completion requires a **two-stage sequential exit**:

1. **Player 1 (The Id) must reach their Nexus Hex first.** Upon entering the exit, Player 1's wisp dissolves. Player 1 transitions to spectator mode — they can observe the DNA Matrix but no longer act.
2. **Player 2's (The Superego) Nexus Hex is now activated** (lit up). Player 2 must navigate to and enter their now-active exit.
3. When Player 2 exits, the level is won.

**Design implication:** Player 1 must fully trust Player 2 to complete their exit without further Matrix support. The Matrix state at the moment Player 1 exits is the Matrix state Player 2 must work with. Players should coordinate the Matrix routing *before* Player 1 commits to their exit.

---

## 7. Failure Condition: Permadeath with Single Retry

The game has a **lethal failure state**:

* If an avatar enters a hex containing a **Lethal** hazard entity (a Repressed Fear, Firewall Laser, etc.) without the corresponding defensive ability routed, the avatar is **instantly destroyed**.
* On the first failure: the screen flashes, a language-agnostic failure icon appears (cracked wisp), and the level reloads immediately.
* On the **second failure**: the "Neural Collapse" screen appears and the players are returned to the Level Select screen. All mid-level progress is discarded.

**Dead End State:** A Dead End is triggered when `APPool.current === 0`, no Shared Unlock nodes remain untriggered, and neither avatar can reach their exit. This is distinct from a soft-lock: in a soft-lock, a solution exists but is unreachable through play; in a Dead End, no solution is reachable with current resources. The system detects the Dead End automatically and displays a language-agnostic "Dead End" indicator, allowing players to manually restart the level without consuming their single retry.

---

## 8. Focus Vault: Optional Cooperative Reward (mechanic_roadmap.md #8)

A Focus Vault is a pair of hex nodes — one per dimension, linked like a Shared Unlock — first used in level 23 ("Second Thoughts"). It **inverts** the Shared Unlock: standing together on both nodes **spends** the pair's cost from the shared pool (rather than granting AP) and, in exchange, spawns a bonus Conduit Plate at a Vault hex elsewhere on the board — visible and collectible from that moment on, exactly like any other floor plate.

**Rules:**
* Firing requires the pool to actually afford the cost; an unaffordable pair simply does not trigger (no partial spend, no debt).
* One-time per pair, like a Shared Unlock.
* **Always optional.** No level's required solution may depend on triggering a Focus Vault — the solver has no model of it at all, by design (`mechanic_roadmap.md` #8): an entity nothing in the required path ever touches cannot affect a solvability proof.
* The spawned plate is a genuine `Collectible` — it can carry any shape, including Master Set shapes, as a curiosity reward.

**Design intent:** every other cooperative act in the game is mandatory. A Focus Vault is the one deliberate, unforced act of trust — spending a scarce shared resource for no reason but curiosity. Narratively, it's the two fragments choosing, together, to dig into a memory neither needs to survive the level.
