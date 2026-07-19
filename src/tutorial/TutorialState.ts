// TutorialState: which concepts have been explained (once per profile).
// Persisted under 'synaptic_coma_tutorial' (tutorial_design.md §4.3).
// Local per client — never networked.

const STORAGE_KEY = 'synaptic_coma_tutorial';

export enum ConceptId {
  ROLES       = 'ROLES',
  UNLOCK_NODE = 'UNLOCK_NODE',
  INSERT      = 'INSERT',
  JUMP        = 'JUMP',
  SCRAP_DRAW  = 'SCRAP_DRAW',
}

const seen = new Set<string>();
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) seen.add(id);
  } catch { /* corrupt storage — start fresh */ }
}

export function hasSeen(id: ConceptId): boolean {
  load();
  return seen.has(id);
}

export function markSeen(id: ConceptId): void {
  load();
  seen.add(id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen])); } catch { /* ignore */ }
}

/** Menu option "recalibrate" — replays every explanation. */
export function resetTutorial(): void {
  seen.clear();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
