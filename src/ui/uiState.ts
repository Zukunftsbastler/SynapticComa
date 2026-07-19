// Shared UI interaction state — single source of truth for the plate
// selection, so InventoryPanel (display + click), MatrixUI (insert) and
// MatrixRenderer (arrow highlight) can never disagree.
//
// insertArmed: the player clicked a plate and the matrix arrows are "hot" —
// the next arrow click inserts that plate. Purely local, never networked.

export const uiState = {
  selectedSlot: 0,
  insertArmed:  false,
};

export function armInsert(slot: number): void {
  uiState.selectedSlot = slot;
  uiState.insertArmed  = true;
}

export function disarmInsert(): void {
  uiState.insertArmed = false;
}
