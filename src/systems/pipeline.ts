// Core fixed-step system pipeline — the single source of truth for system
// order (docs/architecture.md §4). Everything except transport: NetworkSystem
// is appended by gameLoop.ts, because it pulls in PeerJS (browser-only).
// The witness-replay playability gate (generation/WitnessReplay.ts) runs this
// exact pipeline headless in Node — game and proof share one simulation.

import type { IWorld } from 'bitecs';
import type { GameStateData } from '@/state/GameState';
import { InputSystem } from '@/systems/InputSystem';
import { GuestSyncSystem } from '@/systems/GuestSyncSystem';
import { APSystem } from '@/systems/APSystem';
import { MatrixRoutingSystem } from '@/systems/MatrixRoutingSystem';
import { AbilitySystem } from '@/systems/AbilitySystem';
import { MovementSystem } from '@/systems/MovementSystem';
import { PushSystem } from '@/systems/PushSystem';
import { CollectionSystem } from '@/systems/CollectionSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { ExitSystem } from '@/systems/ExitSystem';
import { APUnlockSystem } from '@/systems/APUnlockSystem';
import { FocusVaultSystem } from '@/systems/FocusVaultSystem';
import { MatrixInsertSystem } from '@/systems/MatrixInsertSystem';
import { MatrixRotateSystem } from '@/systems/MatrixRotateSystem';
import { ResonanceSystem } from '@/systems/ResonanceSystem';
import { ScrapPoolSystem } from '@/systems/ScrapPoolSystem';
import { FxSystem } from '@/systems/FxSystem';
import { LevelTransitionSystem } from '@/systems/LevelTransitionSystem';
import { EchoTileSystem } from '@/systems/EchoTileSystem';

export function runCoreSystems(w: IWorld, state: GameStateData): void {
  InputSystem(w, state);
  GuestSyncSystem(w, state);
  APSystem(w, state);
  MatrixRoutingSystem(w);
  AbilitySystem(w);
  MovementSystem(w, state);
  PushSystem(w, state);
  CollectionSystem(w, state);
  CollisionSystem(w, state);
  ExitSystem(w, state);
  APUnlockSystem(w, state);
  FocusVaultSystem(w, state);
  MatrixInsertSystem(w, state);
  MatrixRotateSystem(w, state);
  ResonanceSystem(w, state);
  ScrapPoolSystem(w, state);
  FxSystem(w);
  LevelTransitionSystem(w, state);
  EchoTileSystem(w, state); // local-only, read-only; see EchoTileSystem.ts
}
