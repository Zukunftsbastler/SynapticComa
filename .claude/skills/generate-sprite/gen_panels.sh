#!/usr/bin/env bash
# Narrative-panel generation (docs/narrative.md §5, Phase 5 of art_pipeline_roadmap.md).
#
# CONSISTENCY IS THE WHOLE POINT OF THIS FILE. Panels must look like each other
# and like the rest of the game. Four locked levers, all applied here and never
# improvised per-panel:
#
#   1. LOCKED PRESET CLAUSE — the fourth style preset ("clinical reality"),
#      alongside the existing ID / SUPEREGO / MATRIX ones in the generate-sprite
#      skill. Reused verbatim, exactly like those three are.
#   2. LOCKED SCENE ANCHOR — every ward vignette is the SAME room. Repeating the
#      identical room description is what stops panel 7 from being a different
#      hospital than panel 2.
#   3. NO FACES, PARTIAL FRAMING ONLY — body_awakening.md §8.4's cheapest fix for
#      character drift, and already this project's house rule: the shared
#      negative prompt has banned "human face, realistic person" since the first
#      sprite. A hand, a sleeve, a silhouette in a doorway cannot drift the way
#      a recurring face would, because there is no face to keep consistent.
#   4. IDENTICAL GENERATION PARAMS — same model, steps, size, seeds, and
#      post-processing for every panel.
#
set -euo pipefail
cd "$(dirname "$0")/../../.."   # repo root

MODEL="flux_2_klein_4b_q8p.ckpt"
STEPS=8
W=832; H=512   # ~1.63:1, matching CutscenePlayer's 420x260 panel frame

# ── 1. Locked preset clause — "clinical reality", the outside world ──────────
# Deliberately neither dimension's palette (body_awakening.md §6): the Id is
# purple/crimson organic, the Superego cyan/steel clinical. Outside reality is
# the third register, the one the Monitor already occupies narratively.
CLINICAL="desaturated hospital ward realism, muted grey-green painted walls and worn linoleum, dull chrome and scuffed enamel equipment, harsh fluorescent white overhead light falling off into deep shadow, heavy vignetting, muted and still"

# ── 2. Locked scene anchor — the same room in every ward panel ───────────────
ROOM="a single dim hospital room, one bed, a bedside vital-signs monitor on a stand, an IV pole, worn linoleum floor"

# ── 3. Locked framing — EMPTY BY DEFAULT ────────────────────────────────────
# First pass said "no people shown in full, only a partial glimpse such as
# hands, a sleeve, or a distant silhouette" — and the model dutifully put
# cropped torsos at the left and right edge of ALL THREE panels, including the
# two that must have nobody in them at all. Naming the thing you don't want
# summons it; this is the same prior-dragging failure the skill already
# documents for "door" → "door mounted on its own plaque".
# So: empty is the default, and a human trace is opted INTO per panel, never
# out of. Fewer humans is also §8.4's own drift argument taken to its limit.
FRAMING="completely empty of people, no figures, no limbs, no hands, cinematic wide shot, full-bleed illustration, no frame, no vignette border, no icons or game pieces, no text"

# Opt-in for the handful of vignettes that genuinely need a human trace. Still
# never a face, never a whole person — there is nothing to keep consistent.
FRAMING_TRACE="the only human element is a single pair of hands entering the frame from one edge, no face, no head, no body, nothing else of the person visible, cinematic wide shot, full-bleed illustration, no frame, no vignette border, no text"

NEG_BASE="text, watermark, blurry, photo, human face, realistic person, low quality, extra limbs, cropped, signature"
NEG_PANEL="$NEG_BASE, portrait, full figure, crowd, cartoon, anime, cheerful, bright saturated colors, clean modern hospital, lens flare, person at edge of frame, torso, shoulder, arm, silhouette of a person"

gen () {  # gen <name> <content clause> <extra negative> <preset override> <framing override>
  local name="$1" content="$2" extra_neg="${3:-}" preset="${4:-$CLINICAL}" framing="${5:-$FRAMING}"
  local dir="artwork_tests/candidates/panel_${name}"
  mkdir -p "$dir"
  for SEED in 1 2; do
    [ -f "$dir/seed${SEED}.png" ] && continue
    echo "  → ${name} seed${SEED}"
    draw-things-cli generate \
      --model "$MODEL" \
      --prompt "${preset}, ${content}, ${framing}" \
      --negative-prompt "${NEG_PANEL}${extra_neg:+, $extra_neg}" \
      --width $W --height $H --steps $STEPS --seed $SEED \
      --output "$dir/seed${SEED}.png" >/dev/null 2>&1
  done
}

# ── The opening sequence (narrative.md §5.1) ─────────────────────────────────
# Panel 2 and 3 deliberately step OUT of the clinical preset: the prologue is
# the bridge from outside reality into the mind, so it has to hand off from the
# clinical register to the two dimensions' own material language. Panel 1 is
# pure clinical; panel 3 is pure Id/Superego; panel 2 is the transition itself.

echo "[1/3] flatline"
gen "flatline" \
  "${ROOM}, the bed occupied but utterly still under a grey blanket, the bedside monitor screen showing one unbroken flat line, the room lit only by that screen and one dim overhead lamp" \
  "heartbeat waveform, peaks, spikes"

echo "[2/3] split"
# First pass came back candy pink / baby blue and glossy — a science-museum
# promo, not this game. The dimension colours have to be the DECAYED versions
# the style bible actually specifies (bruised purple, cold slate) or the panel
# stops belonging to the same game as the boards it introduces.
gen "split" \
  "a single human brain seen from above on a dark specimen surface, cracked cleanly down the centre line, a deep bruised purple void opening on the left half and a cold slate blue void on the right half, nothing else in the frame" \
  "skull, gore, blood, medical diagram, labels, pink, rose, magenta, cyan, turquoise, glossy, shiny, plastic model, bright, vivid, clean" \
  "anatomical specimen in deep shadow, dull matte desaturated surfaces, dusty and decayed, harsh single overhead light falling off into total blackness, deep bruised violet-purple on one side and cold slate grey-blue on the other, no other colors, no gloss"

echo "[3/3] wisps"
# "Two SMALL points of light" is narrative.md §5.1's wording, and taking it
# literally produced two specks lost in black at the real 420x260 display size.
# Same legibility lesson the skill documents for 80px icons: bolder, closer,
# brighter content beats any post-processing trick. Enlarged deliberately —
# the fiction is "two small sparks", the composition has to be readable.
gen "wisps" \
  "two large glowing forms, one on each side of the frame, seen close up, separated by total blackness between them, on the left a chaotic bright ember of jagged obsidian and coagulated resin glowing deep purple, on the right a geometric structured spark of tarnished steel shards glowing cold blue, each filling a third of the frame" \
  "connection, bridge, beam, joined, one single light, tiny, distant, small, empty frame" \
  "heavy vignetting, deep oppressive shadow, thick etched material, strong rim light falling off into total blackness"

# ── The ward vignettes ───────────────────────────────────────────────────────
# FIFTH CONSISTENCY LEVER, and the strongest one for a set this size: there are
# only FIVE locked camera setups, reused verbatim. Twenty-one freely-invented
# scenes would drift into twenty-one different hospitals no matter how good the
# preset clause is; five repeated shots of one room read as "the same place,
# months passing" — which is exactly what the story is. The differentiator
# between beats is time of day, weather and one added detail, never a new place.

SHOT_ROOM="${ROOM}, wide view of the whole room from the foot of the bed"
SHOT_MONITOR="a close view of the bedside vital-signs monitor screen and its scuffed casing, the dim hospital room out of focus behind it"
SHOT_BEDSIDE="a close view of the edge of a hospital bed, grey blanket, metal bed rail and a hanging IV line, the rest of the dim room in deep shadow"
SHOT_DOOR="a view from inside a dim hospital room toward its open doorway, cold corridor light spilling across the linoleum"
SHOT_WINDOW="a view from inside a dim hospital room toward its curtained window, thin pale daylight coming through"

echo "[vignettes]"
gen "eeg_flicker"     "${SHOT_MONITOR}, the screen showing one faint irregular spike breaking an otherwise flat trace"
gen "chart_noticed"   "${SHOT_BEDSIDE}, a clipboard chart hanging on the bed rail, a pen clipped to it"
gen "doctor_called"   "${SHOT_DOOR}, the doorway empty, the corridor beyond harshly lit"
gen "family_bedside"  "${SHOT_BEDSIDE}, one folded blanket edge, a single visitor chair pulled close" "" "" "$FRAMING_TRACE"
gen "motor_cortex"    "${SHOT_MONITOR}, the screen showing a low but steady repeating trace"
gen "night_shift"     "${SHOT_ROOM} at deep night, the overhead lamp off, only the monitor's faint glow lighting the room"
gen "specialist"      "${SHOT_DOOR}, a second equipment trolley parked just inside the door"
gen "cautious_hope"   "${SHOT_BEDSIDE}, a small folded paper note left on the blanket"
gen "second_week"     "${SHOT_ROOM}, one wilting potted plant on the windowsill"
gen "long_night"      "${SHOT_ROOM} at deep night, everything still, long shadows across the floor"
gen "a_visitor"       "${SHOT_BEDSIDE}, an empty visitor chair turned slightly toward the bed, a coat draped over its back"
gen "chart_grows"     "${SHOT_BEDSIDE}, a thick stack of chart papers wedged into a holder on the bed rail"
gen "routine_settles" "${SHOT_ROOM}, a physiotherapy frame and a folded wheelchair standing against the wall"
gen "word_attempted"  "${SHOT_MONITOR}, the screen showing a short irregular burst in an otherwise steady trace"
gen "room_changes"    "${SHOT_WINDOW}, the bed now turned to face the window, brighter daylight than before"
gen "distant_family"  "${SHOT_BEDSIDE}, the visitor chair empty and pushed back against the wall, no coat"
gen "season_passes"   "${SHOT_WINDOW}, bare branches visible through the glass, cold grey winter light"
gen "long_work"       "${SHOT_ROOM}, therapy equipment in regular use, the room lived-in and worn"
gen "almost"          "${SHOT_BEDSIDE}, the blanket disturbed as if recently moved, the bed rail lowered"
gen "last_threshold"  "${SHOT_WINDOW}, first pale dawn light on the sill, the room otherwise dark"
gen "the_fork"        "${SHOT_ROOM}, two separate pieces of therapy equipment standing on opposite sides of the bed, evenly lit, neither favoured"

echo "done → artwork_tests/candidates/panel_*/"
