import { defineComponent, Types } from 'bitecs';

// Pipe-shaped tile used both as collectible floor items and as insertable matrix plates.
// faceMask: bits 0-3 = E, S, W, N open faces (computed from shape + rotation).
export const Conduit = defineComponent({
  shape:    Types.ui8, // ConduitShape enum: 0=STRAIGHT, 1=CURVED, 2=T_JUNCTION, 3=CROSS, 4=SPLITTER
  rotation: Types.ui8, // 0=0°, 1=90°, 2=180°, 3=270° clockwise
  faceMask: Types.ui8, // computed bitmask; updated by MatrixRotateSystem
});
