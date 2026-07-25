// NarrativeState: story progress across sessions — which beats have played,
// which body regions are awake, and which story variant this save runs.
// Persisted to localStorage, deliberately under its own key so wiping story
// progress and wiping campaign progress stay independent operations.
//
// WHY THIS IS NOT AN ECS COMPONENT (docs/architecture.md §6, body_awakening.md
// §10): LevelLoaderSystem.loadLevel() calls deleteWorld() + entityRegistry
// .clear() on EVERY level load. Anything held in a bitECS component is
// destroyed at every transition — which is exactly the boundary this state has
// to survive. It belongs in the same category as ProgressionState, whose shape
// it mirrors. The ECS side of the narrative layer is the *event* (a beat
// becoming due, NarrativeBeatEvent) — ephemeral by nature, which is what event
// entities are for.

import { BodyRegion } from '@/narrative/regions';
import { STORY_VARIANT_COUNT } from '@/narrative/beats';

const STORAGE_KEY = 'synaptic_coma_narrative';

interface PersistedState {
  storyVariant:    number;
  seenBeats:       string[];
  unlockedRegions: string[];
  forkChoice?:     'motor' | 'sense';
}

export const NarrativeState = {
  /** Chosen once, at save-file creation, and fixed for that playthrough — so
   *  every beat in one run draws from the same variant (body_awakening.md §5). */
  storyVariant:    0,
  /** BeatDef.key values, not numeric ids: BeatId numbering may be reordered as
   *  beats are added, saved keys may not. */
  seenBeats:       new Set<string>(),
  unlockedRegions: new Set<BodyRegion>(),
  /** Set once at the Fork (~L48). Undefined until then. */
  forkChoice:      undefined as 'motor' | 'sense' | undefined,
};

export function loadNarrative(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First run on this machine — pick this playthrough's variant now.
      NarrativeState.storyVariant = Math.floor(Math.random() * STORY_VARIANT_COUNT);
      saveNarrative();
      return;
    }
    const data = JSON.parse(raw) as PersistedState;
    NarrativeState.storyVariant    = data.storyVariant ?? 0;
    NarrativeState.seenBeats       = new Set(data.seenBeats ?? []);
    NarrativeState.unlockedRegions = new Set((data.unlockedRegions ?? []) as BodyRegion[]);
    NarrativeState.forkChoice      = data.forkChoice;
  } catch {
    // Corrupt storage — start fresh, same policy as ProgressionState.
  }
}

export function saveNarrative(): void {
  const data: PersistedState = {
    storyVariant:    NarrativeState.storyVariant,
    seenBeats:       [...NarrativeState.seenBeats],
    unlockedRegions: [...NarrativeState.unlockedRegions],
    forkChoice:      NarrativeState.forkChoice,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Has this beat already played? Beats never auto-replay — revisiting level 5
 *  must not force its cutscene again. Replaying one on demand is a separate,
 *  future entry point and is why `seenBeats` is a set rather than a counter. */
export function hasSeenBeat(key: string): boolean {
  return NarrativeState.seenBeats.has(key);
}

export function markBeatSeen(key: string): void {
  NarrativeState.seenBeats.add(key);
  saveNarrative();
}

/** Records a body region as awake. Idempotent — a region never un-wakes. */
export function unlockRegion(region: BodyRegion): void {
  NarrativeState.unlockedRegions.add(region);
  saveNarrative();
}

export function setForkChoice(choice: 'motor' | 'sense'): void {
  NarrativeState.forkChoice = choice;
  saveNarrative();
}

export function resetNarrative(): void {
  NarrativeState.seenBeats.clear();
  NarrativeState.unlockedRegions.clear();
  NarrativeState.forkChoice = undefined;
  NarrativeState.storyVariant = Math.floor(Math.random() * STORY_VARIANT_COUNT);
  localStorage.removeItem(STORAGE_KEY);
}
