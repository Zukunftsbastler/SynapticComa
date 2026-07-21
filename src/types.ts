export enum AbilityType {
  NONE          = 0,
  JUMP          = 1,
  PUSH          = 2,
  UNLOCK_RED    = 3,
  UNLOCK_BLUE   = 4,
  PHASE_SHIFT   = 5,
  FIRE_IMMUNITY = 6,
}

export enum HazardType {
  CHASM       = 0,
  LOCKED_RED  = 1,
  LOCKED_BLUE = 2,
  FIRE        = 3,
  LASER       = 4,
}

export enum ConduitShape {
  STRAIGHT   = 0,
  CURVED     = 1,
  T_JUNCTION = 2,
  CROSS      = 3,
  SPLITTER   = 4,
}

// Neuro-Resonance base glyph (mechanics.md §4.5). NONE means the plate can
// never form a resonance pair — the default for every plate that predates
// SPRINT_026, preserving byte-identical behavior for all existing levels.
export enum ConduitBase {
  NONE = 0,
  EX   = 1, // Glutamate — excitatory
  IN   = 2, // GABA — inhibitory
  MOD  = 3, // Dopamine — modulating
  STAB = 4, // Serotonin — stabilizing
}
