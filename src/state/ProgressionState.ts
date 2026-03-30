// ProgressionState: tracks campaign progress across sessions.
// Persisted to localStorage under 'synaptic_coma_progress'.
// Loaded on startup; updated on level complete.

const STORAGE_KEY = 'synaptic_coma_progress';

interface PersistedState {
  currentLevelIndex: number;
  completedLevels:   string[];
  highScores:        [string, number][]; // Map entries for JSON serialization
}

export const ProgressionState = {
  currentLevelIndex: 0,
  completedLevels:   new Set<string>(),
  highScores:        new Map<string, number>(), // levelId → min failureCount
};

export function loadProgress(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as PersistedState;
    ProgressionState.currentLevelIndex = data.currentLevelIndex ?? 0;
    ProgressionState.completedLevels   = new Set(data.completedLevels ?? []);
    ProgressionState.highScores        = new Map(data.highScores ?? []);
  } catch {
    // Corrupt storage — start fresh.
  }
}

export function saveProgress(): void {
  const data: PersistedState = {
    currentLevelIndex: ProgressionState.currentLevelIndex,
    completedLevels:   [...ProgressionState.completedLevels],
    highScores:        [...ProgressionState.highScores],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function markLevelComplete(levelId: string, failureCount: number): void {
  ProgressionState.completedLevels.add(levelId);
  const prev = ProgressionState.highScores.get(levelId);
  if (prev === undefined || failureCount < prev) {
    ProgressionState.highScores.set(levelId, failureCount);
  }
  saveProgress();
}

export function advanceToNextLevel(levelOrder: string[]): string | null {
  const next = ProgressionState.currentLevelIndex + 1;
  if (next >= levelOrder.length) return null; // campaign complete
  ProgressionState.currentLevelIndex = next;
  saveProgress();
  return levelOrder[next];
}

export function resetProgress(): void {
  ProgressionState.currentLevelIndex = 0;
  ProgressionState.completedLevels.clear();
  ProgressionState.highScores.clear();
  localStorage.removeItem(STORAGE_KEY);
}
