# Design Decisions Record

All open design questions have been resolved. This document records each decision for reference. See the individual doc files for full specification detail.

---

## Q1 — Turn Structure
**Decision: Real-time shared pool with global lockout.**
Both players spend from a single AP pool simultaneously, in any order, via verbal coordination. The round ends automatically when AP hits 0, or when a player declares a Pass (0 AP). AP resets at round start. → `mechanics.md §2`, `architecture.md`

## Q2 — AP Cost Table
**Decision: Strict costs; abilities are free to use once routed.**

| Action | Cost |
|--------|------|
| Move (1 hex) | 1 AP |
| Collect conduit | 0 AP |
| Use routed ability (Jump, Phase Shift, etc.) | 0 AP |
| Insert conduit (column slide) | **2 AP** |
| Rotate inserted conduit | 1 AP |
| Orient conduit before insertion | 0 AP |
| Draw from Scrap Pool (blind) | 1 AP |
| Pass | 0 AP |

→ `mechanics.md §2`

## Q3 — Ejected Conduit Ownership
**Decision: Shared Scrap Pool, face-down.**
Ejected plates go face-down into a central Scrap Pool. Either player may draw one plate blind for 1 AP. Neither player may describe pool contents. → `mechanics.md §4.3`, `communication_rules.md §4`

## Q4 — Failure Conditions
**Decision: Lethal hazards + permadeath with single retry.**
Stepping on a Lethal entity without matching Resistance destroys the avatar. First failure: instant level reload. Second failure: Neural Collapse screen → Level Select. Soft-lock detection triggers manual restart option without consuming the retry. → `mechanics.md §7`

## Q5 — Ability Exact Rules
**Decision:**
- **Jump (Tier 1):** 0 extra AP. Move up to 2 hexes in a straight line, bypassing 1 intermediate hex. Must land on safe, empty hex.
- **Push (Tier 1):** 0 extra AP. Pushes one adjacent Pushable entity 1 hex forward. Avatar does **not** move.
- **Phase Shift (Tier 2):** Persistent passive. Phase Barrier entities become traversable while routing is active.
- **Unlock (Tier 1):** Persistent passive. Matching locked doors lose `Static` while routed. Instantly re-lock when path severs.
- **Fire Immunity (Tier 2):** Persistent passive. Fire Hazard entities do not trigger Lethal on contact.
→ `mechanics.md §5`

## Q6 — Conduit Visibility on Hex Grid
**Decision: Hidden until collected.**
Conduit entities render as a generic `???` icon on the hex grid. Shape and orientation are revealed only when the avatar collects them. Players cannot describe uncollected conduit shapes because they genuinely do not know them. → `mechanics.md §3.1`

## Q7 — Screen Layout
**Decision:** Each player sees their own hex grid (full detail) on one side, the shared DNA Matrix on the other. Inventory is private, visible only to the owning player. AP pool displayed identically on both screens. Emoji-only chat strip at the bottom. → `digital_implementation.md §3`

## Q8 — Win Condition
**Decision: Sequential exit.**
P1 must reach and enter their Nexus Hex first. This activates P2's exit. P1 becomes spectator. P2 then exits to win. Matrix state at P1's exit is locked for P2. → `mechanics.md §6`

## Q9 — Narrative Delivery
**Decision: Static silent cutscenes.**
Three illustration panels before Level 1 (flatline → brain split → wisps awakening). Between-level panels for narrative beats. Threshold triggers a visual shockwave event. No text at any point. → `narrative.md §5`

## Q10 — Matrix Row Count
**Decision: Confirmed 5 rows, constant across all levels.** → `mechanics.md §4`

## Q11 — Conduit Shapes
**Decision: Trinity + Trinity+.**
Standard set (all rotatable): Straight, Curved, T-Junction. Master set (static, non-rotatable, Level 10+): Cross (+), Splitter (Y). → `mechanics.md §4.4`

## Q12 — Save / Resume
**Decision: Completion-only save.**
`localStorage` saves only which levels are unlocked. No mid-level state serialization in MVP. → `digital_implementation.md`

## Q13 — Campaign MVP Scope
**Decision: 15 levels in MVP.**
Threshold introduced at Level 11 (not deferred). Levels 1–15 form the complete MVP campaign. Levels 16–40 deferred post-MVP. → `level_design.md §5`

## Q14 — Multiplayer Scope
**Decision: Private lobby via room code + emoji-only chat.**
No voice. No free text. PeerJS room code shared out-of-band (copy-paste/voice). In-game chat is an emoji picker only — no text input. Chat has no gameplay effect. → `digital_implementation.md §5.3`
