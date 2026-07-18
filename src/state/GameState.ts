import type { GameMessage } from '@/network/messages';
import { AP_DEFAULT } from '@/constants';

export interface PushAttempt {
  avatarEid: number;
  pushableEid: number;
  dq: number;
  dr: number;
}

export interface GameStateData {
  apPool:           number;
  apMax:            number;
  // Authority role: 0 = Host (authoritative simulation), 1 = Guest.
  localPlayerId:    0 | 1;
  // Which player this client is currently viewing/acting as. In networked
  // play this always equals localPlayerId. In local single-machine mode the
  // Host stays authoritative (localPlayerId 0) while viewPlayerId toggles
  // between 0 and 1 to control either wisp.
  viewPlayerId:     0 | 1;
  pendingInputs:    GameMessage[];
  outboundMessages: GameMessage[];
  currentLevel:     string;
  // True while the Dead End condition holds: AP = 0, no untriggered Shared
  // Unlocks remain, and neither avatar can reach its exit (mechanics.md §7).
  deadEnd:          boolean;
  // Board radius of the current level — movement never leaves this boundary.
  gridRadius:       number;
  thresholdState:   { p1Ready: boolean; p2Ready: boolean };
  thresholdEnabled: boolean;
  phase:            'SETUP' | 'PLAYING' | 'THRESHOLD' | 'LEVEL_COMPLETE';
  // Sequence number for outbound messages — incremented per send.
  outSeq:           number;
  // ECS ID of the singleton APPool entity, set during level load.
  apPoolEid:        number;
  // Tracks whether P1 has already exited (activates P2's exit).
  p1HasExited:      boolean;
  // Failure count for the current level (0 = first attempt, 1 = second = Neural Collapse).
  failureCount:     number;
  // Push attempts written by MovementSystem, consumed by PushSystem each tick.
  pushAttempts:     PushAttempt[];
}

function makeInitialState(): GameStateData {
  return {
    apPool:           AP_DEFAULT,
    apMax:            AP_DEFAULT,
    localPlayerId:    0,
    viewPlayerId:     0,
    pendingInputs:    [],
    outboundMessages: [],
    currentLevel:     '',
    deadEnd:          false,
    gridRadius:       3,
    thresholdState:   { p1Ready: false, p2Ready: false },
    thresholdEnabled: false,
    phase:            'SETUP',
    outSeq:           0,
    apPoolEid:        -1,
    p1HasExited:      false,
    failureCount:     0,
    pushAttempts:     [],
  };
}

export const GameState: GameStateData = makeInitialState();

// Called by LevelLoaderSystem after deleteWorld + createWorld.
export function resetGameState(overrides?: Partial<GameStateData>): void {
  const fresh = makeInitialState();
  Object.assign(GameState, fresh, overrides);
}
