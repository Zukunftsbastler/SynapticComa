import { defineComponent, Types } from 'bitecs';

// Ephemeral signal components. Each lives on a blank entity for exactly one tick.
// LevelTransitionSystem destroys all event entities at the end of every tick.
// Systems must never hold references to event entity IDs across ticks.

// Emitted by ThresholdSystem when both avatars are on their threshold hexes
// and both players have confirmed Ready.
export const BoardFlipEvent = defineComponent({});

// Emitted by ExitSystem when P2 reaches their exit after P1 has already exited.
export const LevelCompleteEvent = defineComponent({});

// Emitted by CollisionSystem when an avatar's Health.current reaches 0.
export const AvatarDestroyedEvent = defineComponent({ playerId: Types.ui8 });

// Emitted by ExitSystem when P1 steps onto their exit (before P2).
export const P1ExitedEvent = defineComponent({});
