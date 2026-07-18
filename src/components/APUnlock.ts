import { defineComponent, Types } from 'bitecs';

// Shared Unlock node (mechanics.md §2, architecture.md §3).
// Placed as a *pair* of hex entities — one in Dimension A, one in Dimension B —
// linked by the same `id`. When both avatars stand on their respective node in
// the same tick, APUnlockSystem grants `value` AP to the shared pool and marks
// both entities triggered (one-time activation).
export const APUnlock = defineComponent({
  id:        Types.ui8, // shared identifier linking the Dim A / Dim B pair
  value:     Types.ui8, // AP granted when triggered
  triggered: Types.ui8, // 0 = available, 1 = consumed
});
