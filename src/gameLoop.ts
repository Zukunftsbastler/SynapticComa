import { createWorld } from 'bitecs';
import type { IWorld } from 'bitecs';
import { FIXED_TIMESTEP, MAX_DELTA } from '@/constants';
import { RenderSystem } from '@/systems/RenderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { NetworkSystem } from '@/network/NetworkSystem';
import { tickTweens } from '@/rendering/TweenManager';
import type { PixiDriver } from '@/rendering/PixiDriver';
import { GameState } from '@/state/GameState';

export let world: IWorld = createWorld();

/** Called by LevelLoaderSystem after deleteWorld + createWorld. */
export function setWorld(newWorld: IWorld): void {
  world = newWorld;
}

// Set by main.ts after PixiDriver and GameState are initialised.
let _driver: PixiDriver | null = null;

export function setDriver(driver: PixiDriver): void {
  _driver = driver;
}

// Optional per-frame UI hook (HUD polling) — runs after RenderSystem each frame.
let _uiHook: (() => void) | null = null;

export function setUiHook(hook: () => void): void {
  _uiHook = hook;
}

let accumulator = 0;
let lastTime = 0;

function runSystems(w: IWorld): void {
  // Fixed-step system pipeline (Decision 2 — Host Authority). Order lives in
  // systems/pipeline.ts (shared with the headless witness-replay gate);
  // transport is appended here because PeerJS is browser-only.
  runCoreSystems(w, GameState);
  NetworkSystem(w, GameState);
}

function renderFrame(w: IWorld): void {
  if (_driver) {
    // viewPlayerId (not localPlayerId): in local mode the Host toggles which
    // dimension it views; in networked play the two ids are identical.
    RenderSystem(w, _driver, GameState.viewPlayerId);
  }
  if (_uiHook) _uiHook();
}

function tick(timestamp: number): void {
  const delta = Math.min(timestamp - lastTime, MAX_DELTA);
  lastTime = timestamp;
  accumulator += delta;

  while (accumulator >= FIXED_TIMESTEP) {
    runSystems(world);
    accumulator -= FIXED_TIMESTEP;
  }

  tickTweens(delta); // advance movement/UI tweens in real time
  renderFrame(world);
  requestAnimationFrame(tick);
}

export function startLoop(): void {
  requestAnimationFrame(tick);
}
