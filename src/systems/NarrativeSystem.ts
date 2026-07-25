// NarrativeSystem: consumes NarrativeBeatEvent entities and hands their beat
// ids to the campaign controller (docs/narrative.md §5, decisions_needed.md D16).
//
// Mirrors LevelTransitionSystem's role exactly: producers create event
// entities, one consumer executes the effect and destroys them. Today the only
// producer is LevelTransitionSystem's own level-completion handler; the planned
// in-world `NarrativeTrigger` hex emits the identical event, which is the whole
// reason this indirection exists — a second producer costs no change here.
//
// The "effect" is deliberately just a hand-off to GameState.pendingBeats rather
// than opening anything: the cutscene must appear only AFTER the player
// dismisses the LevelComplete screen (D16), which is a UI-flow decision the
// tick pipeline has no business making. Same split as APUnlockSystem, which
// changes the AP pool and lets the HUD notice on its own.
//
// Runs on both peers; on the Guest the query is simply always empty, since the
// event entities are produced by Host-only systems. Networked play instead
// mirrors the beat over CUTSCENE_ADVANCE, matching how the Guest's
// LevelCompleteScreen already waits on the Host.

import type { IWorld } from 'bitecs';
import { removeEntity } from 'bitecs';
import { NarrativeBeatEvent } from '@/components';
import { narrativeBeatQuery } from '@/queries';
import type { GameStateData } from '@/state/GameState';

export function NarrativeSystem(world: IWorld, state: GameStateData): void {
  const beats = narrativeBeatQuery(world);
  for (let i = 0; i < beats.length; i++) {
    const eid = beats[i];
    state.pendingBeats.push(NarrativeBeatEvent.beatId[eid]);
    removeEntity(world, eid);
  }
}
