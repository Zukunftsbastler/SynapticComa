import { defineComponent, Types } from 'bitecs';

// Focus Vault (mechanic_roadmap.md #8): a pair of hex entities, one per
// dimension, linked by `id` — same pairing convention as APUnlock. Both
// avatars standing on their node in the same tick SPENDS `cost` AP (instead
// of granting it) and opens a one-time bonus Vault elsewhere on the board.
// Always optional: never load-bearing for a level's required solution.
export const FocusNode = defineComponent({
  id:        Types.ui8,
  cost:      Types.ui8,
  triggered: Types.ui8,
});
