// All network message types for Synaptic Coma.
// Guest → Host: MOVE_AVATAR, INSERT_CONDUIT, ROTATE_CONDUIT, DRAW_SCRAP,
//               THRESHOLD_READY, PASS
// Host → Guest: STATE_UPDATE, MATRIX_STATE_UPDATE, INVENTORY_UPDATE
// Both → Both (separate channel): CHAT

export interface BaseMessage {
  seq:      number;   // monotonic sequence number per sender
  senderId: 0 | 1;
  tick:     number;
}

export interface MoveAvatarMessage extends BaseMessage {
  type:     'MOVE_AVATAR';
  entityId: string;
  dq:       number;
  dr:       number;
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

export interface PassMessage extends BaseMessage {
  type: 'PASS';
}

// Host → Guest only
export interface StateUpdateMessage {
  type:     'STATE_UPDATE';
  entityId: string;
  q:        number;
  r:        number;
  apPool:   number;
}

// Host → Guest only — full 5×5 matrix after any matrix mutation
export interface MatrixStateUpdateMessage {
  type: 'MATRIX_STATE_UPDATE';
  grid: { shape: number; rotation: number; active: boolean }[][];
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
  | PassMessage
  | StateUpdateMessage
  | MatrixStateUpdateMessage
  | InventoryUpdateMessage;
