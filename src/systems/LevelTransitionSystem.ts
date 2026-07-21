// LevelTransitionSystem: runs last in the tick pipeline (Host-only for event
// side-effects; event entity cleanup is safe on both peers since event entities
// will simply be absent on the Guest's world).
//
// Consumes all three event entity types in a single pass:
//   AvatarDestroyedEvent — increments failureCount; triggers level restart logic
//   P1ExitedEvent       — removes Static from P2's exit hex (activates it)
//   LevelCompleteEvent  — sets phase = 'LEVEL_COMPLETE'
//
// After handling effects each event entity is destroyed with removeEntity so it
// cannot re-trigger its effect in a future tick.

import type { IWorld } from 'bitecs';
import { removeEntity, hasComponent, removeComponent } from 'bitecs';
import {
  Exit, Static, Dimension,
} from '@/components';
import {
  levelCompleteQuery,
  avatarDestroyedQuery,
  p1ExitedQuery,
  exitQuery,
} from '@/queries';
import type { GameStateData } from '@/state/GameState';
import type { PhaseUpdateMessage } from '@/network/messages';
import { isDeadEnd } from '@/systems/deadEnd';

// Queues an authoritative PHASE_UPDATE for the Guest. Only ever reached on the
// Host: the event entities consumed here are created by Host-only systems.
function broadcastPhase(state: GameStateData): void {
  const msg: PhaseUpdateMessage = {
    type:         'PHASE_UPDATE',
    phase:        state.phase,
    p1HasExited:  state.p1HasExited,
    failureCount: state.failureCount,
  };
  state.outboundMessages.push(msg);
}

export function LevelTransitionSystem(world: IWorld, state: GameStateData): void {
  // ── AvatarDestroyedEvent ───────────────────────────────────────────────────
  const destroyed = avatarDestroyedQuery(world);
  if (destroyed.length > 0) {
    executeAvatarDestroyed(state);
    for (let i = 0; i < destroyed.length; i++) removeEntity(world, destroyed[i]);
  }

  // ── P1ExitedEvent ──────────────────────────────────────────────────────────
  const p1Exited = p1ExitedQuery(world);
  if (p1Exited.length > 0) {
    executeP1Exited(world, state);
    for (let i = 0; i < p1Exited.length; i++) removeEntity(world, p1Exited[i]);
  }

  // ── LevelCompleteEvent ─────────────────────────────────────────────────────
  const completes = levelCompleteQuery(world);
  if (completes.length > 0) {
    executeLevelComplete(state);
    for (let i = 0; i < completes.length; i++) removeEntity(world, completes[i]);
  }

  // ── Dead End evaluation (read-only; runs on both clients) ─────────────────
  // Sets the flag for RenderSystem/HUD; a Dead End allows a free manual
  // restart without consuming the retry (mechanics.md §7).
  const dead = isDeadEnd(world, state);
  if (dead && !state.deadEnd) {
    console.debug('[LevelTransitionSystem] Dead End reached — free restart available.');
  }
  state.deadEnd = dead;
}

// ── Effect helpers ────────────────────────────────────────────────────────────

function executeAvatarDestroyed(state: GameStateData): void {
  // Level failure. Increment failure counter and pause the simulation; the
  // campaign controller (main.ts) reacts to the phase change with a retry
  // reload or the Neural Collapse screen.
  state.failureCount += 1;
  state.phase = 'SETUP'; // halt the simulation until reload
  broadcastPhase(state);
  console.debug(
    `[LevelTransitionSystem] Avatar destroyed — failure #${state.failureCount}.`,
  );
}

/**
 * Removes Static from P2's exit so it becomes traversable. Exported so
 * GuestSyncSystem can apply the same effect when PHASE_UPDATE reports
 * p1HasExited on the Guest's mirror world.
 */
export function activateP2Exit(world: IWorld): void {
  const exits = exitQuery(world);
  for (let i = 0; i < exits.length; i++) {
    const eid = exits[i];
    if (Exit.playerId[eid] === 1 && hasComponent(world, Static, eid)) {
      removeComponent(world, Static, eid);
      console.debug('[LevelTransitionSystem] P1 exited — P2 exit activated.');
      break;
    }
  }
}

function executeP1Exited(world: IWorld, state: GameStateData): void {
  state.p1HasExited = true;
  activateP2Exit(world);
  broadcastPhase(state);
}

function executeLevelComplete(state: GameStateData): void {
  state.phase = 'LEVEL_COMPLETE';
  broadcastPhase(state);
  console.debug('[LevelTransitionSystem] Level complete!');
}
