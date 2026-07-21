# Campaign Audit & Mechanic Roadmap

**Purpose:** Two things, in one document because they inform each other: (1) a systematic audit of the shipped 20-level campaign's difficulty progression and the sensibility of its mechanic-introduction order, and (2) a forward-looking concept for ten new mechanics that could extend the game — narratively grounded, architecturally compatible, and each justified individually. **This document is a concept only.** Nothing here is implemented; Part 1's findings are diagnostic (a few describe pre-existing documentation drift that this document corrects in place — see the note at F2), and Part 2 is a proposal for the team to select from, not a build plan.

**Method:** Every level JSON (`src/levels/level_01.json` … `level_20.json`) was read in full; findings are cross-checked against the solver's proof output (`levelMeta.json`, produced by `npm run validate:levels`), against `docs/level_design.md`, `docs/mechanics.md`, `docs/tutorial_design.md`, `docs/narrative.md`, and against the actual system/component source (not just the docs) wherever a doc claim needed verification.

---

## Part 1 — Campaign Audit (Levels 1–20)

### 1.1 The Full Picture

| # | Name | Ability first required | optimal | slack | D | sync | coord | matrix |
|---|------|------------------------|---------|-------|---|------|-------|--------|
| 1 | Tutorial: Movement | — | 4 | 8 | 0.60 | 1 | 0 | opt |
| 2 | Locked Door | RED | 10 | 6 | 3.35 | 1 | 0 | REQ |
| 3 | Column Shift | JUMP (clean) | 7 | 6 | 2.23 | 1 | 0 | REQ |
| 4 | Scrap Pool | JUMP (decoy RED door) | 9 | 6 | 4.52 | 1 | 0 | REQ |
| 5 | Shared Routing | RED + BLUE | 12 | 4 | 4.17 | 1 | 0 | REQ |
| 6 | Insert Sequence | JUMP (decoy ×2 RED doors) | 6 | 4 | 2.08 | 1 | 0 | REQ |
| 7 | T-Junction Coordination | RED + BLUE | 14 | 1 | 6.44 | 5≤ | 1 | REQ |
| 8 | Red Herring | JUMP | 6 | 6 | 1.75 | 1 | 0 | REQ |
| 9 | Forced Rotation | RED | 11 | 1 | 6.15 | 2 | 1 | REQ |
| 10 | Tight Budget | JUMP | 7 | 4 | 3.12 | 1 | 0 | REQ |
| 11 | Convergence | *(none — see F4)* | 9 | 4 | 3.57 | 1 | 0 | **opt** |
| 12 | Leap of Faith | JUMP | 8 | 4 | 2.90 | 1 | 0 | REQ |
| 13 | Critical Rotation | RED + BLUE | 12 | 1 | 6.36 | 2 | 1 | REQ |
| 14 | Low Reserves | RED + BLUE | 15 | 1 | 6.62 | 5≤ | 1 | REQ |
| 15 | Master Set Teaser | RED | 15 | 1 | **11.27** | 5≤ | 1 | REQ |
| 16 | Airlock | RED + BLUE | 12 | 2 | 5.70 | 2 | 1 | REQ |
| 17 | Signal Chain | RED + BLUE + FIRE | 14 | 2 | 5.92 | 3 | 1 | REQ |
| 18 | Phased Rendezvous | PHASE | 14 | 2 | 6.00 | 2 | 1 | REQ |
| 19 | Dead Column | RED + BLUE | 13 | 2 | 7.42 | 5≤ | 1 | REQ |
| 20 | Synapse Toggle | RED + JUMP | 15 | 3 | 7.45 | 3 | **2** | REQ |

*(D = DifficultyModel score; sync = minimal player hand-offs any solution needs; coord = Shared Unlock pairs mathematically required; slack = AP margin over the proven optimum.)*

### 1.2 Findings

**F1 — Neuro-Resonance is claimed but does not exist in code.** `level_design.md`'s campaign table states level 6 "introduces" Neuro-Resonance, and `mechanics.md §4.5` specifies it in full (four ordered base pairs, AP surges, rotation discounts). But: `Conduit` (`src/components/Conduit.ts`) has no `base` field, `MatrixConduitDef` (`LevelSchema.ts`) has no way to set one in level JSON, and there is no `ResonanceSystem.ts` anywhere in `src/systems/`. `DifficultyModel.ts`'s own weight vector marks `resonance: 0.0` as "reserved." **This is not a level-design problem — it's unbuilt engine work that a design doc and a campaign-table promise both assume exists.** No level actually teaches or uses it, because it cannot.

**F2 — The Threshold mechanic was deliberately removed from the campaign, but the campaign table wasn't corrected to say so.** SPRINT_013 stripped Threshold tiles from levels 11–15 on principle ("no dead mechanics on the board" — the board-flip was an engine stub) and renamed the levels accordingly (11→*Convergence*, 12→*Leap of Faith*, 14→*Low Reserves*). Verified: `thresholdEnabled: false` and zero `threshold`-type entities in every one of levels 1–20 — the mechanic has **no presence anywhere in the shipped campaign**. Yet `level_design.md`'s table (as of the start of this audit) still read "11 | Threshold Tutorial | FIRE_IMMUNITY required before Threshold," "12 | Pre-Flip Jump," "14 | Threshold at Low AP" — describing a mechanic that hasn't existed in these levels for two days. **This audit corrects that table** (see the diff to `level_design.md` shipped alongside this document) to describe what levels 11–15 actually teach today; this is a factual documentation fix, not a new design decision — SPRINT_013 already made the call to remove Threshold, the table just hadn't caught up.

**F3 — PUSH has zero playable content across the entire campaign.** `PushSystem`, `Pushable` component, and `AbilityType.PUSH` are fully implemented and wired into the pipeline. But `EntityType` in `LevelSchema.ts` has no `'pushable'` variant — **there is no way to place a Pushable entity in any level JSON**, and none of the 20 levels do. Several levels (2, 4, 6) do place a PUSH ability *node* in the matrix, but it's pure set-dressing — it powers nothing there is to push. An entire ability, end to end implemented, has never been played once.

**F4 — Level 11's redesign broke its own lesson; this silently starves PHASE_SHIFT and FIRE_IMMUNITY of any teaching moment.** "Convergence" (formerly the Threshold/Fire-Immunity tutorial) now has **no wall entities at all** — a fully open board with one avoidable fire hazard. The solver confirms it: level 11 is the *only* level besides the movement tutorial (L1) with `matrix=opt` — the matrix, and therefore FIRE_IMMUNITY, is provably optional. A player can walk straight past the hazard to the exit. Consequence: FIRE_IMMUNITY's first *mandatory* use is level 17 ("Signal Chain," `needs=[...FIRE]`), six levels after its supposed introduction, with zero working exposure in between. **PHASE_SHIFT has it worse: it is never even nominally introduced before level 18** ("Phased Rendezvous," the first and only level requiring it) — no prior level places a PHASE_SHIFT node at all. Both abilities are structurally set up to blindside a first-time player exactly the way JUMP blindsided Till in level 3 and the column-slide mechanic blindsided him in level 5 — except here there isn't even a flawed early attempt to fall back on; there's nothing before it at all.

**F5 — Tutorial-popup coverage covers 5 of the 14 specified concepts.** `tutorial_design.md §2` defines a 14-concept registry (`MOVE, AP_POOL, COLLECT, INVENTORY, MATRIX_INSERT, MATRIX_ROTATE, ROUTING, ABILITY_USE, SCRAP_POOL, UNLOCK_NODE, DEAD_END, EXIT_SEQUENCE, THRESHOLD, RESONANCE, CHAT`) with a generic dim/frame/arrow trigger system. What's actually implemented (`TutorialPopups.ts`) is five hand-written, ad-hoc popups: `ROLES` (not even in the original registry — a SPRINT_013 addition), `UNLOCK_NODE`, `INSERT`, `JUMP`, `SCRAP_DRAW`. There is no popup for `MATRIX_ROTATE` (needed by L9, L13, L19, L20), `PUSH` (moot per F3), `PHASE_SHIFT`, `FIRE_IMMUNITY`, `UNLOCK_BLUE` as distinct from `UNLOCK_RED`, `DEAD_END`, or `EXIT_SEQUENCE`. Combined with F4, this means a first-time player hits both Phase Shift *and* the Rotate-as-precision-tool idea (L9) with no in-fiction explanation whatsoever.

**F6 — The difficulty envelope peaks at level 15, then the entire 16–20 block never re-crosses it.** L15's D=11.27 is nearly double L14 (6.62) and is not approached again until at least L21 would exist — the hardest levels of the "unconventional combinations" block (SPRINT_017, built explicitly to raise difficulty) top out at L20's 7.45, still 34% below L15. Read charitably, L15 is a deliberate MVP-capstone spike before a new arc begins at a reset baseline — a legitimate structure (many campaigns end an act on a spike, then start the next act calmer). Read less charitably, it means a player's *hardest* moment in the current build is two-thirds of the way through, not at the end. Worth a team call on whether that's intended pacing or a gap waiting for levels 21+ to close.

**F7 — Within levels 1–12, the game's own stated purpose (forcing interaction) is rarely load-bearing.** `sync` (minimal required hand-offs) sits at the theoretical floor of 1 for 10 of the first 12 levels; `coord` (Shared Unlock mathematically required) is 0 for the same 10. This is *consistent* with the tutorial-tier design contract in `generative_levels.md §2.4` (levels 1–5 keep the unlock optional by design) — but it means that contract's low bar extends, in practice, all the way to level 12. A player could clear 60% of the current campaign never once being mathematically forced to coordinate with their partner beyond "both walk to your own exit." This sharpens rather than contradicts Till's design thesis (communication is the goal) — it says the campaign doesn't start collecting on that thesis until roughly its second half.

**F8 — The JUMP-bypasses-a-lock trick is taught three times in the first six levels** (L3 clean, L4 one decoy door, L6 two decoy doors) before level 8 is formally titled "Red Herring." Each instance adds something (L6 layers in insert-order teaching alongside the now-familiar trick), so this isn't dead repetition, but a sharp player will have fully internalized "don't trust a lock, check if you can jump it" by L6 — leaving L8's formal introduction feeling slightly redundant rather than climactic. Minor, no action needed beyond awareness.

**F9 — Small content bugs, cosmetic, no mechanical impact (listed for completeness):**
- `level_15.json`: the hazard entity named `door_blue` has `hazardType: 1` (LOCKED_RED), not `2` (LOCKED_BLUE) — likely a copy-paste typo. UNLOCK_BLUE's matrix node is consequently decorative (confirmed by the solver: `needs=[RED]` only). Given "Master Set Teaser"'s actual lesson is about Scrap Pool draws and the Cross plate, not decoys, this reads as unintentional rather than a deliberate second red herring.
- `level_04.json` (now "Column Shift"), `level_12.json`, `level_13.json` each carry one duplicate entity (a wall or hazard placed twice at identical coordinates). `EntityRegistry.register` silently overwrites on duplicate keys, so there's no runtime error — just orphaned entities and sloppy JSON.

### 1.3 Recommendations (for prioritization, not actioned here)

1. **Before adding anything from Part 2:** decide whether Neuro-Resonance and Push get built out (both are already fully speced/partially wired — Resonance in `mechanics.md`, Push in the ECS) or formally descoped from the campaign table and `DifficultyModel`. Shipping either silently (as now) misleads whoever next reads the docs.
2. **Give level 11 a real redesign** (walls that actually gate the fire hazard) so FIRE_IMMUNITY gets a working teaching moment before level 17, and **add an explicit PHASE_SHIFT teaching level** before level 18 — both using the same `levelHasAbility()`-triggered first-encounter popup pattern already built for JUMP.
3. **Extend `TutorialPopups.ts`** with at minimum `MATRIX_ROTATE`, `PHASE_SHIFT`, and `FIRE_IMMUNITY` entries — the pattern (trigger on `levelHasAbility()`, address the player who can't self-solve) is proven and cheap to repeat.
4. **level_design.md's table is now corrected** for 11–15 as part of this audit; no further action needed there.

---

## Part 2 — Ten Mechanic Proposals

Each is chosen to be **maximally different from the others** in what part of the system it touches (economy, physical space, information, timing, persistence, risk, matrix topology, cooperative reward, communication itself, ability depth), so the team can pick a varied slate rather than ten variations on one idea. Every proposal names its narrative grounding (`narrative.md`), its ECS shape, and explicitly states what existing mechanics it combos with — per the project's own design philosophy (`level_design.md §1`), a mechanic that doesn't create new *combinations* with what's already there isn't pulling its weight.

---

### 1. Synaptic Fatigue
**What:** Every tick an ability is actively in use, it accumulates "fatigue" on its `MatrixNode`. Past a threshold, the ability's node goes dark for a few ticks — powered, wired correctly, but temporarily non-functional — before resetting. A visual pulse (dimming glow) gives fair warning before the cutoff.
**Why exciting:** Turns abilities from a binary on/off switch into a budget you can *overdraw*. It changes the question from "is this routed?" to "when, exactly, do I spend it?" — a genuinely new axis of tension that the current AP economy doesn't touch (AP is spent per-action; fatigue is spent per-*duration*).
**Compatibility:** Composes directly with JUMP (a player mid-multi-jump sequence can burn out) and with Phase Shift/Fire Immunity (a passive defensive ability that blinks off at the worst moment is an entirely new hazard-timing puzzle). Neuro-Resonance's `STAB → MOD` "Anchor" pairing (once built, F1) is a natural counter-play — a level could teach "route a Stabilizer pair to buy your Jump more stamina."
**Narrative fit:** The mind tires. An overused impulse (Id) burns itself out; an overapplied rule (Superego) needs a moment to re-cohere. `narrative.md §3`'s framing of abilities as "Thoughts" completing supports this directly — a thought sustained too long under strain should feel effortful, not free.
**Suggested entry point:** Mid-campaign (post-20), after players are fluent with all six current abilities — it's a modifier on existing abilities, not a standalone lesson.

---

### 2. Impulse Blocks
**What:** A new `Pushable` hex-grid entity (the component and `PushSystem` already exist and are fully dormant — see F3) rendered as a "Repressed Impulse" clot (Id board) or a "Logic Block" (Superego board). Can be shoved into chasms to bridge them, onto pressure-triggered hazard switches to disable them, or against a wall to block a hazard's line of effect.
**Why exciting:** It's the cheapest mechanic on this list to ship (zero new components/systems, just JSON authoring + one new `EntityType` variant) and it turns PUSH from a completely unused ability into a spatial-reasoning puzzle category the game has never had — pushing something changes the *board*, not just the *avatar*.
**Compatibility:** Combos naturally with JUMP (jump over a chasm you haven't bridged yet, or jump onto a block mid-slide) and with Fire Immunity/lasers (a block can be pushed to smother a fire hazard or interrupt a laser's line). Also gives the long-idle PUSH matrix nodes already scattered across levels 2/4/6 a reason to exist.
**Narrative fit:** The Id's chaotic board already features "grasping synapses" and organic matter (`narrative.md §2`) — a shoveable clot of repressed material fits immediately. The Superego's board gets its mechanical mirror: a movable logic block, structure imposed on structure.
**Suggested entry point:** Right after the current campaign (level 21) — it's foundational enough to deserve its own short intro arc, similar to how Threshold was originally planned for 11–15.

---

### 3. Echo Tiles
**What:** A rare hex tile that, when an avatar stands on it, projects a faint, wordless *silhouette* of the far dimension's board layout (walls, hazards, hazard state) onto the near board for a few ticks — never plate contents, never inventory, never Scrap Pool contents. Purely geometric information sharing, sanctioned by the fiction (a thin place in the dimensional split).
**Why exciting:** Every other information-asymmetry tool in the game is *verbal* (say what you see). Echo Tiles are the first *mechanical* channel for cross-dimension awareness — and because it's strictly limited to layout, not content, it doesn't undercut the core secrecy rule (`communication_rules.md`), it *complements* it: now players can also point at something the other genuinely cannot describe accurately from memory ("the wall pattern near your exit looks like it curves right").
**Compatibility:** Strongest with Threshold (once real, F1/rec. #1) — an Echo Tile right before a board-flip lets players preview the shape of what's coming. Also useful alongside Pulse Gates (#4 below): seeing the other board's gate rhythm, even without seeing your own gate's timing, changes the coordination problem.
**Narrative fit:** Directly literalizes `narrative.md §3`'s "DNA Matrix... the only place where the Id and Superego still connect" — Echo Tiles would be the one *other* place, framed as scar tissue where the dimensional split is thin. Strong opportunity for a between-level narrative panel (`narrative.md §5.2`) introducing it.
**Suggested entry point:** As a light mid-campaign addition (around level 9–12 territory) — it's a comprehension tool, not a hard mechanic, and works well as a "breather" level per the tension/release rhythm noted in F6.

---

### 4. Pulse Gates
**What:** A hazard/door that isn't statically locked or unlocked but cycles on a fixed tick rhythm (e.g., open 3 ticks, closed 2 ticks), visualized as a pulsing iris. Passable only during its open window, regardless of ability state.
**Why exciting:** Introduces *time* as a puzzle axis for the first time — every other hazard in the game is a static state gated by routing. A Pulse Gate forces "be there when it's open," which is an entirely different kind of coordination problem: not "route the right ability," but "both of us arrive at the right *moment*," compounding beautifully with the sequential-exit rule (P1 has exactly one shot to time their exit gate before P2's timing window even starts).
**Compatibility:** Composes with JUMP (a jump can vault a gate's *closed* frame if the landing tile beyond is clear — reusing JUMP's existing "intermediate hex irrelevant" rule in a new context) and with Synaptic Fatigue (#1): a gate whose rhythm depends on an ability that's actively fatiguing creates a shrinking window under pressure.
**Narrative fit:** `narrative.md §2` already gives the Superego "automated security protocols" and the Id "repressed fears" as hazard categories — a pulsing iris (heartbeat-like, or a neural firing rhythm) fits both readings without art-direction conflict, and ties nicely to the coma's own vital-sign monitor framing (the Monitor's clinical CRT could literally show the same pulse).
**Suggested entry point:** A dedicated short arc (2–3 levels) once the campaign extends past level 20 — timing puzzles need their own ramp, similar to how Threshold was planned.

---

### 5. Scar Tissue
**What:** Certain hex tiles start in a "raw" state and permanently transform the first time an avatar enters them (or the first time a specific hazard is triggered) — a chasm that seals into solid ground once crossed, a fire hazard that burns out and leaves permanently-blocked ash, a locked door that shatters (rather than re-locks) if forced open a second way. State is written once and never resets within the level.
**Why exciting:** Every hazard in the game today is either permanently static or dynamically re-evaluated every tick (doors re-lock instantly when routing breaks — `mechanics.md §5.4`). Scar Tissue introduces a third category: **irreversible one-way world mutation**, which changes the calculus of *when* to commit to a route, since some choices burn a bridge (literally) rather than just costing AP.
**Compatibility:** Powerful combo with the Airlock-style shared-mutation-as-trap pattern from level 16 (SPRINT_017) — Scar Tissue generalizes that one-off trick into a reusable hazard category. Also interests with Push (#2): a pushed block landing in lava could scar the tile into a permanent bridge, a genuinely satisfying two-mechanic payoff.
**Narrative fit:** This is the clearest, most direct mechanical expression of the game's own title and premise — a *coma*, trauma landmarks, scars that don't heal. `narrative.md §4`'s Threshold framing ("Trauma Landmarks — core memories that caused the coma") already gestures at exactly this idea; Scar Tissue would let ordinary hazards carry that weight without needing a full board-flip event.
**Suggested entry point:** Late-campaign (post-20) or as a signature mechanic for "The Deep Coma" endless mode (`generative_levels.md §6.2`) — permanent one-way state changes are a natural fit for procedurally escalating difficulty.

---

### 6. Bruised Fragments
**What:** A new Tier-2 ability, "Resilience" — while routed, `Health.max` for the connected avatar becomes 2 instead of 1 (the field already exists in the `Health` component per `architecture.md`, just never set above 1 anywhere in the campaign). A first hit "bruises" the avatar (a visible cracked-glow state) instead of destroying it; a second hit is still fatal.
**Why exciting:** The entire campaign currently runs on strict permadeath-with-one-retry (`mechanics.md §7`) at the *level* level — every hazard interaction inside a level is binary pass/die. Bruised Fragments is the first mechanic to introduce graduated risk *within* a single attempt, letting a level design a genuinely riskier shortcut ("go through the fire without Immunity, but only if Resilience is up") as a real strategic option rather than a certain reset.
**Compatibility:** Directly interesting against Fire/Laser/Chasm hazards (a bruised avatar could survive a fire tick it normally couldn't) and against Synaptic Fatigue (#1) — routing both Resilience and another ability creates real trade-off pressure for limited matrix real estate.
**Narrative fit:** `narrative.md §2` frames both dimensions as damaged, not destroyed — "a patient trapped in a deep... coma," not dead. A fragment that can be wounded and keep going is a stronger fit for the healing-arc narrative (`narrative.md §5.2`: "coma onset → neural reactivation → confrontation with trauma → emergence") than the current all-or-nothing death state, especially for the "confrontation with trauma" beat.
**Suggested entry point:** Right where a second forced-Threshold-style advanced arc would sit (roughly level 25+) — it changes risk calculus enough that early tutorial levels should stay binary.

---

### 7. Short Circuit
**What:** A rare event (triggered by a specific hazard, a Scar Tissue transformation, or a scripted level moment) that instantly and simultaneously rotates every currently-placed conduit plate in the matrix by a random 90° step, breaking all current routing at once. Both players see it happen live (a visible jolt across the tray) — no surprise, but no warning either.
**Why exciting:** Every existing failure mode in the game is *caused* by a player action (an insert, a rotate, a slide). Short Circuit is the one thing that can happen *to* the matrix rather than *because of* a choice — a shared crisis moment that forces both players to re-diagnose the board together under time pressure, which is a distinctly different flavor of the game's core "shared mutation" principle (`mechanics.md §4.5`) than anything currently shipped.
**Compatibility:** Best used sparingly, as a punctuation mark late in a level that otherwise uses ordinary insert/rotate play — it's the strongest possible use case for Pulse Gates (#4) stacked right after (recover routing *and* hit a timing window) or for the Bruised Fragments safety margin (#6) covering the scramble's fallout.
**Narrative fit:** A literal short circuit in a coma patient's neural pathways — a seizure-like event — is about as on-the-nose as this game's premise gets, and gives the Monitor (`tutorial_design.md §1`) a dramatic clinical line to deliver ("NEURAL SPIKE DETECTED — REROUTING REQUIRED").
**Suggested entry point:** A single dramatic set-piece level, not a recurring mechanic across many levels — best placed as an arc climax (e.g., a "Level 30"-style capstone) rather than diluted across the campaign.

---

### 8. Focus Vault
**What:** A new node type reachable only via a joint "Focus" action: both avatars must stand on their respective Focus hexes *and* both spend 1 AP in the same tick (mirroring the Shared Unlock trigger pattern in `APUnlockSystem`, but consuming AP rather than granting it). Success opens a one-time Vault elsewhere on the board containing a bonus conduit — often a Master Set plate or a pre-solved shortcut.
**Why exciting:** Every current cooperative moment (Shared Unlock, sequential exit) is *mandatory* — required to finish the level. Focus Vault is the game's first genuinely *optional* cooperative act: a joint sacrifice (spending scarce AP together, for nothing but a maybe-useful bonus) that rewards trust and curiosity rather than necessity. It's also naturally replayable content for "The Deep Coma" endless mode and "Daily Synapse" (`generative_levels.md §6.2`), where an optional bonus room adds variance without threatening the solver's solvability guarantee (the base solution never depends on it).
**Compatibility:** A clean reward delivery vehicle for anything else on this list that's scarce (a Resilience plate, an Echo Tile unlock, a Master Set shape) — it's less a mechanic that combos with others and more a *distribution mechanism* for them.
**Narrative fit:** Two competing halves of a mind choosing, together and for no required reason, to dig a little deeper into a memory — this is squarely "confrontation with trauma" territory (`narrative.md §5.2`) and a strong candidate for triggering one of the between-level narrative panels on first discovery.
**Suggested entry point:** Any point after level 20 — being optional, it can be introduced without disrupting the solver's required-path proofs for surrounding levels; a good candidate for the *first* new mechanic shipped, since it's structurally the safest (never load-bearing, never blocks completion).

---

### 9. Static Field
**What:** A hex zone (rendered as a crackling grey haze) that, while either avatar stands inside it, suppresses the emoji chat channel entirely for both players — the one sanctioned communication tool the digital version provides (`digital_implementation.md §5.3`) goes dark for the duration.
**Why exciting:** Every mechanic on this list adds *capability*. Static Field is the one deliberate act of *subtraction* — and given the entire game's thesis is "communication is the point," a zone that removes even the limited digital communication channel is the single most direct way to dramatize that thesis mechanically rather than just asserting it in the rules doc. It forces a short segment of pure pre-planning: agree on the route *before* entering, or don't.
**Compatibility:** Pairs naturally with Pulse Gates (#4) and Short Circuit (#7) — both already demand fast joint decisions; doing so with zero digital signal available raises the stakes without adding new spatial complexity. Should be used sparingly and always clearly telegraphed (per `art_and_ui.md`'s language-agnostic-iconography discipline) — this is a mechanic that punishes surprise, not one that should rely on it.
**Narrative fit:** `communication_rules.md` already establishes voice chat as assumed-but-unenforced; Static Field is the in-fiction justification for why, sometimes, *nothing* gets through — a literal dead zone in the neural static between two minds, thematically consistent with "the mind is wordless" (`tutorial_design.md §1`) taken to its logical extreme for a room.
**Suggested entry point:** A single, clearly-signposted level rather than a scattered hazard type — best introduced once, deliberately, so it reads as a design statement rather than an annoyance.

---

### 10. Convergence Nodes
**What:** A new Tier-2+ matrix node that only activates when **two different** abilities are simultaneously routed into it (e.g., JUMP + PHASE_SHIFT together), producing a third combined effect not achievable by either alone — e.g., "Blink": an instant 3-hex teleport that ignores both obstacles *and* phase barriers for 1 AP.
**Why exciting:** Every ability in the game today is evaluated independently (`AbilitySystem` §5.6, one flag per ability). Convergence Nodes are the first mechanic to reward *combining* routes rather than just completing them individually — a genuine combinatorial-depth increase using zero new hex-grid content, purely a Matrix-topology idea. It also gives advanced players a reason to route power to two full ability chains simultaneously, a real matrix-real-estate tension that doesn't exist yet (currently, routing more abilities than a level strictly needs has no cost beyond the AP already spent to get there).
**Compatibility:** By construction, combos with *every* existing ability pairwise (JUMP+PUSH, RED+PHASE, FIRE+BLUE, etc.) — the strongest "combinatorial" pick on this list, and the most natural vehicle for finally giving PUSH (#2/F3) and PHASE_SHIFT (F4) real synergy content once both have proper teaching levels of their own.
**Narrative fit:** `narrative.md §3` already frames the Matrix as the *one place* the Id and Superego still connect — a node that only fires when both minds' abilities arrive together is the most literal possible expression of that idea: neither fragment's power alone is enough, only their convergence completes the thought.
**Suggested entry point:** Late in a post-20 arc, once at least 4–5 of the 6 existing abilities have solid individual teaching (addressing F4 first) — Convergence Nodes are a *capstone* idea, most rewarding once the base vocabulary is fully learned.

---

## Summary Table

| # | Mechanic | Touches | Compatibility highlight | Narrative anchor |
|---|----------|---------|--------------------------|-------------------|
| 1 | Synaptic Fatigue | AP/ability economy | Jump, Phase/Fire, (future) Resonance | Overused thought, mental strain |
| 2 | Impulse Blocks | Hex-grid physical space | Jump, Fire/Laser; activates dormant PUSH | Repressed clot / logic block |
| 3 | Echo Tiles | Cross-dimension information | Threshold, Pulse Gates | The one other thin place between minds |
| 4 | Pulse Gates | Timing/rhythm | Jump, Fatigue | Automated protocols, vital-sign pulse |
| 5 | Scar Tissue | Persistent world state | Airlock-style traps, Push | Trauma landmarks, coma scarring |
| 6 | Bruised Fragments | Risk/failure gradient | Fire/Laser/Chasm, Fatigue | Wounded but not destroyed |
| 7 | Short Circuit | Matrix-topology chaos | Pulse Gates, Bruised Fragments | Neural seizure event |
| 8 | Focus Vault | Optional cooperative reward | Distributes any scarce content | Confronting trauma together, unforced |
| 9 | Static Field | Communication itself | Pulse Gates, Short Circuit | The mind's own silence, literalized |
| 10 | Convergence Nodes | Ability combinatorics | All abilities pairwise | Two minds' power completing one thought |

**Cross-cutting recommendation:** items **2 (Impulse Blocks)** and **8 (Focus Vault)** are the safest first picks — both are additive-only (no existing level's solvability proof changes), both are cheap relative to the others (Impulse Blocks reuses fully-built dormant code; Focus Vault reuses the `APUnlockSystem` trigger pattern), and neither requires Part 1's F1 (Resonance) to be resolved first. Everything else on this list is a genuine "pick for the team," not a ranked queue — presented deliberately unranked beyond that one practical note, since the actual choice is a design-taste call for Till, Andreas, and Chris together.
