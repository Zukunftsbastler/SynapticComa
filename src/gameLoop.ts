import { createWorld } from 'bitecs';
import type { IWorld } from 'bitecs';
import { FIXED_TIMESTEP, MAX_DELTA } from '@/constants';
import { RenderSystem } from '@/systems/RenderSystem';
import { InputSystem } from '@/systems/InputSystem';
import { APSystem } from '@/systems/APSystem';
import { RoundSystem } from '@/systems/RoundSystem';
import { MovementSystem } from '@/systems/MovementSystem';
import { CollectionSystem } from '@/systems/CollectionSystem';
import type { PixiDriver } from '@/rendering/PixiDriver';
import { GameState } from '@/state/GameState';

export let world: IWorld = createWorld();

// Set by main.ts after PixiDriver and GameState are initialised.
let _driver: PixiDriver | null = null;

export function setDriver(driver: PixiDriver): void {
  _driver = driver;
}

let accumulator = 0;
let lastTime = 0;

function runSystems(w: IWorld): void {
  // Fixed-step system pipeline (Decision 2 — Host Authority).
  // Systems that are Host-only guard themselves internally.
  InputSystem(w, GameState);
  APSystem(w, GameState);
  RoundSystem(w, GameState);
  MovementSystem(w, GameState);
  CollectionSystem(w, GameState);
  // Sprint 6+: PushSystem, ThresholdSystem, MatrixInsertSystem,
  //            MatrixRotateSystem, ScrapPoolSystem, MatrixRoutingSystem, AbilitySystem,
  //            CollisionSystem, ExitSystem, LevelTransitionSystem, NetworkSystem
}

function renderFrame(w: IWorld): void {
  if (_driver) {
    RenderSystem(w, _driver, GameState.localPlayerId);
  }
}

function tick(timestamp: number): void {
  const delta = Math.min(timestamp - lastTime, MAX_DELTA);
  lastTime = timestamp;
  accumulator += delta;

  while (accumulator >= FIXED_TIMESTEP) {
    runSystems(world);
    accumulator -= FIXED_TIMESTEP;
  }

  renderFrame(world);
  requestAnimationFrame(tick);
}

export function startLoop(): void {
  requestAnimationFrame(tick);
}
