import { defineComponent, Types } from 'bitecs';

// Boolean flags (0 or 1) blocking matching Lethal damage types.
// Added/removed by AbilitySystem based on powered matrix nodes.
export const Resistances = defineComponent({
  fire:  Types.ui8, // 1 = immune to HazardType.FIRE lethal entities
  laser: Types.ui8, // 1 = immune to HazardType.LASER lethal entities
});
