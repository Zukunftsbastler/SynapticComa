// Flat-top axial hex coordinate math.
// "Flat-top" means the hex has a flat edge at top and bottom, and points at left and right.

// Axial → pixel center, given hex size S (center-to-corner distance).
export function axialToPixel(q: number, r: number, S: number): { x: number; y: number } {
  return {
    x: S * (3 / 2) * q,
    y: S * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
  };
}

// Returns the 6 corner [x, y] positions of a flat-top hex centered at (cx, cy).
export function hexCorners(cx: number, cy: number, S: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const rad = (Math.PI / 180) * (60 * i);
    return [cx + S * Math.cos(rad), cy + S * Math.sin(rad)] as [number, number];
  });
}

// The 6 axial neighbor directions for a flat-top hex grid.
// Order: E, NE, NW, W, SW, SE
export const HEX_DIRECTIONS: [number, number][] = [
  [ 1,  0],
  [ 1, -1],
  [ 0, -1],
  [-1,  0],
  [-1,  1],
  [ 0,  1],
];

// Returns all hex coordinates within radius r of the origin (0,0).
export function hexesInRadius(radius: number): { q: number; r: number }[] {
  const results: { q: number; r: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min( radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      results.push({ q, r });
    }
  }
  return results;
}
