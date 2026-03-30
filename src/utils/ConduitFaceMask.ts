// Conduit face connectivity model (Decision 4).
// Bits 0-3 represent open faces: bit0=East, bit1=South, bit2=West, bit3=North.
// Rotation is clockwise: each +1 rotation shifts all open faces one step CW.
// Connection is valid only when both adjacent faces are mutually open.

import { ConduitShape } from '@/types';

// Base masks for each shape at rotation 0 (unrotated).
export const BASE_MASKS: Record<ConduitShape, number> = {
  [ConduitShape.STRAIGHT]:   0b0101, // E+W  (horizontal pipe)
  [ConduitShape.CURVED]:     0b0011, // E+S  (bottom-right bend)
  [ConduitShape.T_JUNCTION]: 0b0111, // E+S+W
  [ConduitShape.CROSS]:      0b1111, // E+S+W+N (all four; static, not rotatable)
  [ConduitShape.SPLITTER]:   0b1110, // S+W+N (three-way; Master Set)
};

// Rotate a face-mask clockwise by `rotations` steps.
// Each step maps: E→S→W→N→E (bit0→bit1→bit2→bit3→bit0).
export function rotateMask(mask: number, rotations: number): number {
  let m = mask & 0b1111;
  const steps = ((rotations % 4) + 4) % 4;
  for (let i = 0; i < steps; i++) {
    // Shift left 1 (E→S→W→N), wrap bit3 back to bit0.
    m = ((m << 1) | (m >> 3)) & 0b1111;
  }
  return m;
}

// Compute the effective face-mask for a conduit given its shape and rotation.
export function computeFaceMask(shape: ConduitShape, rotation: number): number {
  return rotateMask(BASE_MASKS[shape], rotation);
}

// Direction indices: 0=East, 1=South, 2=West, 3=North.
// For two adjacent conduits A (left) and B (right) where B is to the East of A:
//   direction=0 → A must have East open (bit0), B must have West open (bit2).
const OPPOSITE: [number, number][] = [
  [0, 2], // East  → West
  [1, 3], // South → North
  [2, 0], // West  → East
  [3, 1], // North → South
];

export function facesConnect(
  maskA: number,
  maskB: number,
  direction: 0 | 1 | 2 | 3,
): boolean {
  const [aFace, bFace] = OPPOSITE[direction];
  return ((maskA >> aFace) & 1) === 1 && ((maskB >> bFace) & 1) === 1;
}
