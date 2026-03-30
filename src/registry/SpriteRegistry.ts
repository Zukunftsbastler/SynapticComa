// Maps SpriteId numbers (stored in Renderable.spriteId TypedArray) to asset paths.
// Art direction per docs/art_and_ui.md: Medical Macabre Diorama.
// Dim A (The Id): organic, obsidian, bone, bruised velvet.
// Dim B (The Superego): surgical steel, frosted glass, fluorescent clinical.
// Conduit Plates: heavy Bakelite / clouded glass with etched grooves.

export const enum SpriteId {
  // --- Hex Grid Floors ---
  HEX_ID_FLOOR         = 0,   // Dim A: dark bruised velvet / aged leather texture
  HEX_SUPEREGO_FLOOR   = 1,   // Dim B: frosted glass / scratched surgical steel

  // --- Avatars (Wisps) ---
  AVATAR_P1            = 2,   // Dim A: jagged obsidian / coagulated resin / yellowed bone
  AVATAR_P2            = 3,   // Dim B: tarnished surgical steel / brushed aluminum

  // --- Hazards ---
  HAZARD_LETHAL_A      = 4,   // Dim A lethal: shards of blackened glass (Repressed Fears)
  HAZARD_LETHAL_B      = 5,   // Dim B lethal: sputtering electrical arcs (Firewall Laser)
  HAZARD_LOCKED_RED    = 6,   // Dim A locked door: fleshy sphincter / braided thorns
  HAZARD_LOCKED_BLUE   = 7,   // Dim B locked door: heavy rusted vault door / jammed puzzle-lock
  HAZARD_FIRE          = 8,   // Fire hazard tile (organic, smoldering)
  HAZARD_PHASE_BARRIER = 9,   // Phase barrier hex (passable only under Phase Shift)

  // --- Conduit Plates (Bakelite / clouded glass with etched pipe grooves) ---
  CONDUIT_STRAIGHT     = 10,
  CONDUIT_CURVED       = 11,
  CONDUIT_T            = 12,
  CONDUIT_CROSS        = 13,  // Master Set only (Level 10+)
  CONDUIT_SPLITTER     = 14,  // Master Set only (Level 10+)
  CONDUIT_UNKNOWN      = 15,  // ??? face-down icon for uncollected floor conduits

  // --- Matrix Nodes ---
  MATRIX_NODE_SOURCE   = 16,  // Source node (col 1): always powered
  MATRIX_NODE_ABILITY  = 17,  // Ability node (col 3/5): unpowered state
  MATRIX_NODE_POWERED  = 18,  // Ability node: powered state (glowing fluid fill)

  // --- Exit / Threshold ---
  EXIT_NEXUS_A         = 19,  // Dim A Nexus Hex exit
  EXIT_NEXUS_B         = 20,  // Dim B Nexus Hex exit
  THRESHOLD_HEX        = 21,  // Threshold trigger hex
}

// Maps SpriteId to the public asset path.
// Paths reference files listed in docs/digital_implementation.md §4.
export const SPRITE_PATHS: Record<SpriteId, string> = {
  [SpriteId.HEX_ID_FLOOR]:         '/sprites/hex_id_floor.webp',
  [SpriteId.HEX_SUPEREGO_FLOOR]:   '/sprites/hex_superego_floor.webp',
  [SpriteId.AVATAR_P1]:            '/sprites/avatar_p1.webp',
  [SpriteId.AVATAR_P2]:            '/sprites/avatar_p2.webp',
  [SpriteId.HAZARD_LETHAL_A]:      '/sprites/hazard_lethal_a.webp',
  [SpriteId.HAZARD_LETHAL_B]:      '/sprites/hazard_lethal_b.webp',
  [SpriteId.HAZARD_LOCKED_RED]:    '/sprites/hazard_locked_red.webp',
  [SpriteId.HAZARD_LOCKED_BLUE]:   '/sprites/hazard_locked_blue.webp',
  [SpriteId.HAZARD_FIRE]:          '/sprites/hazard_fire.webp',
  [SpriteId.HAZARD_PHASE_BARRIER]: '/sprites/hazard_phase_barrier.webp',
  [SpriteId.CONDUIT_STRAIGHT]:     '/ui/conduit_straight.svg',
  [SpriteId.CONDUIT_CURVED]:       '/ui/conduit_curved.svg',
  [SpriteId.CONDUIT_T]:            '/ui/conduit_t.svg',
  [SpriteId.CONDUIT_CROSS]:        '/ui/conduit_cross.svg',
  [SpriteId.CONDUIT_SPLITTER]:     '/ui/conduit_splitter.svg',
  [SpriteId.CONDUIT_UNKNOWN]:      '/ui/conduit_unknown.svg',
  [SpriteId.MATRIX_NODE_SOURCE]:   '/ui/matrix_node_source.svg',
  [SpriteId.MATRIX_NODE_ABILITY]:  '/ui/matrix_node_ability.svg',
  [SpriteId.MATRIX_NODE_POWERED]:  '/ui/matrix_node_powered.svg',
  [SpriteId.EXIT_NEXUS_A]:         '/sprites/exit_nexus_a.webp',
  [SpriteId.EXIT_NEXUS_B]:         '/sprites/exit_nexus_b.webp',
  [SpriteId.THRESHOLD_HEX]:        '/sprites/threshold_hex.webp',
};
