# The Body: A Meta-Progression Layer (Concept)

> **Status: Concept only — nothing implemented.** This document exists to be built on, not to be built from directly. It has not been reviewed by Andreas or Chris. Per this project's own governance rule (`decisions_needed.md`), a structural/content commitment this size should get a team sign-off before any sprint targets it — see §11.
>
> **Revision (2026-07-23b):** Rescaled for a **100-level campaign** (up from the 29 shipped so far), guaranteed a story beat on every one of the first 10 levels, and added three sections Till asked for explicitly: exact player-role narration (§4), a visual-consistency plan for AI-generated art (§9), and a code-driven (not re-generated) approach to highlighting body regions (§10). Supersedes the milestone table and Fork mechanics of the previous revision.

**Trigger:** Till (2026-07-23): give the puzzle-solving a visible "why" by showing the comatose patient's body gradually waking up as levels are completed. Follow-up (same day): scale this to a planned 100-level campaign, guarantee a story beat in each of the first 10 levels, spell out exactly what each of the two players narratively *does* to bring back a body function, keep AI-generated art pixel-art-consistent and small, and find a way to highlight/mark body regions (active/done) without breaking that consistency.

---

## 1. Thematic Fit (why this isn't a bolt-on)

- **The two-dimension asymmetry already splits "instinct" from "logic"** (`narrative.md §2`): the Id is the gatherer, driven by instinct; the Superego is the orderer, driven by rules. Till's own example — "first Arm, then movement-mechanics" vs. "first Eye/Ear, then perception-mechanics" — maps directly onto this existing split.
- **The campaign is already organized into named mechanic-introduction blocks** (`level_design.md §5`). Body-region milestones ride these existing block boundaries for the shipped portion of the campaign (L1–29) instead of inventing a new schedule from scratch.
- **Neuro-Resonance is literally neurotransmitter chemistry** (`mechanics.md §4.5`) — already the deepest, most-recently-taught mechanic (L26–29). A ready-made "the nervous system is reconnecting" beat, positioned exactly where a pre-consciousness milestone belongs.
- **The Monitor is the one existing exception to the wordless world** (`narrative.md §5.2b`): its CRT text carries clinical dialogue while family/patient content stays silent-panel-only — matches Till's "doctors and family speak" ask without breaking the language-agnostic rule.
- **The solver and level content are untouched by any of this.** Every idea below is a meta/UI layer read from `ProgressionState.completedLevels` — it changes nothing about how a level plays or is proven solvable.

## 2. Scaling to 100 Levels

Levels 1–29 are shipped and solver-proven; their block structure and body-region mapping (§3) stay fixed. Levels 30–100 (71 levels) don't exist yet — this document only sketches the **Act structure and milestone cadence** they should hang narrative beats on, not their actual puzzle content (that's a separate, much larger design effort, out of scope here).

Overall shape for 100 levels:

- **~12–13 body regions total**, front-loaded (finer granularity in Act 1) and back-loaded in weight (the last region — Head/Consciousness — is by far the most gated).
- **Region-unlock spacing widens as the campaign progresses**: roughly every 5 levels in Act 1, widening to roughly every 10–15 levels by the late game. This mirrors ordinary game pacing (dense tutorialization early, bigger uninterrupted stretches later) and matches `level_design.md`'s own existing note that post-MVP levels get "larger hex grids... long-horizon AP planning" — bigger levels naturally take longer between story beats anyway.
- **Vignettes (small, non-milestone story images, §5) fill the gaps between region-unlocks**, especially where Till specifically asked for density: every one of the first 10 levels gets *something* — either a vignette or a region-unlock — never a silent gap.

## 3. Body Region Schedule

### Act 1 — Reflex (L1–15), one story beat every level for L1–10

| After level | Beat | Type |
|---|---|---|
| Prologue (before L1) | Flatline → Split → Wisps | Existing opening panels (D13) |
| L1 | "Day 1" — EEG monitor flickers | Vignette |
| L2 | A nurse notices something on the chart | Vignette |
| L3 | A doctor is called to the room | Vignette |
| L4 | Family at the bedside, silent | Vignette |
| **L5** (end of *The Basics*) | **Fingers/toes** — involuntary twitch | **Region unlock** |
| L6 | Monitor log: "Day 4. Motor cortex activity, low but present." | Vignette |
| L7 | Night shift, monitor beeping steadier | Vignette |
| L8 | A specialist is consulted — first hint the story is bigger than one patient | Vignette |
| L9 | Family member reacts, cautiously hopeful | Vignette |
| **L10** (end of *The Shift*) | **Hands/forearms** — grip returns | **Region unlock** |
| L13 | (sparser now — first 10 are the guaranteed-dense window) | Vignette |
| **L15** (end of capstone block) | **Feet/legs** — withdrawal reflex | **Region unlock** |

That's 10 distinct story beats across levels 1–10 (2 region unlocks + 8 vignettes) — every single level in that window carries a piece of story, per Till's explicit ask.

### Act 1, continued (L16–29 — already-shipped content)

| After level | Region | Why here |
|---|---|---|
| **L21** (first level requiring 2 simultaneous Shared Unlocks) | **Face/mouth** — first coordinated micro-expression | The campaign's first *mandatory* two-player coordination moment reads as the patient's face twitching in sync |
| **L23** (Focus Vault — optional hyper-attention mechanic) | **Ears** — startle response to sound | Focus Vault is literally about perceiving more than strictly necessary |
| **L25** (Echo Tile — seeing the other dimension's board) | **Eyes** — flutter open, unfocused | Echo Tile is literally a seeing-across-dimensions mechanic |
| **L29** (all four Neuro-Resonance pairs demonstrated) | **Torso/nervous system** | Chemistry reconnecting below the level of thought — the last pre-conscious milestone |

### Acts 2–5 (L30–100 — not yet built; Act/cadence skeleton only)

| Act | Levels | Region(s) | Notes |
|---|---|---|---|
| Act 2 — Voice | 30–45 | **Voice/throat** at ~L45 | First sounds/groans; new mechanics from `mechanic_roadmap.md`'s remaining proposals |
| **The Fork** | ~46–48 | — (choice, not a region) | See §4a below — narrated in the Body screen, not a gameplay branch |
| Act 3 — Chosen Track | 49–75 | **Full limb mobility** (motor track) *or* **Language/comprehension** (perception track) at ~L75 | Only the *chosen* track's region unlocks this playthrough — see §4a |
| Act 4 — Convergence | 76–90 | **Whole-body coordination** at ~L90 | Both dimensions' progress reconciles regardless of which track was chosen |
| Act 5 — Consciousness | 91–100 | **Head/consciousness** at ~L100 | Gated behind every prior region — matches the existing narrative arc "confrontation with trauma → emergence" (`narrative.md §5.2`) |

This table is a pacing proposal, not a level-by-level design — levels 30–100 need their own design pass; only the milestone rhythm is fixed here.

## 4. Player Roles in the Recovery (exact, per Till's ask)

No new mechanics are proposed here — every region-unlock is narrated entirely through what the two players *already* do every level. This is deliberate: the fiction should be a lens on the existing shared-Matrix loop, not a promise of new asymmetric rules (D14 remains separately unresolved).

- **Player 1, the Id — the impulse.** Conduit plates are, in-fiction, raw neural impulses (`narrative.md §2`: "impulses surface in its flesh; it feels where resources lie"). Player 1 finding and collecting a plate *is* the moment a dormant reflex arc sparks — a stray nerve firing before there's anything coordinated to show for it. In vignette terms, this alone is only ever an EEG blip or an involuntary flinch: real, but not yet a function.
- **Player 2, the Superego — the circuit.** A spark alone fades. Player 2's Insert/Rotate actions, run through the shared DNA Matrix, are what give that impulse a stable, repeatable pathway (`narrative.md §2`: "the Superego imposes structure on what the Id unearths"). This is the moment a twitch becomes a *function* — not a one-off, but something the patient's body can reliably do again.
- **Together, and only together.** Because both players route through the same Matrix (`mechanics.md`'s existing "shared mutation" principle), no region wakes from either player's actions alone. This is precisely why every region-unlock in §3 lands on a **level completion** (both exits reached) and never mid-level: the game's existing win condition already *is* the fiction's "successful reawakening" moment. Nothing new needs to be built for this to be true — it already is.
- **Flavor shifts with region type, not mechanics.** Early motor regions (fingers, hands, legs) read as "Id sparks first, Superego stabilizes it." Later sensory regions (eyes, ears) read as "Superego structures first, Id makes it felt" — same two roles, different narrative emphasis, zero gameplay change either way.
- **What doesn't change:** both players still gather *and* route every level, exactly as today. The story reframes the existing loop; it does not require Player 1 to stop routing or Player 2 to stop collecting.

### 4a. The Fork, narratively

At ~L48, the Body screen (not a level) offers a one-time choice: which fragment's *contribution* gets foregrounded for the next act — **Id-led (Legs / motor-flavored new mechanics)** or **Superego-led (Voice / perception-flavored new mechanics)**. This is framed as *emphasis*, not exclusivity — both players keep playing both roles as in §4.

**Recommended default — a soft fork:** the level *sequence* stays linear (levels 49–75 are the same levels regardless of choice; no alternate level-ID branches, no change to `LevelSelectScreen`'s existing linear unlock rule). What changes is: (a) which of the two Act-3 regions (Full Limb Mobility vs. Language/Comprehension) unlocks for *this playthrough*, and (b) the vignette flavor/imagery for that stretch. The **untaken track's region stays visibly dormant** on the Body screen for that save — a deliberate, low-cost replay hook (a second playthrough choosing the other option reveals the other region), consistent with Till's original "no two playthroughs alike" ask, without needing a real branching level graph.

A **structural fork** (true alternate level sets that reconverge) is a possible later upgrade — flagged in §11 as a bigger, separate decision, not assumed here.

## 5. Narrative Delivery: Vignettes vs. Region-Unlocks

Two distinct beat types, both silent (no text except the Monitor's existing CRT exception):

- **Region-unlock beats** (§3): the body silhouette reveal, a state change that persists (a region stays "awake" forever after).
- **Vignettes**: small, one-off illustrated moments — a hospital corridor, an OR door, the bedside monitor, a doctor's or family member's hands — that don't change any body-region state. These are what guarantee "always a piece of story" in the dense first-10-level window (§3) without needing a full region to unlock every single level.

**Variant selection** reuses the project's existing seeded-generation vocabulary (`generative_levels.md`) rather than inventing new infrastructure: a `storyVariant` index (0–9) is chosen once at save-file creation and persists for that playthrough, so every beat (vignette or region-unlock) during that playthrough draws from the same variant.

**Content-budget flag:** 10 variants × ~13 regions × (vignettes + region art) is a large content commitment once scaled to 100 levels. §11 recommends explicitly scoping this down for a first pass (e.g., 3–4 variants, or shared vignette art across variants with only text/Monitor-log differing) rather than committing to 10 up front.

## 6. Visual Style Register: A Third Palette

The game's existing art direction (`docs/art_and_ui.md`) is deliberately **not** clean or clinical — even the Superego's "hospital" dimension is heavy, decayed, oppressively lit ("Medical Macabre Diorama"). Hospital/doctor/family vignettes are neither the Id's palette (purples/crimson/bone) nor the Superego's (blues/steel/glass) — they depict **outside reality**, the same register the Monitor already occupies (`narrative.md §5.2b`, "the one voice outside the mind"). Recommend a **third, desaturated "clinical reality" palette** — muted greys/greens, harsh fluorescent white, the same heavy vignetting and diorama framing as the rest of the game, just without either dimension's stylization. This keeps vignettes visually distinct from both boards (so players never mistake a story beat for gameplay) while staying on-brand with the game's established mood.

## 7. Keep Images Small and Pixel-Consistent

Till's ask: small images, not large ones, and pixel-art consistent with the rest of the game. The existing pipeline already supports this directly (`docs/art_pipeline_roadmap.md`):

- The game achieves its pixel-art look via **post-processing**, not a fixed native low resolution: `postprocess.py --pixelate N` (box-filter downscale + nearest-neighbor upscale), plus `PixiDriver` forcing `nearest` texture scaling on everything loaded. Vignette/region art should go through the exact same step — same tool, same look, zero new pipeline.
- Existing precedent for "generate large, display small": icons are worked on a 300px canvas and decals on a 768px canvas, both ultimately rendered at the game's actual small on-screen scale (80px/hex). Vignettes should follow the same shape: generate at a comfortable working resolution, pixelate, then **display small** — a thumbnail roughly hex-tile scale, not a full-screen splash. This directly satisfies "eher kleine Bilder als zu große."

## 8. Character & Scene Consistency for AI-Generated Vignettes

This is a real, already-acknowledged difficulty in this project — the art pipeline roadmap documents fighting model drift even for simple single-subject icons (`art_pipeline_roadmap.md`, avatar/panel/plaque drift notes). A recurring cast (the same doctor, the same family member) across dozens of vignettes needs more than "prompt it again":

1. **Build a small, fixed cast reference sheet once** — Patient, Doctor, Nurse, 1–2 family members — generated carefully a single time, then treated as a **permanent asset**, never regenerated from scratch per vignette. This mirrors how the game already treats sprites: assets are made once and reused, not re-derived per use.
2. **Condition every subsequent vignette generation on that fixed reference set** (IP-Adapter-style image conditioning, or the locked-prompt-template approach `art_pipeline_roadmap.md §4.3` already uses as tier 1) — the same effort-ranked consistency ladder the existing pipeline already climbs for the Id/Superego dimensions, just applied to a third "clinical reality" cast instead of a dimension.
3. **A trained style/character LoRA** is the existing roadmap's own highest-leverage, not-yet-built option (`art_pipeline_roadmap.md §4.3`) — worth reusing for this cast specifically if reference-image conditioning alone drifts too much across ~100 vignettes.
4. **Favor partial framing over full detailed portraits** — hands at a bedside, a coat's silhouette in a doorway, a monitor screen's reflection — rather than full detailed faces. This is not a compromise: it's *already* this game's established visual language (heavy vignetting, diegetic framing, `art_and_ui.md §1`), and it happens to be the cheapest possible fix for AI character drift, since a partial silhouette drifting is far less noticeable than a full portrait drifting.

## 9. Highlighting Body Regions Without Re-Generating Art

Till's specific technical ask: how do you use AI-generated art for a schematic body diagram *and* still systematically mark individual regions as locked/active/done?

**Answer: don't ask the image generator to draw the states. Generate exactly one clean body silhouette, once, and do all "active"/"done" highlighting in code — reusing two systems this project has already built and proven:**

1. **One base image.** A single, front-facing, neutral-pose, symmetrical pixel-art body silhouette (clinical-reality palette, §6) — generated once, treated as a fixed permanent asset, never regenerated.
2. **Regions are a code-defined lookup table over that image's fixed coordinate space** — exactly the pattern already used for the DNA Matrix's own highlight geometry: `cellRect`, `insertArrowRect`, `matrixPanelRect` in `src/rendering/MatrixRenderer.ts` are pure arithmetic over a fixed coordinate space, not separate art per cell. A `BODY_REGIONS: Record<BodyRegion, {x,y,w,h}>` table (hand-authored once, against the one fixed image's pixel coordinates) does the same job here.
3. **State (locked / just-unlocked / done) is rendered via the exact overlay technique `src/tutorial/TutorialOverlay.ts` already implements**: an SVG mask dims/desaturates everything except the relevant rect(s), and a separate pulsing `<rect>` frame highlights the active target — pure CSS/SVG attribute toggling, re-evaluated live, no new rendering technology. Applied here: locked regions stay dimmed/desaturated, the region *just* unlocked gets the pulsing frame treatment, already-awake regions get a persistent subtle tint.
4. **Consequence: exactly one image ever needs to be AI-generated for this entire feature.** The consistency problem from §8 doesn't even apply to the body diagram — it's a HUD/diagram element like the Matrix panel, not a narrative image, so it should be built like one: one asset, code-driven state, forever.
5. **If a reveal "juice" moment is wanted** (a glow/particle burst when a region newly wakes) — implement it as a CSS/SVG animation over the fixed mask, reusing this project's existing one-shot FX conventions (SPRINT_010's ECS FX system already does exactly this kind of moment for gameplay events), not a new generated image.

## 10. ECS & Architecture Integration

Till specifically flagged: use the established ECS, don't invent new infrastructure.

- **This is meta/UI-layer state, not per-tick simulation state — so it should *not* become a new bitECS component.** The codebase draws this line clearly: `APPool` gets a real ECS component only because a renderer needs to query it every tick via bitECS's query machinery and it rides the host→guest network sync wire format. Campaign/meta state read only at level-transition boundaries — `ProgressionState.ts`'s category — stays a plain exported TypeScript state object. Body-awakening state fits the second category exactly.
- **New module: `src/state/BodyState.ts`**, following `src/state/ProgressionState.ts`'s shape exactly (in-memory object + `localStorage` round-trip). Proposed shape:
  ```ts
  { unlockedRegions: Set<BodyRegion>, storyVariant: number, forkChoice?: 'motor' | 'sense' }
  ```
- **Milestone → region mapping is a small static lookup**, mirroring `src/levels/levelIndex.ts`'s `LEVEL_NAMES` pattern — no new field on `LevelDef`, no schema/solver changes. Proposed: `src/levels/bodyIndex.ts` exporting `BODY_MILESTONES: Record<string, BodyRegion>`.
- **Unlock computation is a pure function** over `ProgressionState.completedLevels` — `computeUnlockedRegions(completedLevels): BodyRegion[]` — called wherever `advanceToNextLevel` already runs. No new system, no new query.
- **The Body screen is a new full-screen DOM overlay**, following `LevelCompleteScreen.ts`/`LevelSelectScreen.ts`'s existing convention exactly (plain DOM/CSS, not Pixi, not ECS-driven). Auto-opens once per newly-crossed milestone; `LevelSelectScreen` gains a persistent "check on the patient" entry point to revisit anytime.
- **Net result: zero new ECS components, zero new systems, zero changes to `pipeline.ts`** — the same "presentation-only, outside the deterministic tick pipeline" reasoning already used for `TutorialDirector`/`RenderSystem` applies here.

## 11. Open Questions / Recommended Governance

This reshapes campaign structure and commits real art/story budget — per this project's own rule in `decisions_needed.md`, this should get a numbered entry there (proposed **D16**) before a sprint targets it. Open items:

1. Exact milestone schedule (§3) and Act 2–5 pacing for the not-yet-designed levels 30–100 — proposals, not final.
2. Story-variant count: 10 as asked, or scoped down first (§5)?
3. Who authors the cast reference sheet, vignettes, and body silhouette (Andreas, most likely, per his existing panel-concept lead role from D13)?
4. Soft fork (§4a, recommended default) vs. a real structural fork with alternate level branches — the latter needs a separate, bigger decision about `LevelSelectScreen`'s unlock model.
5. Does the Fork's mechanic-flavor promise commit to specific new `mechanic_roadmap.md` proposals now, or stay abstract until those are picked?
6. The jump from a 29-level to a 100-level campaign is itself a large, separate content commitment (71 new levels) that this document assumes but does not scope — worth its own decision entry independent of the body-awakening feature.
