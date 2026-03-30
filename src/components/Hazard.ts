import { defineComponent, Types } from 'bitecs';

// Non-lethal obstacle marker (used for visual classification alongside Static/Lethal).
// hazardType maps to HazardType enum.
export const Hazard = defineComponent({ hazardType: Types.ui8 });
