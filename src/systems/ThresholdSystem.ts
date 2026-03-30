// ThresholdSystem: Host-only. Runs after MovementSystem each tick.
//
// Two-phase threshold trigger (Decision from spec):
//  1. Process THRESHOLD_READY messages — set p1Ready / p2Ready flags in GameState.
//  2. If all four conditions hold simultaneously (both avatars on threshold hexes
//     AND both ready flags are true), emit a BoardFlipEvent entity and lock the
//     threshold hexes with Static so this fires exactly once.
//
// The "Confirm Threshold" UI fires ThresholdReadyMessage.ready = true when
// the player is standing on the hex; the same message with ready = false cancels.
// The system checks avatar positions independently every tick so the position
// requirement stays current even if the player moves away after confirming.

import type { IWorld } from 'bitecs';
import { addEntity, addComponent, hasComponent } from 'bitecs';
import {
  Avatar, Position, Threshold, Static, BoardFlipEvent,
} from '@/components';
import { avatarQuery, thresholdQuery } from '@/queries';
import type { GameStateData } from '@/state/GameState';
import type { ThresholdReadyMessage } from '@/network/messages';

export function ThresholdSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (!state.thresholdEnabled) return;

  // ── 1. Process THRESHOLD_READY messages ─────────────────────────────────
  const readyInputs = state.pendingInputs.filter(
    (m): m is ThresholdReadyMessage => m.type === 'THRESHOLD_READY',
  );
  for (const msg of readyInputs) {
    if (msg.senderId === 0) {
      state.thresholdState.p1Ready = msg.ready;
    } else {
      state.thresholdState.p2Ready = msg.ready;
    }
  }
  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'THRESHOLD_READY');

  // ── 2. Check avatar positions against threshold hexes ───────────────────
  const thresholds = thresholdQuery(world);
  const avatars    = avatarQuery(world);

  let p1OnThreshold = false;
  let p2OnThreshold = false;

  for (const aeid of avatars) {
    const playerId = Avatar.playerId[aeid];
    const aq = Position.q[aeid];
    const ar = Position.r[aeid];
    const az = Position.z[aeid];

    for (const teid of thresholds) {
      if (hasComponent(world, Static, teid)) continue; // already locked
      if (
        Position.q[teid] === aq &&
        Position.r[teid] === ar &&
        Position.z[teid] === az
      ) {
        if (playerId === 0) p1OnThreshold = true;
        else                p2OnThreshold = true;
        break;
      }
    }
  }

  // ── 3. All four conditions met → BoardFlipEvent ──────────────────────────
  if (
    p1OnThreshold && p2OnThreshold &&
    state.thresholdState.p1Ready && state.thresholdState.p2Ready
  ) {
    const eventEid = addEntity(world);
    addComponent(world, BoardFlipEvent, eventEid);

    // Lock threshold hexes so they can't trigger a second flip.
    for (const teid of thresholds) {
      if (!hasComponent(world, Static, teid)) addComponent(world, Static, teid);
    }

    // Reset ready flags.
    state.thresholdState.p1Ready = false;
    state.thresholdState.p2Ready = false;

    console.debug('[ThresholdSystem] BoardFlipEvent emitted — threshold locked.');
  }
}
