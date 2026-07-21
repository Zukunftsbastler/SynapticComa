import { defineComponent, Types } from 'bitecs';

// Marks a node cell in the 5×5 DNA Matrix.
// Columns 1 & 5 = source/ability nodes; columns 2 & 4 = conduit slots; column 3 = tier-2 ability nodes.
export const MatrixNode = defineComponent({
  column:      Types.ui8, // 1–5
  row:         Types.ui8, // 0-indexed (0–4)
  abilityType: Types.ui8, // AbilityType enum value (0=NONE for conduit slots)
  active:      Types.ui8, // 1 = currently powered by MatrixRoutingSystem
  // Role Asymmetry (decisions_needed.md D14, option C — mechanics.md §5.6).
  // Meaningful only on ability nodes (col 3/5): 0 = benefits P1/Id only,
  // 1 = benefits P2/Superego only, 2 = unrestricted (default — every node in
  // every level before SPRINT_024 is unrestricted, so routing/AbilitySystem
  // behave byte-identically to before whenever this stays at its default).
  restrictedTo: Types.ui8,
});
