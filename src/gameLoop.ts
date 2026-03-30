import { createWorld } from 'bitecs';
import type { IWorld } from 'bitecs';
import { FIXED_TIMESTEP, MAX_DELTA } from '@/constants';

export let world: IWorld = createWorld();

let accumulator = 0;
let lastTime = 0;
let tickCount = 0;

function runSystems(_world: IWorld): void {
  // Sprint 1 stub — systems added in subsequent sprints
  tickCount++;
  if (tickCount % 60 === 0) {
    console.log(`tick ${tickCount}`);
  }
}

function renderFrame(_world: IWorld): void {
  // Sprint 1 stub — RenderSystem + PixiDriver added in Sprint 3
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
