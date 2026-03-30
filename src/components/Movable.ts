import { defineComponent, Types } from 'bitecs';

// Avatar or block can be moved by player input.
export const Movable = defineComponent({ canMove: Types.ui8 });
