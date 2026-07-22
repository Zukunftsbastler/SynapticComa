---
name: generate-sprite
description: Generates style-locked candidate artwork for Synaptic Coma (the Medical Macabre Diorama look, docs/art_and_ui.md) using Draw Things running locally via draw-things-cli — no cloud, no GUI interaction needed. Applies the correct Id/Superego/Matrix material-and-color preset automatically from a SpriteId or asset description, generates a small seed batch, and post-processes icons to a transparent square canvas. Use whenever asked to draft, generate, or iterate on sprite/icon/background art for this project.
---

# generate-sprite

## What this is for

Producing candidate artwork for Synaptic Coma. The sprite/texture rendering pipeline is live (`docs/art_pipeline_roadmap.md` §3) — a promoted asset shows up in the running game automatically (see "Promoting a candidate" below). This skill's job is: produce good, on-style, on-*resolution* candidates into a staging folder for a human pick.

**Resolution is not a detail — read this before generating anything.** A hex tile renders at roughly 80px on screen (`SPRITE_SIZE` in `RenderSystem.ts`). Photoreal, high-frequency detail (individual veins, tiny bone fragments, fine scratches) generated at 512–1024px and downscaled that hard just turns into visual mush — confirmed the hard way, 2026-07-21, after Till caught it running in the actual browser (something no build/test/typecheck check would ever surface). The house style for tile-scale assets is now **deliberately low-fi/pixelated**, produced by `postprocess.py --pixelate N` (downscale to an N×N grid, NEAREST back up) — see "Post-processing" below. This only works if the *source content* is simple and fairly uniform to begin with (see the content-density rule in the floor-tile framing clause); pixelating an already-busy, high-detail image just turns it into colorful noise, not clean pixel art — regenerate simpler content first if that happens.

Full background, model choice, and licensing reasoning: `docs/art_pipeline_roadmap.md` §4. Read it if something here seems to need adjusting — this skill is meant to encode that document's conclusions, not override them.

## Prerequisites (already set up as of 2026-07-21)

- Draw Things installed (`brew install --cask draw-things`) and `draw-things-cli` (`brew install draw-things-cli`).
- Models downloaded: `flux_2_klein_4b_q8p.ckpt` (primary), `sd_xl_base_1.0_q6p_q8p.ckpt` (fallback).
- `python3` with Pillow (for `postprocess.py`).

If `draw-things-cli models list --downloaded-only` doesn't show the primary model, run `draw-things-cli models ensure --model flux_2_klein_4b_q8p.ckpt` first (auto-downloads).

## Style presets (locked wording — reuse verbatim, don't improvise the material language)

Every generation prompt is: `<preset material/color clause>, <content clause>, <framing clause>`. Never skip the preset clause — that's what keeps assets from the same dimension consistent with each other.

**ID (Dimension A / Player 1) preset clause:**
`organic tissue, bruised velvet and aged leather, jagged obsidian and yellowed bone, deep purple and pulsing crimson lighting, visceral and heavy, thick etched material`

**SUPEREGO (Dimension B / Player 2) preset clause:**
`tarnished surgical steel and frosted glass, brushed aluminum, cold clinical blue and icy fluorescent white lighting, sharp rigid geometry, thick etched metal, visible rust and neglect`

**MATRIX / NEUTRAL (shared DNA Matrix pieces — conduit plates, matrix node housing) preset clause:**
`heavy vintage Bakelite or clouded glass, warm amber worn plastic, deep-cut grooves, neutral museum-specimen-tray lighting, no strong color bias toward either purple or blue`

**Shared negative prompt (always pass this via `--negative-prompt`):**
`text, watermark, blurry, photo, human face, realistic person, low quality, extra limbs, cropped, signature`

**Icon framing clause** (append for discrete game-piece sprites — avatars, hazards, conduit plates, matrix nodes, walls, exits):
`small square hex-tile game icon, floating isolated object only, no frame, no panel, no plaque, no plate, no background surface, centered composition, plain solid black background, no text`
Negative prompt adds `frame, panel, plaque, plate, border, background surface, background plane, box, mounting plate` beyond the shared negative.

**Own-panel finding (2026-07-22):** the ID/SUPEREGO material presets ("aged leather," "brushed steel/aluminum") reliably bait the model into rendering the icon *mounted on its own matching square panel/plaque* (leather square with rivets, steel square with beveled edge) instead of floating on plain black — the same failure as the decal background-strip problem, just for icons. Confirmed on avatars and hazard doors; assume any new icon asset is at risk until proven otherwise. The `--no-key-black`-free postprocess (default black-keying) removes true black cleanly but leaves a visible fringe/ghost square where the panel was dark-but-not-quite-black — always add the explicit isolated-object language above rather than relying on keying to hide a panel.

**REVERSED, 2026-07-22 — almost everything is a floating prop over a regular floor tile, not a hex-filling texture.** The hex-mask approach documented here the same day didn't survive contact with Till actually looking at the board: baking a hazard/door/exit's own material into a full-hex texture made that hex look categorically different from its neighbors — "ein harter Bruch... als würden sie nicht zum restlichen Spielbereich gehören." The rule now: **every special-tile sprite must have a genuinely transparent background and read as an object sitting ON a regular floor tile**, so the ordinary floor art (with its own multi-variant randomness) always shows through underneath, exactly like avatars already did. Concretely:
- Content clause: describe the subject **alone, in isolation**, not "a door"/"a wall segment" (those words drag in a real-world "mounted on its own plaque/panel" prior no amount of "no panel" negative fully suppresses — confirmed repeatedly on `HAZARD_LOCKED_RED`). Reword to the isolated *object* itself: not "a locked door" but "a circular fleshy sealed orifice wrapped in thorns"; not "a wall segment" but (for the two remaining hex-filling exceptions below) full-bleed material only. Add `small isolated object floating alone in empty void, nothing else in frame, no background element of any kind` and negative-prompt `floor, ground, surface, strip, cushion, mount, backing, square` on top of the anti-panel language above.
- Postprocess with black-key (default) + `--autocrop-margin 0.35` (crops to the actual content's bounding box first — otherwise a modestly-sized subject ends up tiny in the middle of a mostly-empty 512px frame, confirmed on `focus_node`/`hazard_phase_barrier`) + `--radial-fade` (a code-side **guarantee** of a soft transparent edge regardless of whether the model fully complied — see `postprocess.py`'s `radial_fade()`; this is the actual fix for the "own panel" prior, not just better prompting). Do **not** use `--hex-mask` for these — that was the mistake.
- **`ECHO_TILE` is the one remaining structural exception** that legitimately IS the whole hex, not a marking on top of one — a floor-tile *variant*, conceptually replacing the floor's look for that hex, not an object placed on it. Keeps the full-bleed `--no-key-black --hex-mask` treatment. Everything else — both locked doors, both lethal hazards, both fire variants, phase barrier, both exits, focus node, both AP unlock node variants, both wall variants, pushable block, both avatars — is a floating isolated icon over an ordinary floor tile.
- **Some SpriteIds got a same-shape, opposite-material A/B split later (2026-07-23)** — `HAZARD_FIRE`, `WALL_HEX`, and `AP_UNLOCK_NODE` all started as one shared sprite for both dimensions; Till asked for each to differ by dimension (bone vs. steel-plate walls, infection vs. molten-metal fire, and — the interesting one — the unlock node styled as the *other* dimension's material specifically, so it visually reads as a gift crossing between the two minds). Splitting one of these later is a code change, not just an art one: add the second `SpriteId`/`SPRITE_PATHS` entry, then update every entity factory that assigns the sprite (`grep` the old identifier across `src/entities/` — `tsc` will flag every remaining reference to the old name if you rename rather than add).
- **A fuzzy/feathered edge is required on every one of these, not just a transparent one (2026-07-22).** `--radial-fade` alone still leaves the underlying silhouette's own edge (from black-keying) hard/aliased — good enough for "no visible panel," not good enough for "blends into the floor tile it sits on." Always follow with `--feather PX` (Gaussian-blurs the alpha channel only, keeping the visible pixels' color crisp) — see `postprocess.py`'s `feather()`. `--feather 6` at `--size 300` was the working value across every special-tile icon and the (also feathered, 2026-07-22) multi-hex decals.
- **Color must be unambiguous where the color IS the meaning (2026-07-22).** `HAZARD_LOCKED_RED`/`HAZARD_LOCKED_BLUE` read as "clearly red"/"clearly blue" only after a code-side fix — the model's own material tones (aged leather → muted plum, steel → gray) don't reliably pop enough on their own, and re-rolling seeds hoping for more saturated output isn't reliable either. `postprocess.py`'s `recolor_toward()` locks hue and floors saturation for pixels that already carry real color (skipping near-neutral pixels — metal rivets, bone — so they don't *also* turn red/blue and stop reading as their own material). For naturally dark/desaturated materials like brushed steel, saturation alone isn't enough either — flooring saturation on a dark pixel just produces a dark, muted "navy blob" that still doesn't register as "blue" at a glance; also pass `--recolor-min-value` to floor brightness (confirmed needed on `HAZARD_LOCKED_BLUE`, not needed on the already-bright `HAZARD_LOCKED_RED` velvet/flesh tones).
- **A door's shape should itself suggest "you cannot pass" (2026-07-22).** Content clauses that read as "sealed/mysterious" (a wreath-wrapped ring, a spoked lock wheel) don't read as clearly *impassable* the way an explicit barring element does. Both locked-door hazards were reworded around a heavy X-crossbar / bolted-crossbar-and-padlock motif specifically for this — "unmistakably barred and impassable" in the prompt, not just "sealed."
- **Baked-in glow/danger doesn't survive this treatment — make it a real-time effect instead.** `AP_UNLOCK_NODE`'s first draft had its own radiant halo painted into the art, which bled past any reasonable black-key/radial-fade boundary (there's no clean edge to a glow). Fixed by regenerating the art as a plain matte object with **no glow at all** (`no light, no glow, no radiance, no halo` in both prompt and negative), and moving the "this is special" signal to a genuine animated effect layered on top at render time (`RenderSystem.ts`'s `pushPulseRings` — concentric fading ring outlines, `DrawRingCommand` in `RenderCommandBuffer.ts`). The fire hazards got the same treatment for a different reason (2026-07-23, Till: "wirklich gefährlich aussehen... flirrender Hitze und flackernden Flammen") — a static sprite can't sell "dangerous" no matter how good the art is, so `RenderSystem.ts` now flickers the sprite's own alpha/scale irregularly (`fireFlickerAlpha`/`fireFlickerScale`, two unrelated sine frequencies so it doesn't read as a metronome) and spawns small rising embers (`pushFireFlicker`) on top, all wall-clock-driven like the pulsing rings. Apply this pattern to any future "glowing" or "actively dangerous" special tile rather than re-attempting to bake motion into a static image.

**`--pixelate`: only for the two full-bleed hex-filling exceptions, and only when content is genuinely uniform/distributed edge-to-edge (2026-07-22).** Tried applying the floor tiles' `--pixelate 20` uniformly to every hex-filling asset before the reversal above — it wrecked anything with detail concentrated in one place rather than spread across the whole frame (a locked-door icon centered on a mostly-empty panel, a corner-clustered hazard) into unrecognizable mush, because the few blocks landing on the actual subject average it away. Isolated floating icons (the new default for almost everything) skip `--pixelate` entirely — tested on `AVATAR_P1`, came out as an unrecognizable blob at `--pixelate 20`; the `scaleMode: 'nearest'` already set on every texture in `PixiDriver.ts` gives icons a slight blocky edge for free at actual render size without needing to pre-degrade the source.

**Floor-tile framing clause** (append for `HEX_ID_FLOOR`/`HEX_SUPEREGO_FLOOR` specifically — these are also per-hex sprites, not a shared background, see §1's decision record in `docs/art_pipeline_roadmap.md`):
`a uniform expanse of <base material>, subtle mottled variation, minimal detail, no distinct objects, no fine texture, smooth gradients, flat surface viewed directly from above, top-down orthographic view, full-bleed seamless texture filling the entire frame edge to edge, no walls, no ceiling, no perspective, no horizon, no vanishing point, no icons or game pieces, no text`
Negative prompt adds `wall, ceiling, room, perspective, horizon, corridor, vignette, border, frame, black background, distinct objects, fine detail, noise, clutter` beyond the shared negative below.

**Content density rule (2026-07-21):** floor tiles must describe a *uniform, low-detail base material* — NOT the busy multi-object scenes the icon presets use elsewhere (dense veins, scattered bone fragments, etc.). A tile repeats across many hexes; a uniform base reads as "a landscape" on repeat, a busy one reads as "the same stamp copy-pasted" ("Matsch aus immer gleichem Muster" — Till's words, and correct). Distinct props (a bone, a vein cluster, a rivet) now live as *decals* — multi-hex overlay art, randomly scattered on top, not part of the tile itself — see "Decals" below.

**Flat lighting rule (2026-07-21) — as important as content density.** Even a uniform-*content* tile can still fail if its *lighting* isn't uniform: a texture with its own per-tile highlight/gradient (bright center, dark edges — looks fine as a single image) repeats into what reads as a grid of individually-lit lamps/orbs once tiled ("Lampen-Cluster" — the Superego tile's exact failure). Always include explicit flat-lighting language for tiles: `uniformly lit from all directions, completely flat shading, no directional light, no highlight, no gloss, no hot spot`, and add `gradient, highlight, bright spot, hot spot, gloss, shine, reflection, glowing, light source, spotlight, radial` to the negative prompt. This matters more for material presets that read as glossy/reflective (steel, glass) than matte ones (velvet, leather) — the Id tile never had this problem.

**Even a perfectly uniform, flat-lit single tile still reads as "the same stamp" once repeated enough times** — no amount of within-tile perfection escapes this by itself. Two structural answers, both built (`docs/art_pipeline_roadmap.md` Phase 1): multiple tile variants picked per-hex (below), and the decal overlay (further below). Use both together where repetition is visibly a problem; a dimension where repetition is *thematically fine* (Till: Superego suits a repeating mechanical pattern) doesn't need multiple tile variants, just the flat-lighting fix.

## Shape & framing notes

**Do NOT ask the model to draw the hexagon shape itself** (see the finding below for why) — the content clause should describe a flat material/texture filling the whole square, never "a hexagonal tile" or "hexagon silhouette." The hexagon comes entirely from `postprocess.py --hex-mask` afterward.

**Full-bleed / narrative-panel framing clause** (append for Phase 5 opening/between-level illustration panels — the one remaining true full-bleed-scene use case):
`full-bleed illustration, no frame, no vignette border, no icons or game pieces, no text`. If the content is architectural/interior in nature, also add the top-down lesson below.

**Found the hard way (2026-07-21):**
- Without explicit top-down/no-perspective language, the model happily generates a full 3D room with walls, a ceiling, and a vanishing point for anything described as "a clinical laboratory" or similar architectural language. Fine for a narrative panel (which is *supposed* to be a scene), useless for anything meant to sit flat under/as part of the hex grid — always add explicit top-down framing for floor tiles and any Superego-preset content that risks reading as architecture.
- **Never ask the model to draw the hex silhouette itself.** First attempt asked for "a hexagonal tile, hexagon silhouette... plain black background outside the hexagon" — the model reliably drew an **octagon** on black, not a true 6-sided hexagon (confirmed both dimensions). Cropping that octagon with `postprocess.py`'s exact hex mask didn't fix it either: the mask's flat-top hexagon has left/right vertices reaching the full image radius, farther out than the model's own octagon edge reaches in those directions — so the crop let the model's *black background* show through as visible wedges inside the hex frame, reading as "an octagon inside a hexagon." **The actual fix: stop asking the model for a shape at all.** Prompt for a full-bleed square material texture with content to every edge (same framing as a narrative panel, just square) — then `--hex-mask` cuts a clean hexagon out of real content in every direction, no black gaps possible since there's no black in the source to begin with. This is why the floor-tile framing clause above says "full-bleed... filling the entire frame edge to edge," not "hexagonal tile."

## Asset → preset lookup

Cross-reference `src/registry/SpriteRegistry.ts`'s `SpriteId` enum for the authoritative current list (it may have grown since this table was written — check it, don't assume this table is exhaustive).

| SpriteId | Preset | Content clause starting point |
|---|---|---|
| `HEX_ID_FLOOR` | ID, floor-tile framing | ✅ promoted, `public/sprites/hex_id_floor.webp` — scarred organic tissue, faint heat-map stains |
| `HEX_SUPEREGO_FLOOR` | SUPEREGO, floor-tile framing | ✅ promoted, `public/sprites/hex_superego_floor.webp` — scratched steel, faint ECG trace |
| `AVATAR_P1` | ID | ✅ promoted — a small chaotic wisp of jagged obsidian shards and coagulated resin, isolated floating object, no container/pouch/wrapping |
| `AVATAR_P2` | SUPEREGO | ✅ promoted — a small geometric structured spark of interlocking tarnished steel shards, isolated floating object, no frame/panel |
| `HAZARD_LETHAL_A` | ID | ✅ promoted — a small jagged cluster of blackened glass shards embedded in a torn flesh fragment, isolated floating object |
| `HAZARD_LETHAL_B` | SUPEREGO | ✅ promoted — two small rusted iron nodes with crackling arcs between them, isolated floating object |
| `HAZARD_LOCKED_RED` | ID | ✅ promoted — a circular fleshy sealed orifice wrapped in braided thorns, isolated floating object (avoid the word "door" — see the isolation note above) |
| `HAZARD_LOCKED_BLUE` | SUPEREGO | ✅ promoted — a heavy rusted circular vault lock mechanism with a spoked wheel, isolated floating object |
| `HAZARD_FIRE_A` | ID | ✅ promoted — a small severely inflamed infected wound, oozing pus, isolated floating object. Animated (`RenderSystem.ts`'s `pushFireFlicker`/`fireFlickerAlpha`/`fireFlickerScale`) — reworked 2026-07-23 from a literal-flame version Till judged narratively off (a medical-macabre game reads infection better than campfire) |
| `HAZARD_FIRE_B` | SUPEREGO | ✅ promoted — a small pool of glowing molten metal slag over cracked steel, isolated floating object. Same animation as `HAZARD_FIRE_A` |
| `HAZARD_PHASE_BARRIER` | MATRIX/neutral | ✅ promoted — a small ghostly iridescent veil fragment, isolated floating object |
| `CONDUIT_STRAIGHT`/`CONDUIT_CURVED`/`CONDUIT_T`/`CONDUIT_CROSS`/`CONDUIT_SPLITTER` | MATRIX | a thick **flat rectangular** conduit plate, viewed directly from above, flat thin profile, NOT a cylinder, NOT a tube, with an etched [straight / curved / T-shaped / cross / three-way splitter] pipe groove. Straight + curved fixed and drafted 2026-07-21 (`artwork_tests/candidates/conduit_straight/seed7_fixed.png`, `conduit_curved/seed7.png`), not yet promoted; T/cross/splitter + powered-glow variant still open. Lives in the DNA Matrix tray UI, not the hex grid — the isolation/transparency rule above still applies (it's a UI icon, not a hex-filling texture) but it doesn't sit over a floor tile the way hex-grid entities do |
| `CONDUIT_UNKNOWN` | MATRIX | a face-down conduit plate showing only a generic ??? etched marking |
| `MATRIX_NODE_SOURCE`/`_ABILITY`/`_POWERED` | MATRIX | a matrix node housing socket, [dim / unpowered / glowing with viscous nerve fluid] |
| `EXIT_NEXUS_A` | ID | ✅ promoted — a small warm glowing circular portal in a fleshy ring, isolated floating object |
| `EXIT_NEXUS_B` | SUPEREGO | ✅ promoted — a small precise glowing portal in a brushed steel ring, isolated floating object |
| `AP_UNLOCK_NODE_A` | SUPEREGO (on the ID board) | ✅ promoted — a small precise steel-and-ceramic cube, isolated floating object, **no baked glow** (real-time pulsing-ring effect instead, `pushPulseRings`). Deliberately styled as the OTHER dimension's material (Till's ask, 2026-07-23: "etwas aus der anderen Welt übergeben" — the AP bonus is narratively a gift crossing between the two minds) |
| `AP_UNLOCK_NODE_B` | ID (on the SUPEREGO board) | ✅ promoted — a small organic bone-and-resin cube, same silhouette as `AP_UNLOCK_NODE_A` but the opposite material — same crossover concept, mirrored |
| `WALL_HEX_A` | ID | ✅ promoted — a small stacked pile of yellowed bone. Split from a single dimension-neutral version 2026-07-23 (Till's ask) |
| `WALL_HEX_B` | SUPEREGO | ✅ promoted — a small stack of heavy riveted steel plates |
| `PUSHABLE_BLOCK` | either | ✅ promoted — a heavy movable velvet clot with bone-chip flecks, isolated floating object |
| `FOCUS_NODE` | MATRIX | ✅ promoted — a small quiet violet hexagonal sigil, isolated floating object, **no baked glow** (same pulsing-ring treatment as `AP_UNLOCK_NODE`, violet instead of gold) |
| `ECHO_TILE` | MATRIX | ✅ promoted — a thin translucent teal double-exposure texture. **Structural exception:** stays full-bleed `--hex-mask` (a floor-tile *variant*, not a marking on top of one) — see the isolation note above |

For anything not listed (new mechanics, UI chrome, narrative panels — `docs/art_pipeline_roadmap.md` Phases 3–5), construct the content clause from the relevant doc section (`mechanics.md`, `narrative.md`) rather than guessing, and add the new row here once it's settled.

**Prompt-engineering lessons (2026-07-21):** the hazard tests (Id/Superego, both single-object hazards) came out excellent on the first seed. The conduit-plate test did not on the first try — the model rendered a cylindrical pipe plus a small stray secondary shape instead of a flat square plate, even though material/color read correctly — fixed by explicitly ruling out the wrong shape in the prompt ("NOT a cylinder, NOT a tube," "viewed directly from above"), now folded into the lookup table above. Don't assume every `SpriteId` will one-shot as cleanly as the hazards did — budget for at least one iteration per new asset type before calling it done.

## Generating a batch

For each asset, generate 3–4 seed variations rather than committing to the first result — diffusion output quality varies run to run, and the human pick is the one judgment call this skill deliberately does not automate away.

```bash
STAGING="artwork_tests/candidates/<sprite_id_lowercase>"
mkdir -p "$STAGING"
for SEED in 1 2 3 4; do
  draw-things-cli generate \
    --model flux_2_klein_4b_q8p.ckpt \
    --prompt "<preset clause>, <content clause>, <icon or background framing clause>" \
    --negative-prompt "text, watermark, blurry, photo, human face, realistic person, low quality, extra limbs, cropped, signature" \
    --width 512 --height 512 --steps 6 --seed $SEED \
    --output "$STAGING/seed${SEED}.png"
done
```

Use `--width`/`--height` 1024×1024 (or matching the intended aspect) for backgrounds/narrative panels instead of 512×512. `--steps 6` matched the model's recommended fast settings in the first style test (2026-07-21) and produced clean results in ~15–25s each including model load; raise it if a specific asset looks under-rendered.

## Post-processing

**Ordinary icons** (avatars, hazards, conduits, matrix nodes, walls, exits):
```bash
python3 .claude/skills/generate-sprite/postprocess.py \
  "$STAGING/seed${SEED}.png" \
  "$STAGING/seed${SEED}_processed.png" \
  --size 128
```
Keys near-black background pixels (threshold 12/255 per channel) to transparent and pads/centers onto a square canvas. This is the default recipe for tray-UI icons (conduits, matrix nodes) that don't sit over a hex floor tile. For every hex-grid entity except `ECHO_TILE` (see the isolation note above), use the full special-tile recipe instead — it adds autocrop, radial-fade, and feathering, which together make the "transparent edge, reasonably sized, blends into the floor" guarantee actually hold:
```bash
python3 .claude/skills/generate-sprite/postprocess.py \
  "$STAGING/seed${SEED}.png" \
  "$STAGING/seed${SEED}_processed.png" \
  --size 300 --autocrop-margin 0.35 --radial-fade --radial-fade-inner 0.6 --radial-fade-outer 0.92 --feather 6
```
`--autocrop-margin 0.35` crops to the actual content's bounding box (found via the alpha channel, post-keying) plus 35% margin, before the square-canvas resize — otherwise a modestly-sized subject can end up tiny in a mostly-empty frame (confirmed on `focus_node`, `hazard_phase_barrier`). `--radial-fade` (defaults `--radial-fade-inner 0.55 --radial-fade-outer 0.90`, overridden above to 0.6/0.92 to preserve more of the subject) then force-fades everything past that outer radius to fully transparent, regardless of whether black-keying alone caught it. `--feather 6` (Gaussian-blurs alpha only) then softens that edge into a genuinely fuzzy transition rather than a crisp cutout — Till's ask, 2026-07-22, after the radial-fade-only version still read as "pasted on" rather than blended into the floor tile underneath.

**When color identity matters** (a hazard whose whole meaning IS its color — so far: both locked doors), add `--recolor-hue DEGREES` (0=red, ~215=a clear blue) after `--radial-fade`, plus `--recolor-min-saturation` (0.6–0.7 worked) and, for naturally dark/desaturated materials like steel, `--recolor-min-value` (~0.42 — without it, a "blue" steel door was technically correct but too dark to register as blue at a glance) and a lower `--recolor-skip-below-saturation` (~0.02, down from the 0.12 default, since steel's baseline saturation is low almost everywhere).

**Floor tiles** (`HEX_ID_FLOOR`/`HEX_SUPEREGO_FLOOR`) additionally need pixelation and the hex crop, and skip black-keying (the tile should fill the whole frame — there's no separate "subject" to key out from a background):
```bash
python3 .claude/skills/generate-sprite/postprocess.py \
  "$STAGING/seed${SEED}.png" \
  "$STAGING/seed${SEED}_hexmasked.png" \
  --size 400 --no-key-black --pixelate 20 --hex-mask
```
`--pixelate 20` was the working grid size for both dimensions on 2026-07-21 (chunky/readable, not noisy) — treat as a starting point, not gospel; retune per-asset if it looks wrong. Apply pixelation *before* the hex mask (the order in the command above / inside `postprocess.py`'s `main()`) so the mask's clean edge isn't re-blurred by the NEAREST upscale. `--hex-mask` replaces the alpha channel with an exact flat-top hexagon (matching `HexMath.ts`'s `hexCorners()`) rather than trusting the model's own edge — see the octagon note above for why.

`--pixelate` is also available for ordinary icons if the same resolution-mismatch problem shows up there (icons render at the same ~80px scale) — not yet tried, worth testing before calling any icon final.

**Narrative panels / full-bleed illustrations:** pass `--no-key-black --no-resize`, or skip post-processing entirely and crop to the target aspect ratio by hand if needed.

## Presenting results

Show the candidate batch to the user (as an Artifact contact sheet, or just reference the file paths and use the Read tool to display each inline) and let them pick — don't auto-select "the best one."

## Promoting a candidate to a real, in-game asset

The sprite pipeline is live (`docs/art_pipeline_roadmap.md` §3, done 2026-07-21) — a promoted asset shows up in the running game automatically, no further engine work needed:

```bash
cwebp -q 85 "<winning-candidate>.png" -o "public/sprites/<name-from-SPRITE_PATHS>.webp"
```
(use `-q 90` or lossless for tiles/icons with fine etched detail, per the two floor tiles already promoted this way). The exact target filename must match `SPRITE_PATHS` in `src/registry/SpriteRegistry.ts` for that `SpriteId` exactly — `TextureRegistry`/`RenderSystem` pick it up the next time the dev server (re)loads, no code change required.

## Multiple tile variants (repetition fix, 2026-07-21)

One texture per `SpriteId`, however uniform, still reads as "the same tile stamped everywhere" once repeated across a whole board (Till's finding). Floor tiles support multiple variants, picked per-hex by a stable hash so the same hex always shows the same one:

```bash
cwebp -q 90 "<candidate-2>.png" -o "public/sprites/hex_id_floor_2.webp"
cwebp -q 90 "<candidate-3>.png" -o "public/sprites/hex_id_floor_3.webp"
```
`PixiDriver.ts` probes `<base>_2.webp`, `<base>_3.webp`, ... at startup and stops at the first gap — numbering must be contiguous starting at 2 (the base file itself, no suffix, is variant 1). Generate each variant the same way as the base (same preset, same uniform/low-detail content rule, same `--pixelate` grid), just a different seed — see the Id floor tile's 4 variants for the working pattern. **Only generate multiple variants where repetition is actually a problem** — Till confirmed the Superego side is fine looking like a repeating pattern (fits the clinical/mechanical theme); don't multiply variants there just for symmetry.

## Decals — multi-hex cosmetic overlay props (new, 2026-07-21)

A second, complementary answer to repetition: larger props (a bone/vein cluster, a rivet row) that span several hex-widths, layered on top of the floor tiles at a few random positions per dimension, re-scattered fresh on every level load (`state/DecalState.ts` — purely cosmetic, not networked, no gameplay meaning). Registered in `registry/DecalRegistry.ts` (`DECAL_PATHS_ID`/`DECAL_PATHS_SUPEREGO`), not `SpriteRegistry` — decals aren't ECS entities.

Generation differs from tiles in one important way: **decals need transparency around an isolated prop, not full-bleed content** — the earlier "prompt for a surface/floor" language actively hurts here (the model happily paints its own background strip/plate behind the prop, e.g. "a rivet row" came out as a rivet row *welded to its own steel plate*). Prompt instead for the prop in isolation:

`<dimension preset clause>, <content: a small loose cluster/row of specific objects>, floating isolated objects only, nothing else, no surface, no background plane, no strip, no panel, plain solid black background, no text`
— negative prompt adds `surface, background plane, strip, panel, plank` (material-specific words like `velvet, fabric, table` or `plate, sheet metal background` as appropriate) beyond the shared negative.

Generate wide/short (`--width 768 --height 384` worked for a ~2.5-hex-wide prop), then:
```bash
python3 .claude/skills/generate-sprite/postprocess.py \
  "$STAGING/seed${SEED}.png" "$STAGING/decal.png" \
  --no-resize --pixelate 50 --feather 4
```
`--no-resize` (keep the source aspect ratio, don't force-square), default black-keying (unlike tiles, decals DO have a real subject to key out from black), `--pixelate` at a grid sized so the resulting block size matches the tiles' own on-screen pixel size — 50 matched a 768px-wide decal displayed at ~200px, giving the same ~4px block size the tiles use at their own display size; recompute if the display size or source resolution changes. `--feather 4` (added 2026-07-22, retrofitted onto all 12 already-promoted decals too) softens the pixelated silhouette's edge so it blends into the floor tile it's layered over instead of reading as a stamp pasted on top — Till's ask, "Alle Decals müssen einen fuzzy Rand haben." Promote with `cwebp` to `public/sprites/decal_<id|superego>_N.webp` and add the path to `DecalRegistry.ts`'s array for that dimension — `DecalState.ts` picks uniformly among whatever's listed, no other code change needed.

6 decals per dimension are promoted and in rotation as of 2026-07-21 (target ~15/side, ongoing); `DecalState.scatterDecals()` also does rejection-sampling placement now so props don't heavily overlap. Occasional rotation/flip randomization is still open, not yet built. **Currently disabled at runtime** (`DecalState.ts`'s `DECALS_ENABLED = false`, 2026-07-22 — hurt board readability once combined with everything else) — the assets themselves are still maintained (and now feathered) so re-enabling is a one-line flip whenever that's revisited.

## Consistency notes for later (once a style LoRA exists)

`docs/art_pipeline_roadmap.md` §4.3 plans a per-dimension style LoRA once enough reference images are curated. When one exists, add `--config-json '{"loras":[{"file":"<lora-file>","weight":0.7,"version":"flux1"}]}'` to the generate call (see `draw-things-cli generate --help`'s `CONFIGURATION OVERRIDES` section for the exact `JSGenerationConfiguration` shape) — this skill's preset clauses stay the same either way; the LoRA supplements them, it doesn't replace them.
