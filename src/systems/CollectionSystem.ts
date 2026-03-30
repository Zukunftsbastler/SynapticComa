// CollectionSystem: runs after MovementSystem each tick (Host-only).
// For each avatar, checks whether it shares a hex with any Collectible conduit
// in the same dimension. On match:
//   1. Read shape/rotation from the Conduit component.
//   2. Push a CollectedConduit entry into the owning player's inventory array.
//   3. Remove the entity from ECS and EntityRegistry.
//
// Cost: 0 AP (collection is free; it happens automatically on step-over).
// Floor collectibles render as the ??? icon (CONDUIT_UNKNOWN) until collected.
//
// The Guest learns about removed entities implicitly: the Host stops issuing
// draw commands for them and their position is no longer in any STATE_UPDATE.

import type { IWorld } from 'bitecs';
import { removeEntity } from 'bitecs';
import { Position, Avatar, Conduit, Dimension } from '@/components';
import { avatarQuery, collectibleQuery } from '@/queries';
import { entityRegistry } from '@/registry/EntityRegistry';
import { inventory } from '@/state/InventoryState';
import type { GameStateData } from '@/state/GameState';
import { ConduitShape } from '@/types';

// Secondary reverse map: bitECS eid → registry key, for per-entity cleanup.
// Populated via registerForCollection() when collectible entities are created.
// Cleared on level reload alongside EntityRegistry.clear().
const reverseMap = new Map<number, string>();

export function registerForCollection(key: string, eid: number): void {
  reverseMap.set(eid, key);
}

export function clearCollectionRegistry(): void {
  reverseMap.clear();
}

export function CollectionSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const avatars      = avatarQuery(world);
  const collectibles = collectibleQuery(world);

  for (let ai = 0; ai < avatars.length; ai++) {
    const aeid = avatars[ai];
    const aq   = Position.q[aeid];
    const ar   = Position.r[aeid];
    const az   = Position.z[aeid];
    const pid  = Avatar.playerId[aeid]; // 0 or 1

    // Iterate backwards so we can safely remove during iteration.
    for (let ci = collectibles.length - 1; ci >= 0; ci--) {
      const ceid = collectibles[ci];

      if (Dimension.layer[ceid] !== az) continue;
      if (Position.q[ceid]     !== aq)  continue;
      if (Position.r[ceid]     !== ar)  continue;

      // Add to player inventory.
      const shape    = Conduit.shape[ceid] as ConduitShape;
      const rotation = Conduit.rotation[ceid];
      const key      = reverseMap.get(ceid) ?? `conduit_${ceid}`;

      const playerInventory = pid === 0 ? inventory.player0 : inventory.player1;
      playerInventory.push({ entityId: key, shape, rotation });

      // Clean up registry and ECS entity.
      entityRegistry.delete(key);
      reverseMap.delete(ceid);
      removeEntity(world, ceid);

      console.debug(
        `[CollectionSystem] P${pid + 1} collected ${ConduitShape[shape]} ` +
        `(rot ${rotation}) @ (${aq},${ar}). ` +
        `Inv: P1=${inventory.player0.length} P2=${inventory.player1.length}`,
      );
    }
  }
}
