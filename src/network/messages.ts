// All network message types for Synaptic Coma.
// Guest → Host: MOVE_AVATAR, INSERT_CONDUIT, ROTATE_CONDUIT, DRAW_SCRAP,
//               THRESHOLD_READY
// Host → Guest: STATE_UPDATE, MATRIX_STATE_UPDATE, INVENTORY_UPDATE, AP_UNLOCK,
//               COLLECTED, PHASE_UPDATE, LEVEL_LOAD
// Both → Both (separate channel): CHAT

export interface BaseMessage {
  seq:      number;   // monotonic sequence number per sender
  senderId: 0 | 1;
  tick:     number;
}

export interface MoveAvatarMessage extends BaseMessage {
  type:     'MOVE_AVATAR';
  entityId: string;
  dq:       number;   // unit direction delta
  dr:       number;
  /** Explicit 2-hex jump request (mouse click on a distance-2 tile). */
  jump?:    boolean;
}

export interface InsertConduitMessage extends BaseMessage {
  type:           'INSERT_CONDUIT';
  column:         2 | 4;
  fromTop:        boolean;
  shape:          0 | 1 | 2 | 3 | 4;
  rotation:       0 | 1 | 2 | 3;
  sourceEntityId: string;
  apCost:         2;
}

export interface RotateConduitMessage extends BaseMessage {
  type:   'ROTATE_CONDUIT';
  column: 2 | 4;  // conduit-slot column (explicit coordinates, not a regex-parsed string)
  row:    number; // 0-indexed row within the matrix
  apCost: 1;
}

export interface DrawScrapMessage extends BaseMessage {
  type:   'DRAW_SCRAP';
  apCost: 1;
}

export interface ThresholdReadyMessage extends BaseMessage {
  type:  'THRESHOLD_READY';
  ready: boolean;
}

// Host → Guest only — a Shared Unlock fired; Guest syncs pool and marks the
// node pair triggered in its local world (APUnlockSystem consumes this).
export interface ApUnlockMessage {
  type:     'AP_UNLOCK';
  unlockId: number;
  newAP:    number;
}

// Host → Guest only — a Focus Vault pair fired (mechanic_roadmap.md #8).
// Unlike AP_UNLOCK this SPENDS AP; the Guest also materializes the spawned
// plate in its own mirror world (FocusVaultSystem consumes this).
export interface FocusVaultMessage {
  type:     'FOCUS_VAULT';
  vaultId:  number;
  newAP:    number;
  entityId: string;
  q: number; r: number; z: 0 | 1;
  shape: number; rotation: number;
}

// Host → Guest only
export interface StateUpdateMessage {
  type:     'STATE_UPDATE';
  entityId: string;
  q:        number;
  r:        number;
  apPool:   number;
}

// Host → Guest only — full 5×5 matrix after any matrix mutation.
// scrapCount lets the Guest mirror the face-down pile size (count is public
// knowledge; contents never cross the wire — communication_rules.md §4).
export interface MatrixStateUpdateMessage {
  type: 'MATRIX_STATE_UPDATE';
  grid: { shape: number; rotation: number; active: boolean }[][];
  scrapCount: number;
}

// Host → Guest only — an avatar collected a floor conduit. The Guest removes
// the entity; if it was the Guest's own avatar, the plate enters its inventory.
export interface CollectedMessage {
  type:     'COLLECTED';
  entityId: string;
  playerId: 0 | 1;
  shape:    number;
  rotation: number;
}

// Host → Guest only — authoritative game-phase transition (exit sequence,
// failure, level complete). Keeps the Guest's GameState lifecycle in sync.
export interface PhaseUpdateMessage {
  type:         'PHASE_UPDATE';
  phase:        'SETUP' | 'PLAYING' | 'THRESHOLD' | 'LEVEL_COMPLETE';
  p1HasExited:  boolean;
  failureCount: number;
}

// Host → Guest only — the Host is loading a level (next level, failure retry,
// or free Dead End restart). The Guest loads the same level with the same
// carried-over failure count.
export interface LevelLoadMessage {
  type:         'LEVEL_LOAD';
  levelId:      string;
  failureCount: number;
}

// Host → Guest only — reveals the shape drawn blind from the Scrap Pool.
// entityId and rotation are included so the Guest can reference the tile
// in a subsequent InsertConduitMessage without a missing-ID error.
export interface InventoryUpdateMessage {
  type:       'INVENTORY_UPDATE';
  playerId:   0 | 1;
  drawnShape: number;
  rotation:   number;
  entityId:   string;
}

// Separate PeerJS channel — no ECS effect, not included in GameMessage union
export interface ChatMessage {
  type:     'CHAT';
  emoji:    string;
  senderId: 0 | 1;
}

export interface HandshakeMessage {
  type:    'HANDSHAKE';
  nonce:   number;
  levelId: string;
  role:    0 | 1;
}

export type GameMessage =
  | MoveAvatarMessage
  | InsertConduitMessage
  | RotateConduitMessage
  | DrawScrapMessage
  | ThresholdReadyMessage
  | ApUnlockMessage
  | FocusVaultMessage
  | StateUpdateMessage
  | MatrixStateUpdateMessage
  | InventoryUpdateMessage
  | CollectedMessage
  | PhaseUpdateMessage
  | LevelLoadMessage;
