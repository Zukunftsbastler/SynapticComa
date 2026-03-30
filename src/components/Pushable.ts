import { defineComponent, Types } from 'bitecs';

// Entity can be shoved 1 hex by the Push ability without moving the avatar.
export const Pushable = defineComponent({ canBePushed: Types.ui8 });
