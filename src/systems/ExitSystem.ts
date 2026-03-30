// ExitSystem: Host-only. Runs after CollisionSystem each tick.
// Implements sequential exit: P1 must step on their exit first, which creates
// a P1ExitedEvent. LevelTransitionSystem removes Static from P2's exit in the
// same tick, making it traversable. P2 stepping on their exit creates a
// LevelCompleteEvent.
//
// On P1 exit:
//   - Movable is removed — P1 can no longer act.
//   - Renderable.visible is set to 0 — P1 wisp disappears from the board.
//   - P1ExitedEvent entity is created for LevelTransitionSystem to consume.
//
// Phase guard: only runs when phase === 'PLAYING'.

import type { IWorld } from 'bitecs';
import { addEntity, addComponent, removeComponent, hasComponent } from 'bitecs';
import {
  Avatar, Position, Exit, Movable, Renderable,
  P1ExitedEvent, LevelCompleteEvent,
} from '@/components';
import { avatarQuery, exitQuery } from '@/queries';
import type { GameStateData } from '@/state/GameState';

export function ExitSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const exits   = exitQuery(world);
  const avatars = avatarQuery(world);

  for (let ei = 0; ei < exits.length; ei++) {
    const exitEid  = exits[ei];
    const playerId = Exit.playerId[exitEid];
    const eq = Position.q[exitEid];
    const er = Position.r[exitEid];
    const ez = Position.z[exitEid];

    for (let ai = 0; ai < avatars.length; ai++) {
      const aeid = avatars[ai];
      if (Avatar.playerId[aeid] !== playerId) continue;
      if (Position.q[aeid] !== eq) continue;
      if (Position.r[aeid] !== er) continue;
      if (Position.z[aeid] !== ez) continue;

      if (playerId === 0 && !state.p1HasExited) {
        // P1 exits.
        state.p1HasExited = true;
        if (hasComponent(world, Movable, aeid)) removeComponent(world, Movable, aeid);
        Renderable.visible[aeid] = 0;

        const evtEid = addEntity(world);
        addComponent(world, P1ExitedEvent, evtEid);

        console.debug('[ExitSystem] P1 exited — P1ExitedEvent emitted.');

      } else if (playerId === 1 && state.p1HasExited) {
        // P2 exits — level complete.
        const evtEid = addEntity(world);
        addComponent(world, LevelCompleteEvent, evtEid);

        console.debug('[ExitSystem] P2 exited — LevelCompleteEvent emitted.');
      }

      break; // only one avatar per exit per tick
    }
  }
}
