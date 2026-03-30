import { defineComponent, Types } from 'bitecs';

// Which dimension owns this entity.
// 0 = Dimension A (The Id — Player 1), 1 = Dimension B (The Superego — Player 2)
export const Dimension = defineComponent({ layer: Types.ui8 });
