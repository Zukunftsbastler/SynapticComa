import { defineComponent, Types } from 'bitecs';

// Marks a wisp entity and records which player controls it.
export const Avatar = defineComponent({ playerId: Types.ui8 }); // 0 = P1 (Id), 1 = P2 (Superego)
