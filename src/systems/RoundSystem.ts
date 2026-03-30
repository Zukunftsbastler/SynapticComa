// RoundSystem: detects AP=0 or a PASS action and resets the AP pool for the next round.
// Host-only. After resetting, broadcasts an updated STATE_UPDATE so the Guest's HUD reflects
// the new pool immediately.

import type { IWorld } from 'bitecs';
import type { GameStateData } from '@/state/GameState';
import type { StateUpdateMessage } from '@/network/messages';

export function RoundSystem(_world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  // Check for a PASS message in the queue.
  const passIdx = state.pendingInputs.findIndex(m => m.type === 'PASS');
  const apExhausted = state.apPool <= 0;

  if (passIdx === -1 && !apExhausted) return;

  // Remove the PASS message (if present).
  if (passIdx !== -1) {
    state.pendingInputs.splice(passIdx, 1);
  }

  // Reset AP pool.
  state.apPool = state.apMax;
  state.roundNumber++;

  // Broadcast the reset to the Guest so HUD stays in sync.
  // We use entityId '' to signal an AP-only update (no position change).
  const update: StateUpdateMessage = {
    type:     'STATE_UPDATE',
    entityId: '',
    q:        0,
    r:        0,
    apPool:   state.apPool,
  };
  state.outboundMessages.push(update);
}
