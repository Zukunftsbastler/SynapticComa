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
  localPlayerId:    0 | 1;
  pendingInputs:    GameMessage[];
  outboundMessages: GameMessage[];
  currentLevel:     string;
  roundNumber:      number;
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
    pendingInputs:    [],
    outboundMessages: [],
    currentLevel:     '',
    roundNumber:      1,
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
