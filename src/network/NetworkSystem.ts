// NetworkSystem: drains GameState.outboundMessages each tick via peerManager,
// and routes incoming messages (buffered by PeerJSManager) into GameState.pendingInputs.
//
// Incoming Guest→Host messages extend BaseMessage and carry a seq number for
// reorder-safe insertion. Host→Guest messages (STATE_UPDATE, etc.) do not
// extend BaseMessage and are appended as-is (they're authoritative and ordered).
//
// State hash check runs every HASH_INTERVAL ticks — both peers compare position
// hashes; a mismatch logs a desync warning.

import type { IWorld } from 'bitecs';
import { peerManager } from '@/network/PeerJSManager';
import { computeStateHash, checkStateHash } from '@/network/StateHasher';
import type { GameStateData } from '@/state/GameState';
import type { GameMessage, HandshakeMessage, BaseMessage } from '@/network/messages';

// Incoming message buffer — filled by PeerJSManager.onMessage callback.
const incomingBuffer: (GameMessage | HandshakeMessage)[] = [];
let pendingRemoteHash: number | null = null;

/** Call once during initialisation to wire PeerJSManager → NetworkSystem. */
export function initNetworkSystem(
  onHandshake: (msg: HandshakeMessage) => void,
): void {
  peerManager.onMessage(msg => {
    if (msg.type === 'HANDSHAKE') {
      onHandshake(msg as HandshakeMessage);
      return;
    }
    incomingBuffer.push(msg as GameMessage);
  });
}

export function NetworkSystem(world: IWorld, state: GameStateData): void {
  // ── Flush outbound messages ───────────────────────────────────────────────
  for (const msg of state.outboundMessages) {
    peerManager.send(msg);
  }
  state.outboundMessages = [];

  // ── Receive and sort incoming messages ────────────────────────────────────
  if (incomingBuffer.length > 0) {
    // Sort messages that have a seq field (Guest→Host inputs) by seq.
    // Host→Guest messages (no seq) are left in arrival order.
    incomingBuffer.sort((a, b) => {
      const hasSeqA = 'seq' in a;
      const hasSeqB = 'seq' in b;
      if (!hasSeqA || !hasSeqB) return 0;
      return (a as unknown as BaseMessage).seq - (b as unknown as BaseMessage).seq;
    });
    state.pendingInputs.push(...(incomingBuffer as GameMessage[]));
    incomingBuffer.length = 0;
  }

  // ── Periodic state hash check ─────────────────────────────────────────────
  const localHash = computeStateHash(world);
  if (localHash !== null) {
    if (pendingRemoteHash !== null) {
      checkStateHash(localHash, pendingRemoteHash);
      pendingRemoteHash = null;
    }
  }
}
