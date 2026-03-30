import { defineComponent, Types } from 'bitecs';

// Marks a node cell in the 5×5 DNA Matrix.
// Columns 1 & 5 = source/ability nodes; columns 2 & 4 = conduit slots; column 3 = tier-2 ability nodes.
export const MatrixNode = defineComponent({
  column:      Types.ui8, // 1–5
  row:         Types.ui8, // 0-indexed (0–4)
  abilityType: Types.ui8, // AbilityType enum value (0=NONE for conduit slots)
  active:      Types.ui8, // 1 = currently powered by MatrixRoutingSystem
});
