import { createWorld } from 'bitecs';
import type { IWorld } from 'bitecs';
import { FIXED_TIMESTEP, MAX_DELTA } from '@/constants';
import { RenderSystem } from '@/systems/RenderSystem';
import type { PixiDriver } from '@/rendering/PixiDriver';

export let world: IWorld = createWorld();

// Set by main.ts after PixiDriver is initialised.
let _driver: PixiDriver | null = null;
let _localPlayerId: 0 | 1 = 0;

export function setDriver(driver: PixiDriver, localPlayerId: 0 | 1): void {
  _driver = driver;
  _localPlayerId = localPlayerId;
}

let accumulator = 0;
let lastTime = 0;

function runSystems(_world: IWorld): void {
  // Systems added sprint-by-sprint. Rendering is done in renderFrame (outside the fixed step).
}

function renderFrame(w: IWorld): void {
  if (_driver) {
    RenderSystem(w, _driver, _localPlayerId);
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
