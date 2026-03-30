import { defineComponent, Types } from 'bitecs';

// Avatar vitality. One-hit destruction: max=1, current=1.
// CollisionSystem sets current=0 → AvatarDestroyedEvent fires.
export const Health = defineComponent({ max: Types.ui8, current: Types.ui8 });
