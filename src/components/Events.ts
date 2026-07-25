import { defineComponent, Types } from 'bitecs';

// Ephemeral signal components. Each lives on a blank entity for exactly one tick.
// LevelTransitionSystem destroys all event entities at the end of every tick.
// Systems must never hold references to event entity IDs across ticks.

// Emitted by ExitSystem when P2 reaches their exit after P1 has already exited.
export const LevelCompleteEvent = defineComponent({});

// Emitted by CollisionSystem when an avatar's Health.current reaches 0.
export const AvatarDestroyedEvent = defineComponent({ playerId: Types.ui8 });

// Emitted by ExitSystem when P1 steps onto their exit (before P2).
export const P1ExitedEvent = defineComponent({});

// Emitted whenever a narrative beat becomes due (narrative.md §5). Today the
// only producer is LevelTransitionSystem's level-completion handler; the
// in-world `NarrativeTrigger` hex planned for a later sprint emits the exact
// same event, which is why this is an event entity rather than a direct call:
// producers stay decoupled from the one consumer (NarrativeSystem), matching
// how ExitSystem/CollisionSystem already feed LevelTransitionSystem.
//
// `beatId` is a BeatId enum value (src/narrative/beats.ts) — a number, since
// bitECS components are TypedArrays and cannot hold strings.
export const NarrativeBeatEvent = defineComponent({ beatId: Types.ui16 });
