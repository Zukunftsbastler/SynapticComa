// Which narrative beat fires after which level — the campaign's story schedule
// (docs/body_awakening.md §3, resolved as decisions_needed.md D16).
//
// Deliberately a static lookup keyed by level id, mirroring levelIndex.ts's
// LEVEL_NAMES: no new field on LevelDef, so LevelSchema.ts, the solver, and
// every one of the shipped level JSONs stay untouched. A level without an
// entry simply has no beat — most levels don't.
//
// SCHEDULED FOR 100 LEVELS, NOT 59. D16 fixed the final campaign length at 100.
// Levels 1–59 exist today and their beats are live; the entries for 60–100 are
// written against the same plan and activate untouched as those levels ship —
// an unmatched key is inert, never an error.
//
// Cadence (body_awakening.md §2): a beat on EVERY one of levels 1–10 (D16's
// explicit no-silent-gaps window), then widening — roughly every 5 levels
// through Act 1, every 10–15 by the late game, as levels themselves get longer.

import { BeatId } from './beats';

export const BEAT_AFTER_LEVEL: Readonly<Record<string, BeatId>> = {
  // ── Act 1 — Reflex. Levels 1–10: one beat each, no gaps. ─────────────────
  level_01: BeatId.EEG_FLICKER,
  level_02: BeatId.CHART_NOTICED,
  level_03: BeatId.DOCTOR_CALLED,
  level_04: BeatId.FAMILY_BEDSIDE,
  level_05: BeatId.REGION_FINGERS,        // end of "The Basics"
  level_06: BeatId.MOTOR_CORTEX_LOG,
  level_07: BeatId.NIGHT_SHIFT,
  level_08: BeatId.SPECIALIST_CONSULTED,
  level_09: BeatId.CAUTIOUS_HOPE,
  level_10: BeatId.REGION_HANDS,          // end of "The Shift"
  level_13: BeatId.SECOND_WEEK,
  level_15: BeatId.REGION_FEET,           // end of the capstone block

  // ── Act 1 continued — hand-authored levels 16–29. Each region lands on the
  // level whose mechanic it thematically mirrors (body_awakening.md §3). ────
  level_21: BeatId.REGION_FACE,   // first mandatory two-player coordination
  level_23: BeatId.REGION_EARS,   // Focus Vault — perceiving more than needed
  level_25: BeatId.REGION_EYES,   // Echo Tile — seeing across dimensions
  level_29: BeatId.REGION_TORSO,  // all four Neuro-Resonance pairs demonstrated

  // ── Act 2 — Voice (generated levels 30–48) ───────────────────────────────
  level_33: BeatId.LONG_NIGHT,
  level_37: BeatId.A_VISITOR,
  level_41: BeatId.THE_CHART_GROWS,
  level_45: BeatId.REGION_VOICE,
  level_48: BeatId.THE_FORK,      // the one player choice; see beats.ts

  // ── Act 3 — the chosen track (levels 49–75) ──────────────────────────────
  level_52: BeatId.ROUTINE_SETTLES,
  level_56: BeatId.A_WORD_ATTEMPTED,
  level_59: BeatId.THE_ROOM_CHANGES,
  // ↑ last shipped level. Everything below activates as levels 60–100 ship. ↓
  level_65: BeatId.DISTANT_FAMILY,
  level_70: BeatId.A_SEASON_PASSES,
  level_75: BeatId.REGION_LIMB_MOBILITY,  // fork-resolved — see beatAfterLevel()

  // ── Acts 4–5 — convergence and consciousness (levels 76–100) ─────────────
  level_80:  BeatId.THE_LONG_WORK,
  level_85:  BeatId.ALMOST,
  level_90:  BeatId.REGION_WHOLE_BODY,
  level_95:  BeatId.THE_LAST_THRESHOLD,
  level_100: BeatId.REGION_HEAD,
};

/**
 * The beat due after completing `levelId`, or null.
 *
 * `forkChoice` resolves the single fork-gated slot (body_awakening.md §4a):
 * the level sequence never branches — only WHICH of the two Act-3 regions
 * wakes this playthrough does. 'sense' swaps the motor region for Language;
 * the untaken one stays dormant, which is the intended replay hook.
 */
export function beatAfterLevel(
  levelId: string,
  forkChoice?: 'motor' | 'sense',
): BeatId | null {
  const beat = BEAT_AFTER_LEVEL[levelId];
  if (beat === undefined) return null;
  if (beat === BeatId.REGION_LIMB_MOBILITY && forkChoice === 'sense') {
    return BeatId.REGION_LANGUAGE;
  }
  return beat;
}
