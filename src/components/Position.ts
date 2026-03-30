import { defineComponent, Types } from 'bitecs';

export const Position = defineComponent({
  q: Types.i16,  // axial column
  r: Types.i16,  // axial row
  z: Types.ui8,  // 0 = Dimension A (Id), 1 = Dimension B (Superego)
});
