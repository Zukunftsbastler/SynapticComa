// CollisionSystem: runs after MovementSystem each tick (Host-only).
// For each avatar, checks for a Lethal entity at the same (q, r, z).
// If found and the avatar lacks the matching Resistance, sets Health.current = 0
// and creates an AvatarDestroyedEvent entity (Decision 7 — no EventBus).
//
// Damage types:
//   HazardType.FIRE  (3) — blocked by Resistances.fire = 1
//   HazardType.LASER (4) — blocked by Resistances.laser = 1
//   HazardType.CHASM (0) — always lethal (no resistance available)

import type { IWorld } from 'bitecs';
import { addEntity, addComponent, hasComponent } from 'bitecs';
import {
  Position, Avatar, Health, Lethal, Resistances, Dimension,
  AvatarDestroyedEvent,
} from '@/components';
import { avatarQuery, lethalQuery } from '@/queries';
import type { GameStateData } from '@/state/GameState';
import { HazardType } from '@/types';

export function CollisionSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const avatars = avatarQuery(world);
  const lethals = lethalQuery(world);

  for (let ai = 0; ai < avatars.length; ai++) {
    const aeid = avatars[ai];
    if (Health.current[aeid] === 0) continue; // already destroyed this tick

    const aq = Position.q[aeid];
    const ar = Position.r[aeid];
    const az = Position.z[aeid];

    for (let li = 0; li < lethals.length; li++) {
      const leid = lethals[li];
      if (Position.q[leid] !== aq) continue;
      if (Position.r[leid] !== ar) continue;
      if (Position.z[leid] !== az) continue;

      const hazardType = Lethal.hazardType[leid];

      // Check resistance.
      const hasResistance = (() => {
        if (!hasComponent(world, Resistances, aeid)) return false;
        if (hazardType === HazardType.FIRE  && Resistances.fire[aeid]  === 1) return true;
        if (hazardType === HazardType.LASER && Resistances.laser[aeid] === 1) return true;
        return false;
      })();

      if (hasResistance) continue; // immune — pass through

      // Kill the avatar.
      Health.current[aeid] = 0;

      // Emit AvatarDestroyedEvent entity (consumed by LevelTransitionSystem).
      const eventEid = addEntity(world);
      addComponent(world, AvatarDestroyedEvent, eventEid);
      AvatarDestroyedEvent.playerId[eventEid] = Avatar.playerId[aeid];

      console.debug(
        `[CollisionSystem] P${Avatar.playerId[aeid] + 1} destroyed at (${aq},${ar}) ` +
        `by hazard type ${hazardType}`,
      );

      break; // one lethal per avatar per tick is sufficient
    }
  }
}
