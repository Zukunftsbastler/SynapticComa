// Translates keyboard events into GameMessage objects.
// Flat-top hex direction mapping (axial coordinates):
//   Q → NW (-1, 0)   E → NE (1, -1)
//   A → SW (-1, 1)   D → SE (1, 0)   [note: flat-top, not pointy-top]
//   W → N  (0, -1)   S → S  (0, 1)
//
// Host (localPlayerId === 0): messages go directly into GameState.pendingInputs.
// Guest (localPlayerId === 1): messages are queued to GameState.outboundMessages
//   for NetworkSystem to forward to the Host. The Guest never mutates ECS state.

import { GameState } from '@/state/GameState';
import type { MoveAvatarMessage, PassMessage } from '@/network/messages';

// Maps KeyboardEvent.key → axial [dq, dr] delta for flat-top hex grid.
const HEX_KEY_MAP: Record<string, [number, number]> = {
  q: [-1,  0],
  e: [ 1, -1],
  a: [-1,  1],
  d: [ 1,  0],
  w: [ 0, -1],
  s: [ 0,  1],
  // P2 uses IJKL (same layout, same logic — both players share the key map
  // and are distinguished by their avatar's entityId, set by the caller).
  i: [ 0, -1],
  k: [ 0,  1],
  j: [-1,  1],
  l: [ 1,  0],
};

// Called once during init. The entityId for the local player's avatar is
// determined after level load and passed in by the game loop.
export function initKeyboardInput(getAvatarEntityId: () => string): void {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (GameState.phase !== 'PLAYING') return;

    const key = e.key.toLowerCase();

    // ── Movement ────────────────────────────────────────────────────────────
    const delta = HEX_KEY_MAP[key];
    if (delta) {
      e.preventDefault();
      const msg: MoveAvatarMessage = {
        type:     'MOVE_AVATAR',
        entityId: getAvatarEntityId(),
        dq:       delta[0],
        dr:       delta[1],
        seq:      GameState.outSeq++,
        senderId: GameState.localPlayerId,
        tick:     0, // filled by NetworkSystem before send
      };

      if (GameState.localPlayerId === 0) {
        // Host: process locally
        GameState.pendingInputs.push(msg);
      } else {
        // Guest: route to Host via NetworkSystem
        GameState.outboundMessages.push(msg);
      }
      return;
    }

    // ── Pass (spacebar) — declares round end, 0 AP cost ────────────────────
    if (e.code === 'Space') {
      e.preventDefault();
      const msg: PassMessage = {
        type:     'PASS',
        seq:      GameState.outSeq++,
        senderId: GameState.localPlayerId,
        tick:     0,
      };

      if (GameState.localPlayerId === 0) {
        GameState.pendingInputs.push(msg);
      } else {
        GameState.outboundMessages.push(msg);
      }
    }
  });
}
