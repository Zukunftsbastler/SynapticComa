import { defineComponent, Types } from 'bitecs';

// Visual-effect entity (pure data — RenderSystem interprets, FxSystem ages).
// FX are first-class ECS entities so any system can spawn one from any
// context: attach Fx + Position + Dimension and the effect plays where the
// game event happened, in the right dimension, on whichever client spawned it.
export const Fx = defineComponent({
  kind:     Types.ui8,  // FxKind enum value
  age:      Types.ui16, // ticks lived
  duration: Types.ui16, // ticks until removal
});

export enum FxKind {
  UNLOCK_SURGE   = 0, // gold shockwave — Shared Unlock triggered
  EXIT_DISSOLVE  = 1, // green dissolve — a wisp merged with its Nexus
  LEVEL_COMPLETE = 2, // white pulse — level won
}
