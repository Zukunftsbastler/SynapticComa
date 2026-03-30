// LevelTransitionSystem: runs last in the tick pipeline (Host-only for event
// side-effects; event entity cleanup is safe on both peers since event entities
// will simply be absent on the Guest's world).
//
// Consumes all four event entity types in a single pass:
//   BoardFlipEvent      — executes board-flip transition effect
//   AvatarDestroyedEvent — increments failureCount; triggers level restart logic
//   P1ExitedEvent       — removes Static from P2's exit hex (activates it)
//   LevelCompleteEvent  — sets phase = 'LEVEL_COMPLETE'
//
// After handling effects each event entity is destroyed with removeEntity so it
// cannot re-trigger its effect in a future tick.
//
// Board-flip effect (stub for Sprint 8 — full level-reload in Sprint 9):
//   The logical effect is that the two hex-grid dimensions swap active hazard
//   configurations. In Sprint 8 this logs the event and resets the round so the
//   game loop continues cleanly. Sprint 9's LevelLoaderSystem will handle the
//   full re-population when level reload is wired.

import type { IWorld } from 'bitecs';
import { removeEntity, hasComponent, removeComponent } from 'bitecs';
import {
  Exit, Static, Dimension,
} from '@/components';
import {
  boardFlipQuery,
  levelCompleteQuery,
  avatarDestroyedQuery,
  p1ExitedQuery,
  exitQuery,
} from '@/queries';
import type { GameStateData } from '@/state/GameState';

export function LevelTransitionSystem(world: IWorld, state: GameStateData): void {
  // ── BoardFlipEvent ─────────────────────────────────────────────────────────
  const flips = boardFlipQuery(world);
  if (flips.length > 0) {
    executeBoardFlip(state);
    for (let i = 0; i < flips.length; i++) removeEntity(world, flips[i]);
  }

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
}

// ── Effect helpers ────────────────────────────────────────────────────────────

function executeBoardFlip(state: GameStateData): void {
  // Full board-flip effect (hazard swap, dimension transition) implemented in
  // Sprint 9 when level JSON is available. For now: transition to next round.
  state.roundNumber += 1;
  console.debug(`[LevelTransitionSystem] Board flip — round ${state.roundNumber}`);
}

function executeAvatarDestroyed(state: GameStateData): void {
  // Level failure. Increment failure counter and pause the simulation.
  // Sprint 9 will trigger full level reload via LevelLoaderSystem.
  state.failureCount += 1;
  state.phase = 'SETUP'; // halt the simulation until reload
  console.debug(
    `[LevelTransitionSystem] Avatar destroyed — failure #${state.failureCount}.`,
  );
}

function executeP1Exited(world: IWorld, state: GameStateData): void {
  // Remove Static from P2's exit hex so it becomes traversable.
  state.p1HasExited = true;
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

function executeLevelComplete(state: GameStateData): void {
  state.phase = 'LEVEL_COMPLETE';
  console.debug('[LevelTransitionSystem] Level complete!');
}
