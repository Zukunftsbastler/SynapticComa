import { defineComponent, Types } from 'bitecs';

// Entity kills avatars on contact unless the avatar has a matching Resistances flag.
// hazardType: HazardType.FIRE (3) or HazardType.LASER (4). Chasms (0) kill unconditionally.
export const Lethal = defineComponent({ hazardType: Types.ui8 });
