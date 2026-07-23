# Decisions Needed — Synaptic Coma

> ## ✅ Resolution Status (updated 2026-07-18, SPRINT_004)
>
> Andreas answered **D1: same game** — his DDG concept is design input for Synaptic Coma, not a separate project. On that basis Till resolved the open items below to unblock development; items carrying a 🔢 flag remain **open for Chris's balance review** (numbers may change, structures will not).
>
> | # | Resolution |
> |---|-----------|
> | D1 | **Same game.** Andreas's core ideas are integrated: ordered base pairing → Neuro-Resonance (`mechanics.md §4.5`); "shared mutation / every action affects everyone" → column slides + resonance re-evaluation; "abilities emerge from structure" → routing + pairing layers. |
> | D2 | **Strictly 2 players for the MVP.** Andreas's "x players" idea is deferred; re-evaluated post-MVP. |
> | D3 | **Option C — derived.** `initialAP = optimalCost + margin(difficulty)`, computed by the solver (`generative_levels.md §2`). 🔢 margin curve open. |
> | D4 | **Option C — linked hex pair.** One unlock tile per dimension, linked by `id`, placed independently by the designer/generator. |
> | D5 | **Standard: one required unlock per level; zero- and multi-unlock levels allowed** as explicit difficulty tools. Generated levels choose per difficulty tier. 🔢 |
> | D6 | **Option B — variable per node**, defined in the level JSON (`apUnlockNodes[].value`). 🔢 |
> | D7 | **Option C** — levels 1–5 are always Dead-End-free; from level 6 on, deliberate Dead Ends are a legitimate design tool. The solver's `deadEndDistance` metric enforces fairness. |
> | D8 | ~~Option B — a Ready button...~~ **Moot — Threshold cut (SPRINT_026)**; see the D8 section below. |
> | D9 | **Option A** — voice chat is assumed and permitted; communication rules apply as an honor system. |
> | D10 | Levels 3 and 10 redefined (see campaign table, `level_design.md §5`); full campaign gets a solver validation pass in Sprint 14. 🔢 |
> | D11 | **Decided.** `initialAP` + `apUnlockNodes` replace `apPerRound`; conduits gain a `base` field. Schema in `digital_implementation.md §5.4`. |
> | D12 | **Option B** — the physical version is a reference design, not a shipped product. Generative levels and the Monitor overlay are digital-only; `architecture.md` keeps physical notes as explanatory analogies. |
> | D13 | Panels after levels 1, 3, 5, 8, 11 and 15 (arc: onset → reactivation → confrontation → emergence). Andreas leads panel concepts. |
> | D14 | **Option C, scoped down** (SPRINT_024, 2026-07-21) — see the D14 section below for the full resolution note and why this departs from the normal three-way sign-off. |
> | D15 | **Resonance built (scoped down), Threshold cut** (SPRINT_026, 2026-07-21) — see the D15 section below. |
> | D16 | **Proposed, unresolved** (2026-07-23) — concept only, see the D16 section below. |
>
> The original questions are preserved below for context and for Chris's review.

---

## D16 — The Body: A Meta-Progression Layer *(Proposed 2026-07-23, rescaled 2026-07-23b — concept only, unresolved)*

**Trigger:** Till: give the puzzle-solving a visible "why" by showing the comatose patient's body gradually waking up as levels are completed — a few body regions unlock every so often, delivered through short cutscenes, with some player choice in which region wakes first tied to mechanic flavor (movement vs. perception), the head/consciousness gated behind the most content, and enough narrative variety (~10 story variants) that replays feel different. Follow-up: rescale to a planned **100-level campaign** (up from 29 shipped), guarantee a story beat in every one of the first 10 levels, spell out exactly what each player narratively contributes to each recovery, and solve AI-art consistency/small-image/region-highlighting concretely.

**Current state:** Concept-only, written up in full at `docs/body_awakening.md`. No code, no art, no schedule changes. Overlays body-region milestones onto the *existing* 29-level campaign's already-named mechanic blocks (zero re-verification risk), guarantees a beat (vignette or region-unlock) on every one of levels 1–10, and sketches an Act-level cadence for the not-yet-built levels 30–100. Places the one real player-choice fork (~L48, a "soft fork" — narrative flavor only, no branching level graph) in that unbuilt range. Player roles are narrated entirely through the existing shared-Matrix loop (Id gathers the impulse, Superego routes it into a stable circuit, both required — no new mechanics). Art consistency is addressed via a fixed cast-reference-sheet approach (reusing the existing Draw Things pipeline's own effort-ranked consistency ladder, `art_pipeline_roadmap.md §4.3`) and a third "clinical reality" palette distinct from both dimensions. Body-region highlighting is explicitly **not** AI-regenerated per state — one fixed silhouette image plus code-defined region rects (mirroring `MatrixRenderer.ts`'s `cellRect` pattern) and the existing `TutorialOverlay.ts` dim/frame overlay technique.

**The question:** Do we build this, and if so — the milestone schedule, the fork's exact mechanic commitments, the story-variant count (10 as first asked, or scoped down), and — newly flagged — **the jump from 29 to 100 levels itself (71 new levels of content)**, all need a decision. Also needs an art/story owner.

**Relevant files:** `docs/body_awakening.md` (full concept), `docs/narrative.md §5.2c`, `docs/level_design.md §5` (existing campaign blocks this would overlay), `docs/art_pipeline_roadmap.md §4.3` (consistency ladder this reuses)
**Owner:** all three — this is a structural + content commitment, not just an engineering one. 🔢 no AP-economy impact expected (pure meta/narrative layer), but Andreas's art/story workload — now scaled to 100 levels — is the real cost driver and should be estimated before this is greenlit.

---

## D14 — Role Asymmetry: Should the Id and the Superego Have Different Verbs? *(Resolved 2026-07-21, SPRINT_024 — see note)*

> **Resolution note:** Till asked for this to be implemented as one of five roadmap-priority sprints, was told (per this document's own three-way consensus rule) that D14 explicitly names "all three" as owner and "reshapes the core loop," and — informed of that — chose to have Till decide alone rather than pause for Andreas/Chris, mirroring the precedent set for the level-3/4 swap (SPRINT_018). Given that authorization, the option actually shipped is **a scoped-down version of Option C**, chosen over full A/B/C after estimating implementation cost: a full Option A or B requires re-verifying and likely redesigning every one of the 23 existing levels (each was proven under the old global-ability/flat-cost assumptions); full Option C (per-source-row ownership, not per-node) requires inventing a row-ownership concept the matrix architecture has never had and rewriting the routing flood-fill itself. The shipped mechanism instead marks individual **ability nodes** (not source rows) as `restrictedTo` a single player, defaulting to unrestricted — provably backward-compatible with all 23 existing levels (re-verified via `validate:levels`, byte-identical proof numbers) because none of them set the new field. First demonstrated in level 24, "Crossed Wires." Full detail: `mechanics.md §5.6`, `SPRINTS/SPRINT_024`. **Andreas and Chris have not signed off on this** — flagged here for their review; the scoped-down shape means reversing or extending it does not require touching the existing campaign.

**Trigger:** Till's playtest verdict: "the puzzle consists less of communication than of waiting — it must be clear from each role WHY one player solves certain tasks and the other the rest."

**Current state:** Both players are mechanically identical; only level geometry differentiates them. The Id/Superego identity is now visible in the UI (SPRINT_013) but carries no rules weight.

**Proposal (for the team to decide):** give each fragment role-true capabilities:
- **(A) The Id gathers, the Superego orders.** Only the Id's dimension contains collectible plates ("impulses grow in the subconscious"); only the Superego may Insert/Rotate ("order is imposed by the critic"). Plates flow from Id to Superego through a new shared "synapse buffer" (1 AP to deposit at a node, visible count only). Every level becomes a hand-off conversation.
- **(B) Soft asymmetry.** Both keep all verbs, but the Id collects at 0 AP / inserts at 3 AP, the Superego inverse — roles are preferred, not enforced.
- **(C) Ability-scope asymmetry** — resolves the long-flagged §5.6 divergence at the same time: abilities apply only to the player whose source row routes them; levels are designed so each player must route for the *other* ("I can see your ⇈ node's row — you can't").

Option A is the strongest narrative fit and forces the desired dialogue but requires re-levelling 1–15 (solver-supported, so provable). Option C fixes a doc/code divergence and creates cross-routing dialogue with less relevelling. A **and** C combined is the maximal version.

**Relevant files:** `docs/mechanics.md §3/§5.6`, `docs/narrative.md §2`, `SPRINTS/SPRINT_013`
**Owner:** all three — this reshapes the core loop. 🔢 Chris: any option changes the AP economy; the solver can re-verify all 15 levels per variant.

---

## D15 — Neuro-Resonance and Threshold's Fate: Build or Cut? *(Resolved 2026-07-21, SPRINT_026 — see note)*

> **Resolution note:** The 5th and final item of Till's roadmap-priority punch list (`roadmap.md` §6). `roadmap.md` §2 had flagged this as "'deferred' is not a decision... either answer is fine, 'still deciding' three sprints running is the actual problem," and per this document's own three-way consensus rule that call belongs to all three. Till, informed of that, chose to decide alone — the same authorization pattern as D14 (SPRINT_024). The two mechanics were split, since they warranted opposite calls:
>
> - **Neuro-Resonance: built**, scoped down the same way D14 was. The full spec (`mechanics.md §4.5`) applies to ANY two vertically-adjacent based plates — unlike every other mechanic added this session, that is not naturally opt-in, so a naive implementation would have needed re-balancing all 25 existing levels' AP economy. The shipped version adds `Conduit.base` defaulting to `NONE`, which can never form a pair — every existing plate is unaffected, provably (`validate:levels` re-proves all 25 levels byte-identical). Two further scope cuts, both disclosed: floor collectibles never carry a base (only plates defined directly in level JSON can), and the solver models the three AP-cost-relevant effects (Discharge, Dampening, Anchor) but not Clarity (information-only, like Focus Vault/Echo Tile's existing "can't be load-bearing" pattern) or pairs pre-formed at level load. First demonstrated in level 26, "First Spark."
> - **Threshold: cut**, formally. It had been a functionless stub since Sprint 8 — trigger detection (`ThresholdSystem`) worked, but the board-flip effect itself was never more than a `console.debug`, and SPRINT_013 had already stripped every threshold hex from the shipped campaign with no arc ever assigned to replace it. Building it for real would need a new alt-hex-layout schema and multi-phase solver support, a bigger lift than fits one item of a five-item sprint list. All of its code — `Threshold`, `ThresholdSystem`, `BoardFlipEvent`, `ThresholdReadyMessage`, `GameState.thresholdEnabled`/`thresholdState` — is now deleted, not just marked deprecated (`architecture.md §5.2`).
>
> Full detail: `mechanics.md §4.5`, `SPRINTS/SPRINT_026`. **Andreas and Chris have not signed off on either half of this** — flagged here for their review, same as D14.

**Relevant files:** `docs/mechanics.md §4.5`, `docs/architecture.md §5.2`, `docs/roadmap.md §2/§6`, `docs/mechanic_roadmap.md` F1/F2
**Owner:** all three — Resonance changes the AP economy (🔢 Chris should review the Discharge/Anchor/Dampening balance now that it's real, same flag mechanics.md §4.5 already carried); Threshold's removal deletes a mechanic Andreas's original concept helped inspire (D1).

---

**Purpose:** This document lists every foundational game design question that is currently unresolved, inconsistent, or not yet agreed upon by all contributors. Nothing moves to implementation until all three contributors have signed off on every item here.

**Definition of Done:** All three contributors — Till, Andreas, and Chris — have explicitly agreed on each item. "Agreed" means a written reply in the pull request, a GitHub comment, or a documented outcome from a shared call. Silence is not agreement.

**After this document is resolved:** A new sprint will be written to implement all changes across the design docs, followed by a code-level refactoring sprint.

---

## How to Use This Document

Each decision below has:
- **Current assumption** — what the docs currently say (or don't say)
- **The question** — what needs to be decided
- **Relevant files** — where to look for context
- **Owner** — who should lead the answer
- **🔢 Balance flag** — items marked with this need Chris's mathematical review

---

## Section 1 — Fundamental Alignment

These must be resolved first. Everything else depends on them.

---

### D1 — Is This the Same Game as Andreas's DDG?

**Current assumption:** Synaptic Coma is a cooperative 2-player hex-grid puzzle game with a DNA Matrix routing mechanic, a psychological narrative (Id vs. Superego), and a Medical Macabre visual identity.

**The question:** Andreas's archived document (`docs/Archive/Temp_DDG.md`) describes a different game: biological cells, DNA base pairing (A/T/C/G), kidney/lung/brain cell types, a 2×6 grid, and a different ability system entirely. His design overview (`docs/Archive/Temp_Matrix_Art.md`) describes a shared vertical DNA column with "x numbers of players."

Are these:
- **(A)** An archived alternative concept he explored and set aside — Synaptic Coma continues as-is
- **(B)** Design input that should reshape Synaptic Coma's mechanics
- **(C)** A separate game project that lives in its own repository

This is the most important question on this list. All other decisions assume option A.

**Relevant files:** `docs/Archive/Temp_DDG.md`, `docs/Archive/Temp_Matrix_Art.md`, `docs/narrative.md`, `docs/mechanics.md`

**Owner:** All three. Andreas must clarify his intent first — this is his concept.

---

### D2 — Is This Strictly a 2-Player Game?

**Current assumption:** The game is 2-player only. The hex grid has exactly two dimensions (A and B), the Matrix has exactly two source nodes, and all systems assume `playerId: 0 | 1`.

**The question:** Andreas's DDG mentions "x numbers of players" and a 2×6 grid that is "expandable for more players." His design overview lists "x numbers of cells" multiple times.

Is the MVP scope:
- **(A)** Strictly 2 players, always — no 3+ player expansion planned
- **(B)** 2 players for MVP, with 3–4 player expansion as a post-MVP goal (requires the architecture to reserve space for it)
- **(C)** Variable player count from the start

**Relevant files:** `docs/mechanics.md §3`, `docs/architecture.md §2–4`, `README.md`

**Owner:** All three. Chris should flag if option B or C changes the balance equations significantly.

---

### D3 — What Is the Starting AP for Each Level?

**Current assumption (round-based, now outdated):** The level JSON field `"apPerRound": 4` sets the AP pool that resets each round. The README says "players share 4 Action Points per round."

**The question:** With the new persistent AP system (no rounds, no resets), the starting AP value for each level must be explicitly designed. It is not reset during play — it only goes down (via actions) or up (via Shared Unlocks).

Options:
- **(A)** Fixed starting value across all levels (e.g., always start with 8 AP)
- **(B)** Variable per level, defined in the level JSON — levels get harder as starting AP decreases
- **(C)** Starting AP is derived from the total AP cost of the optimal solution path, plus a margin — each level is designed backward from its solution

The level JSON field `"apPerRound"` must be renamed and redefined regardless of which option is chosen.

**Relevant files:** `docs/mechanics.md §2`, `docs/implementation_plan.md` (JSON schema), `README.md §Level Format`

**Owner:** All three. Till and Andreas propose a value together; Chris validates whether it creates solvable puzzles across all 15 levels.

**🔢 Balance flag:** The starting AP value is the single most important number in the game economy. If it is too high, puzzles become trivial. If too low, levels may become unsolvable before any Unlock is reachable. Chris should define what "solvable margin" means: the minimum AP overhead that guarantees a player can reach at least one Shared Unlock node before running out.

---

### D4 — Where Do Shared Unlock Nodes Live?

**Current assumption (from SPRINT_003, not yet implemented):** `APUnlockSystem` detects "when both avatars occupy their respective Shared Unlock nodes in the same tick." The architecture defines an `APUnlock { id, value, triggered }` component.

**The question:** A Shared Unlock requires both players to be "on the node." But the two players live in separate dimensions (hex grids). This means the node must have a presence in both Dimension A and Dimension B simultaneously.

Options:
- **(A)** The node is a pair of hex entities — one in Dim A and one in Dim B, linked by a shared `APUnlock.id`. Both must be occupied simultaneously.
- **(B)** The node lives in the DNA Matrix (a dedicated column or special node position). Both players interact with it via the Matrix UI.
- **(C)** The node is a special tile type in each hex grid. The two tiles are inherently linked (same `APUnlock.id`). The level designer places them independently in each dimension.

Option A is the most natural fit for the existing architecture. Option B would require a significant change to the Matrix layout. Option C is identical to A but clarifies the level design workflow.

**Relevant files:** `docs/architecture.md §3`, `docs/mechanics.md §4`, `SPRINTS/SPRINT_003-AP-System-Refactor.md Task 2`, `README.md §Level Format`

**Owner:** All three. Andreas clarifies his original intent; Till and Andreas agree on the model; Chris evaluates option A vs. C from a level design solvability perspective.

**🔢 Balance flag:** The physical distance between a player's starting position and the nearest Shared Unlock node determines the minimum AP cost to reach it. This is the floor constraint on starting AP (Decision D3). These two decisions must be solved together.

---

## Section 2 — Gameplay Mechanics

These depend on Section 1 being resolved.

---

### D5 — How Many Shared Unlock Nodes per Level?

**Current assumption:** Not defined anywhere.

**The question:**
- Are there levels with zero Shared Unlock nodes? (Pure AP budget puzzle — solve it or die)
- Is one node per level the standard?
- Can there be multiple nodes (sequential or optional)?
- Can a node be optional — present but not required if the player has enough starting AP?

**Relevant files:** `docs/level_design.md §2–3`, `docs/mechanics.md §7`

**Owner:** All three. Till and Andreas define the design intent together; Chris evaluates the edge cases.

**🔢 Balance flag:** Zero-unlock levels are essentially the old round-based system in disguise (fixed AP, no recovery). Multiple optional unlocks create branching difficulty — a mathematically richer space but harder to design. If there are exactly-one-required unlocks per level, the puzzle degenerates into a two-phase problem (reach unlock → spend AP on solution), which may be too predictable by Level 8+.

---

### D6 — How Much AP Does a Shared Unlock Grant?

**Current assumption:** The `APUnlock.value` field holds a `ui8` per node. The value is not defined anywhere — no default, no range.

**The question:** What is the AP grant value for a Shared Unlock?
- **(A)** Fixed value across all levels (e.g., always +4 AP)
- **(B)** Variable per node, defined in the level JSON
- **(C)** Derived: the unlock always grants exactly enough AP to complete the remaining solution path (tuned per level by the designer)

**Relevant files:** `docs/mechanics.md §2`, `SPRINTS/SPRINT_003-AP-System-Refactor.md Task 1`

**Owner:** Chris should drive this, as it directly determines whether the AP economy is balanced.

**🔢 Balance flag:** The AP grant value interacts with starting AP (D3), node count (D5), and the AP cost table (`mechanics.md §2`). If the grant is too large, the unlock trivializes the remaining puzzle. If too small, a level can still dead-end even after successfully triggering the unlock. Chris should model whether a fixed grant value can work across all 15 levels, or whether variable values are a necessity.

---

### D7 — Dead End: Designed State or Design Failure?

**Current assumption (from SPRINT_003):** Dead End is a detected state — AP = 0, no unlocks remain, no exit reachable. The game shows an indicator and allows free restart.

**The question:** Should Dead Ends ever intentionally occur during normal play, or are they always a sign of a design error in the level?

- **(A)** Dead End is a design failure. Every level must be solvable without reaching it. The Dead End indicator is a safety net for bad level design, not a feature players encounter.
- **(B)** Dead End is intentional on specific "trap" levels. These levels teach players to recognize when a path is unrecoverable and restart deliberately — a skill in itself.
- **(C)** Dead End is intentional but only on levels 6+ (advanced play). Tutorial levels (1–5) are always solvable without it.

This distinction changes how levels are designed, playtested, and validated.

**Relevant files:** `docs/mechanics.md §7`, `docs/level_design.md §1`, `SPRINTS/SPRINT_003-AP-System-Refactor.md Task 3`

**Owner:** All three. Till and Andreas agree on the philosophy; Chris defines the formal conditions under which a Dead End is "provably unavoidable" for a given level configuration.

**🔢 Balance flag:** If option A is chosen, every level needs a mathematical proof (or at least a playtest guarantee) that it is solvable from the starting state without Dead Ending. This is non-trivial: it requires checking all possible AP expenditure sequences, not just the optimal path. Chris should define what the minimum verification process looks like.

---

### D8 — The Threshold Mechanic: UI for "Confirm Ready" *(Moot — Threshold cut, SPRINT_026)*

> **Resolution note:** Raised alongside the Resonance/Threshold "build or drop" call (`roadmap.md` §2/§6), which Till — per the same authorization pattern as D14 (SPRINT_024) — chose to decide alone. Threshold had been a functionless stub since Sprint 8 (trigger detection worked; the actual board-flip effect was never more than a `console.debug`) and SPRINT_013 had already stripped it from every shipped level. Rather than design this UI for a mechanic with no assigned campaign arc, SPRINT_026 removed Threshold entirely — `ThresholdSystem`, the `Threshold` component, `BoardFlipEvent`, `ThresholdReadyMessage`, and `GameState.thresholdEnabled`/`thresholdState` are all gone from the codebase (`architecture.md §5.2`). This question no longer applies. Andreas/Chris have not signed off; flagged for their review like D14.

**Current assumption (historical, pre-SPRINT_026):** `ThresholdSystem` requires both avatars on their threshold hexes AND `GameState.thresholdState.p1Ready && p2Ready` to be true before firing `BoardFlipEvent`. The "Ready" toggle is mentioned in the system but the UI for setting it is undefined.

**The question:** How does a player set their `p*Ready` flag?
- **(A)** A dedicated key press (e.g., `Enter` while standing on the threshold hex)
- **(B)** A UI button that appears when the avatar steps onto the threshold hex
- **(C)** Automatic — standing on the hex for 1 full second without moving counts as "ready"
- **(D)** A combination: the avatar must be on the hex AND the player must click a specific on-screen prompt

**Relevant files:** `docs/mechanics.md §5.2`, `docs/architecture.md §5.2`, `docs/digital_implementation.md §3`

**Owner:** All three. This has significant UX implications — accidental triggers are costly (the flip is irreversible).

---

### D9 — Communication Rules: Verbal vs. Digital

**Current assumption:** Communication rules are strict — players may discuss goals but not methods or inventory. The digital implementation enforces this with emoji-only chat.

**The question:** The emoji-only chat enforces no free text inside the game. But players in digital play will almost certainly use Discord, phone calls, or another voice channel alongside the game. The current rules assume verbal communication is possible and are designed around it ("I am blocked by a door with the Red Triangle icon").

Is verbal communication:
- **(A)** Explicitly permitted and assumed — the communication rules apply as an honor system to voice chat as well
- **(B)** Explicitly prohibited — digital play must be emoji-only, no voice allowed
- **(C)** Deliberately unaddressed — the game doesn't enforce this; players choose their own rules

This affects how the communication rules document reads and whether any in-game enforcement is needed beyond the emoji chat.

**Relevant files:** `docs/communication_rules.md`, `docs/digital_implementation.md §5.3`

**Owner:** All three.

---

## Section 3 — Level Design

---

### D10 — Campaign Rebalancing: Which Levels Need Redesign?

**Current assumption:** The 15-level campaign (`README.md §Campaign`) was designed around the round-based AP system. Every level name and key mechanic is defined.

**The question:** With persistent AP and Shared Unlocks replacing round resets, at minimum these levels need to be revisited:

| Level | Current design | Problem |
|-------|---------------|---------|
| 3 | "Scrap Pool: blind draw economy" | "Economy" was meaningful when AP reset — now the Scrap Pool costs 1 AP from a non-resetting pool. Does this level still teach the right lesson? |
| 10 | "Tight Budget: 3 inserts, sequential exit under AP pressure" | "Tight Budget" was defined relative to a 4-AP round. With persistent AP it's undefined. |
| 11–15 | Threshold levels | Threshold is unchanged mechanically, but the AP available before and after the flip is now a function of starting AP minus costs, not round resets. |

Does any level need to be redesigned from scratch, or do small adjustments to starting AP and unlock placement suffice?

**Relevant files:** `docs/level_design.md §5`, `README.md §Campaign`

**Owner:** All three. Till and Andreas review level by level; Chris validates that each level remains solvable.

**🔢 Balance flag:** Level 10 specifically needs a new formal definition of "tight budget" in a persistent AP context. Chris should define what minimum AP overhead qualifies as "tight" — i.e., what is the acceptable margin between required AP and available AP that produces a satisfying puzzle rather than a frustrating one?

---

### D11 — Level JSON Schema: What Replaces `apPerRound`?

**Current assumption:** Level JSON files contain `"apPerRound": 4`. This field sets the AP per round.

**The question:** In the persistent AP model, this field needs to be replaced. The new field must define:
- Starting AP for the level
- Whether Shared Unlock nodes are present, and if so, their position and grant value in the level JSON

Proposed replacement schema fragment:
```jsonc
{
  "initialAP": 8,
  "apUnlockNodes": [
    { "id": "unlock_01", "value": 4, "hexA": { "q": 2, "r": 0 }, "hexB": { "q": -2, "r": 0 } }
  ]
}
```

Is this the right structure? What is the field naming convention? Does the `apUnlock` entity get a `type` in the `entities` array, or is it a separate top-level section?

**Relevant files:** `docs/implementation_plan.md §JSON Level Schema`, `README.md §Level Format`, `SPRINTS/SPRINT_003-AP-System-Refactor.md Task 4`

**Owner:** All three. Till and Andreas propose structure together; Chris validates that it supports all level design patterns needed for D5 and D6.

---

## Section 4 — Out-of-Scope Confirmation

These items appear in the existing docs but have never been explicitly confirmed as still in scope. They should be either confirmed or formally removed.

---

### D12 — Is the Physical Board Game Version Still in Scope?

**Current assumption:** `docs/architecture.md` includes physical implementation notes for every component and system. The architecture was explicitly designed with dual-format parity.

**The question:** The project has shifted significantly (AP system change, Shared Unlock nodes, Dead End detection). Shared Unlock nodes require both players to stand on hex nodes simultaneously — this has implications for physical play (how does the board enforce "simultaneous"?). 

Is the physical version:
- **(A)** Still a primary deliverable, maintained in parallel with the digital version
- **(B)** A reference design only — useful for explaining mechanics, but not a shipped product
- **(C)** Deferred to post-MVP

**Relevant files:** `docs/architecture.md` (all physical implementation notes), `docs/mechanics.md`

**Owner:** All three.

---

### D13 — Narrative Panels: Which Levels Get Them?

**Current assumption:** `docs/narrative.md §5.2` says "after completing specific levels, a single narrative panel appears (not every level)." The sequence forms a complete arc across the 15 MVP levels. No specific levels are named.

**The question:** Which levels have narrative panels? What imagery does each panel show?

This is not blocking for implementation (the system just needs a flag in the level JSON), but it is blocking for asset creation.

**Relevant files:** `docs/narrative.md §5.2`, `public/cutscenes/`

**Owner:** All three. Till and Andreas define the panel schedule together; Andreas can take the lead on panel concepts as the game's originator.

---

## Section 5 — Balancing Summary for Chris

The items below require mathematical review independent of the design decisions above. They are collected here for ease of reference.

| # | Question | Depends on | Blocking |
|---|----------|-----------|---------|
| B1 | What starting AP value is always sufficient to reach at least one Shared Unlock? | D3, D4 | Yes — D3 |
| B2 | What AP grant value avoids trivializing the post-unlock puzzle? | D6, D3 | Yes — D6 |
| B3 | Is every level in the 15-level campaign provably solvable with the new AP model? | D3, D5, D6 | Yes — D10 |
| B4 | What is the formal definition of "tight budget" without rounds? | D3 | Yes — D10 |
| B5 | With zero-unlock levels (if D5 allows them), what starting AP creates a satisfying constraint rather than a brick wall? | D5 | Only if D5 allows |
| B6 | Is the conduit shape distribution per level (straight/curved/T-junction) balanced — i.e., is every level solvable from all valid initial orderings of conduit draws from the Scrap Pool? | — | No (post-MVP) |

---

## Section 6 — Call to Action

### Till

1. **Push to resolve D1 and D2 first** — get Andreas's written answer on both. These determine whether the rest of the document is relevant at all.
2. **Propose a starting AP value (D3)** together with Andreas — even a rough number gives Chris something to model against.
3. **Raise D12** in the team discussion — is the physical version still in scope? This affects how architecture.md is maintained.
4. **Schedule a team call** to work through D3, D5, D6 together. These three are deeply interlinked and are better resolved in conversation than in written back-and-forth.

### Andreas

1. **Answer D1 explicitly.** A written comment on this document or in GitHub is sufficient. One sentence: "The DDG is archived / is design input / is a separate game."
2. **Answer D4.** How did you envision the Shared Unlock nodes working spatially? In the hex grid, or in the Matrix?
3. **Propose a starting AP value for D3** based on how you imagined the new system playing.
4. **Review D10** — are any of the 15 levels fundamentally broken by the AP change in your view?

> Note: If any of the design documents feel unclear, see `docs/project_overview.md` for a plain-language guide to how the project is structured and where each concept lives.

### Chris

1. **Work through B1 and B2 first** — these are the two constraints that determine whether the AP redesign is mathematically viable.
2. **Once D3 has a proposed value**, validate whether it produces solvable puzzles for the 15 existing levels (B3).
3. **Define "tight budget" (B4)** in terms of AP overhead ratio or minimum slack — give the level designer a number they can use as a target.
4. **Flag any level** from the campaign list (`README.md §Campaign`) that you believe cannot be made solvable under a persistent AP model without fundamental redesign.

---

## Next Steps After Consensus

Once all decisions are resolved:

1. A **SPRINT_004 — Level Schema & AP Economy** will be written to:
   - Update the level JSON schema (replace `apPerRound`, add `apUnlockNodes`)
   - Update all 15 level entries in the campaign overview with confirmed starting AP values and unlock placements
   - Update `README.md` to reflect the new system (it currently still describes rounds and Pass)
   - Update `docs/open_questions.md` with the resolved decisions from this document

2. A **SPRINT_005 — Code Refactor: Persistent AP** will be written to implement the doc changes from SPRINT_003 and SPRINT_004 in the actual source code.

---

*Last updated: 2026-04-06*
