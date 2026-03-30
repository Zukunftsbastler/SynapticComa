// APSystem: keeps the APPool singleton entity in sync with GameState.apPool.
// Only runs on the Host (AP is authoritative on the Host; the Guest's display
// is updated by STATE_UPDATE messages from the Host).
// Does NOT deduct AP — that is done by each action system (MovementSystem, etc.)
// immediately when validating an input. APSystem is purely a sync/mirror step.

import type { IWorld } from 'bitecs';
import { APPool } from '@/components';
import type { GameStateData } from '@/state/GameState';

export function APSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only

  const eid = state.apPoolEid;
  if (eid < 0) return; // APPool entity not yet created (pre-level-load)

  // Mirror GameState into the ECS component so HUD queries can read it.
  APPool.current[eid] = state.apPool;
  APPool.max[eid]     = state.apMax;
}
