// The narrative beat registry (docs/narrative.md §5, docs/body_awakening.md).
//
// A "beat" is one story moment: a short sequence of silent illustration panels.
// Two kinds (body_awakening.md §5):
//   VIGNETTE      — a one-off moment; changes no persistent state.
//   REGION_UNLOCK — wakes a body region; that state persists forever after.
//   PROLOGUE      — the opening sequence, the only beat not tied to a level.
//
// TEXT RULE (narrative.md §5.2b): the mind is wordless, the machine watching it
// is not. Panels carry no text of their own; the Monitor's CRT annotation is the
// single sanctioned exception, which is why `monitor` is the only string here.
//
// ART: `asset` is deliberately optional. No cutscene art exists yet
// (public/cutscenes/ is empty), so every panel currently renders as a tinted
// placeholder in the clinical-reality palette (body_awakening.md §6). Dropping
// a file in and setting `asset` is the entire art-integration step — the
// runtime needs no further change.

import { BodyRegion } from './regions';

/** Story variants in play. D16 scoped this to 2–3 (down from the 10 first
 *  floated) as a content-budget cap. Variants share panel art and differ only
 *  in the Monitor's log lines — body_awakening.md §5's own recommended
 *  scope-down, so a new variant costs writing, not illustration. */
export const STORY_VARIANT_COUNT = 3;

export enum BeatKind { PROLOGUE, VIGNETTE, REGION_UNLOCK, FORK }

export interface PanelDef {
  /** Path under public/cutscenes/. Absent until the art exists. */
  asset?: string;
  /** Placeholder wash while `asset` is outstanding. */
  tint: string;
  /** Monitor CRT line per story variant. Length 1 = same line for every
   *  variant; otherwise indexed by NarrativeState.storyVariant. */
  monitor: string[];
}

export interface BeatDef {
  /** Stable string key — what gets persisted in `seenBeats`. Numeric BeatId
   *  values may be renumbered freely; these may not. */
  key: string;
  kind: BeatKind;
  panels: PanelDef[];
  /** Set iff kind === REGION_UNLOCK. */
  region?: BodyRegion;
}

/** Numeric ids exist only to survive the ECS hop: NarrativeBeatEvent is a
 *  bitECS component, i.e. a TypedArray, which cannot hold a string. */
export enum BeatId {
  PROLOGUE = 0,
  EEG_FLICKER, CHART_NOTICED, DOCTOR_CALLED, FAMILY_BEDSIDE,
  REGION_FINGERS,
  MOTOR_CORTEX_LOG, NIGHT_SHIFT, SPECIALIST_CONSULTED, CAUTIOUS_HOPE,
  REGION_HANDS,
  SECOND_WEEK,
  REGION_FEET,
  REGION_FACE, REGION_EARS, REGION_EYES, REGION_TORSO,
  LONG_NIGHT, A_VISITOR, THE_CHART_GROWS,
  REGION_VOICE,
  THE_FORK,
  ROUTINE_SETTLES, A_WORD_ATTEMPTED, THE_ROOM_CHANGES,
  // Levels 60–100 are not built yet; these beats are scheduled and will
  // activate untouched as those levels ship (see beatIndex.ts).
  DISTANT_FAMILY, A_SEASON_PASSES,
  REGION_LIMB_MOBILITY, REGION_LANGUAGE,
  THE_LONG_WORK, ALMOST,
  REGION_WHOLE_BODY,
  THE_LAST_THRESHOLD,
  REGION_HEAD,
}

// Clinical-reality palette (body_awakening.md §6) — muted greys/greens and
// harsh fluorescent white, deliberately neither dimension's colours so a story
// beat can never be mistaken for a playable board.
const WARD    = '#2a3230';
const MONITOR = '#16201c';
const FLUORO  = '#5a6660';
const DARK    = '#101614';

// Asset filename is derived from the key rather than repeated: every vignette's
// panel art is promoted as public/cutscenes/<key>.webp, so the two can never
// drift apart by typo. narrative.test.ts asserts every referenced file exists.
const vignette = (key: string, tint: string, monitor: string[]): BeatDef => ({
  key, kind: BeatKind.VIGNETTE, panels: [{ asset: `${key}.webp`, tint, monitor }],
});

const region = (key: string, r: BodyRegion, monitor: string[]): BeatDef => ({
  key, kind: BeatKind.REGION_UNLOCK, region: r,
  panels: [{ tint: MONITOR, monitor }],
});

export const BEATS: Record<BeatId, BeatDef> = {
  [BeatId.PROLOGUE]: {
    key: 'prologue', kind: BeatKind.PROLOGUE,
    panels: [
      { asset: 'prologue_1_flatline.webp', tint: DARK,   monitor: ['SUBJECT: COMATOSE. DAY 214.'] },
      { asset: 'prologue_2_split.webp',    tint: WARD,   monitor: ['NEURAL SPLIT CONFIRMED. TWO HEMISPHERES, NO BRIDGE.'] },
      { asset: 'prologue_3_wisps.webp',    tint: FLUORO, monitor: ['INITIATING DEEP STIMULATION.'] },
    ],
  },

  // ── Act 1 — Reflex. Every one of levels 1–10 carries a beat (D16's explicit
  // "no silent gaps in the opening window" requirement). ──────────────────
  [BeatId.EEG_FLICKER]:          vignette('eeg_flicker',   MONITOR, ['DAY 214. EEG: ANOMALOUS SPIKE. UNCLASSIFIED.']),
  [BeatId.CHART_NOTICED]:        vignette('chart_noticed', WARD,    ['DAY 215. NURSING NOTE APPENDED.']),
  [BeatId.DOCTOR_CALLED]:        vignette('doctor_called', FLUORO,  ['DAY 215. ATTENDING PHYSICIAN PAGED.']),
  [BeatId.FAMILY_BEDSIDE]:       vignette('family_bedside', DARK,   ['DAY 216. VISITOR PRESENT. NO CLINICAL CHANGE.']),
  [BeatId.REGION_FINGERS]:       region('region_fingers', BodyRegion.FINGERS_TOES,
                                        ['DAY 216. INVOLUNTARY DIGIT MOVEMENT. LOGGED.']),
  [BeatId.MOTOR_CORTEX_LOG]:     vignette('motor_cortex_log', MONITOR, ['DAY 218. MOTOR CORTEX ACTIVITY, LOW BUT PRESENT.']),
  [BeatId.NIGHT_SHIFT]:          vignette('night_shift',   DARK,    ['DAY 219. 03:40. RHYTHM STEADIER.']),
  [BeatId.SPECIALIST_CONSULTED]: vignette('specialist_consulted', FLUORO, ['DAY 221. EXTERNAL CONSULT REQUESTED.']),
  [BeatId.CAUTIOUS_HOPE]:        vignette('cautious_hope', WARD,    ['DAY 222. FAMILY INFORMED. PROGNOSIS UNCHANGED.']),
  [BeatId.REGION_HANDS]:         region('region_hands', BodyRegion.HANDS_FOREARMS,
                                        ['DAY 223. GRIP REFLEX RETURNS. RIGHT HAND.']),
  [BeatId.SECOND_WEEK]:          vignette('second_week',   WARD,    ['DAY 228. NO REGRESSION.']),
  [BeatId.REGION_FEET]:          region('region_feet', BodyRegion.FEET_LEGS,
                                        ['DAY 231. WITHDRAWAL REFLEX, BOTH FEET.']),

  // ── Act 1 continued (shipped hand-authored levels 16–29) ─────────────────
  [BeatId.REGION_FACE]:  region('region_face',  BodyRegion.FACE_MOUTH,
                                ['DAY 240. FACIAL MICRO-EXPRESSION. SYMMETRIC.']),
  [BeatId.REGION_EARS]:  region('region_ears',  BodyRegion.EARS,
                                ['DAY 246. STARTLE RESPONSE TO SOUND.']),
  [BeatId.REGION_EYES]:  region('region_eyes',  BodyRegion.EYES,
                                ['DAY 252. EYELIDS FLUTTER. NO FIXATION.']),
  [BeatId.REGION_TORSO]: region('region_torso', BodyRegion.TORSO,
                                ['DAY 261. AUTONOMIC REGULATION IMPROVING.']),

  // ── Act 2 — Voice (generated levels 30–45) ───────────────────────────────
  [BeatId.LONG_NIGHT]:      vignette('long_night',      DARK,    ['DAY 270. UNEVENTFUL.']),
  [BeatId.A_VISITOR]:       vignette('a_visitor',       WARD,    ['DAY 279. VISITOR LOG UPDATED.']),
  [BeatId.THE_CHART_GROWS]: vignette('the_chart_grows', FLUORO,  ['DAY 288. FILE TRANSFERRED TO LONG-TERM CARE.']),
  [BeatId.REGION_VOICE]:    region('region_voice', BodyRegion.VOICE,
                                   ['DAY 295. VOCALISATION. NON-VERBAL.']),

  // ── The Fork (~L48) — a choice, not a region (body_awakening.md §4a) ──────
  [BeatId.THE_FORK]: {
    key: 'the_fork', kind: BeatKind.FORK,
    panels: [{ asset: 'the_fork.webp', tint: MONITOR, monitor: ['DAY 300. TWO RECOVERY PATHWAYS VIABLE. SELECT PRIORITY.'] }],
  },

  // ── Act 3 — chosen track (levels 49–75) ──────────────────────────────────
  [BeatId.ROUTINE_SETTLES]:   vignette('routine_settles',   WARD,    ['DAY 311. THERAPY SCHEDULE ESTABLISHED.']),
  [BeatId.A_WORD_ATTEMPTED]:  vignette('a_word_attempted',  MONITOR, ['DAY 324. PATTERNED VOCALISATION. INCONCLUSIVE.']),
  [BeatId.THE_ROOM_CHANGES]:  vignette('the_room_changes',  FLUORO,  ['DAY 338. RELOCATED. WINDOW-FACING.']),
  [BeatId.DISTANT_FAMILY]:    vignette('distant_family',    DARK,    ['DAY 352. VISITS LESS FREQUENT.']),
  [BeatId.A_SEASON_PASSES]:   vignette('a_season_passes',   WARD,    ['DAY 366. ONE YEAR.']),
  [BeatId.REGION_LIMB_MOBILITY]: region('region_limb_mobility', BodyRegion.LIMB_MOBILITY,
                                        ['DAY 380. VOLUNTARY LIMB CONTROL. ASSISTED.']),
  [BeatId.REGION_LANGUAGE]:      region('region_language', BodyRegion.LANGUAGE,
                                        ['DAY 380. COMPREHENSION RESPONSE. CONSISTENT.']),

  // ── Acts 4–5 — convergence and consciousness (levels 76–100) ─────────────
  [BeatId.THE_LONG_WORK]:      vignette('the_long_work', MONITOR, ['DAY 395. INCREMENTAL. SUSTAINED.']),
  [BeatId.ALMOST]:             vignette('almost',        FLUORO,  ['DAY 410. RESPONSIVE TO NAME.']),
  [BeatId.REGION_WHOLE_BODY]:  region('region_whole_body', BodyRegion.WHOLE_BODY,
                                      ['DAY 421. COORDINATED MOVEMENT. UNASSISTED.']),
  [BeatId.THE_LAST_THRESHOLD]: vignette('the_last_threshold', DARK, ['DAY 430. AWAITING.']),
  [BeatId.REGION_HEAD]:        region('region_head', BodyRegion.HEAD,
                                      ['DAY 437. SUBJECT CONSCIOUS. STIMULATION ENDS.']),
};

/** The Monitor line for this panel under the active story variant. Falls back
 *  to entry 0 whenever a beat has not been written per-variant (the common
 *  case — variants are a writing pass, added beat by beat). */
export function monitorLine(panel: PanelDef, storyVariant: number): string {
  return panel.monitor[storyVariant] ?? panel.monitor[0] ?? '';
}
