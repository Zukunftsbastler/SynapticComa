import { defineComponent, Types } from 'bitecs';

// Singleton entity component — tracks the current round phase.
// 0 = Active (players can spend AP), 1 = RoundOver (AP pool resetting).
export const RoundState = defineComponent({ phase: Types.ui8 });
