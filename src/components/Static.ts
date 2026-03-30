import { defineComponent } from 'bitecs';

// Tag: entity blocks all movement. Used for walls, locked doors (removed by AbilitySystem
// when the matching Unlock ability is powered).
export const Static = defineComponent({});
