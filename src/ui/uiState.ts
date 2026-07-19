// Shared UI interaction state — single source of truth for the plate
// selection, so InventoryPanel (display + click), MatrixUI (insert) and
// MatrixRenderer (arrow highlight + push preview) can never disagree.
//
// insertArmed: the player clicked a plate and the matrix arrows are "hot" —
// the next arrow click inserts that plate. Purely local, never networked.
//
// pendingRotation: pre-insert orientation chosen with [R] (0 AP). Lives here —
// not privately in MatrixUI — so InventoryPanel and the matrix push preview
// can SHOW it; an invisible rotation state was a pure recall burden.
//
// hoverInsert: which insert arrow the pointer is over while armed. Drives the
// push preview (feedforward): ghost of the incoming plate at the entry row,
// shift markers on every plate in the column, ejection warning at the far end.

export const uiState = {
  selectedSlot:    0,
  insertArmed:     false,
  pendingRotation: null as number | null,
  hoverInsert:     null as { col0: number; fromTop: boolean } | null,
};

export function armInsert(slot: number): void {
  if (uiState.selectedSlot !== slot) uiState.pendingRotation = null;
  uiState.selectedSlot = slot;
  uiState.insertArmed  = true;
}

export function disarmInsert(): void {
  uiState.insertArmed     = false;
  uiState.pendingRotation = null;
  uiState.hoverInsert     = null;
}
