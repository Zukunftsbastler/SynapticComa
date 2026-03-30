import { defineComponent, Types } from 'bitecs';

// Singleton entity component — mirrors GameState.apPool for HUD rendering.
// Only the Host mutates this. Guest reads from incoming STATE_UPDATE messages.
export const APPool = defineComponent({ current: Types.ui8, max: Types.ui8 });
