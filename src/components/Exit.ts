import { defineComponent, Types } from 'bitecs';

// Marks a Nexus Hex (exit point).
// Sequential exit: P1's exit must be used first (P1ExitedEvent) to activate P2's exit.
export const Exit = defineComponent({ playerId: Types.ui8 }); // 0 = P1 exit, 1 = P2 exit
