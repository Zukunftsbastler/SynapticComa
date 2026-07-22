// Multi-hex-spanning cosmetic overlay art (docs/art_pipeline_roadmap.md §1) —
// distinct from SpriteRegistry.SpriteId, which is per-entity game pieces.
// Decals carry no gameplay meaning at all: purely a way to break up the
// otherwise-uniform, repeating floor tiles with occasional larger props
// (a bone/vein cluster on the Id side, a rivet row on the Superego side),
// scattered at random each time a level loads (DecalState.ts) so the board
// doesn't look identical every playthrough.
// Till's ask (2026-07-21): pick from a real collection (~15 target per side,
// 6 each so far) so 3 different ones show up each load, not the same prop
// repeated. DecalState.pickDistinctPaths() draws without replacement from
// whichever list is here — just add more paths as more decals get promoted.
export const DECAL_PATHS_ID: readonly string[] = [
  '/sprites/decal_id_1.webp',
  '/sprites/decal_id_2.webp',
  '/sprites/decal_id_3.webp',
  '/sprites/decal_id_4.webp',
  '/sprites/decal_id_5.webp',
  '/sprites/decal_id_6.webp',
];

export const DECAL_PATHS_SUPEREGO: readonly string[] = [
  '/sprites/decal_superego_1.webp',
  '/sprites/decal_superego_2.webp',
  '/sprites/decal_superego_3.webp',
  '/sprites/decal_superego_4.webp',
  '/sprites/decal_superego_5.webp',
  '/sprites/decal_superego_6.webp',
];
