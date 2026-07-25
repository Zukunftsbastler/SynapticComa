// Body regions for the meta-progression layer (docs/body_awakening.md §3,
// decisions_needed.md D16). Twelve regions across the planned 100-level
// campaign, front-loaded in granularity (four in the first 15 levels) and
// back-loaded in weight (Head/Consciousness is gated behind everything).
//
// This enum is the schedule's vocabulary only — it records WHICH region a beat
// wakes. The Body screen that draws them is a later sprint; what exists today
// is the state that screen will read (state/NarrativeState.ts).

export enum BodyRegion {
  FINGERS_TOES   = 'fingers_toes',
  HANDS_FOREARMS = 'hands_forearms',
  FEET_LEGS      = 'feet_legs',
  FACE_MOUTH     = 'face_mouth',
  EARS           = 'ears',
  EYES           = 'eyes',
  TORSO          = 'torso',
  VOICE          = 'voice',
  // The Fork (body_awakening.md §4a): exactly one of these two wakes per
  // playthrough, decided once at ~L48. The untaken one stays visibly dormant —
  // a deliberate replay hook, not an oversight.
  LIMB_MOBILITY  = 'limb_mobility', // Id-led / motor track
  LANGUAGE       = 'language',      // Superego-led / perception track
  WHOLE_BODY     = 'whole_body',
  HEAD           = 'head',
}

/** Which track a Fork-gated region belongs to; undefined for unforked regions. */
export const REGION_TRACK: Partial<Record<BodyRegion, 'motor' | 'sense'>> = {
  [BodyRegion.LIMB_MOBILITY]: 'motor',
  [BodyRegion.LANGUAGE]:      'sense',
};
