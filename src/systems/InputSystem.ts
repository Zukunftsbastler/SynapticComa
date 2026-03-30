// InputSystem: drains pendingInputs that arrived from the network (Guest → Host)
// and queues them for the authoritative systems to process this tick.
// KeyboardInput.ts handles local key events; InputSystem handles network-received inputs.
// Both ultimately populate GameState.pendingInputs on the Host.

import type { IWorld } from 'bitecs';
import type { GameStateData } from '@/state/GameState';
import type { GameMessage } from '@/network/messages';

// Called by NetworkSystem when a message arrives from the peer.
// Adds the inbound message to pendingInputs so this tick's systems can consume it.
export function enqueueNetworkInput(state: GameStateData, msg: GameMessage): void {
  state.pendingInputs.push(msg);
}

// InputSystem itself does nothing in the fixed-step loop beyond ensuring the
// pendingInputs queue is ready. Each downstream system (MovementSystem,
// APSystem, etc.) filters the queue for its own message types and removes them.
export function InputSystem(_world: IWorld, _state: GameStateData): void {
  // Queue is populated by KeyboardInput (local) and NetworkSystem (remote).
  // No-op here — downstream systems consume from pendingInputs directly.
}
