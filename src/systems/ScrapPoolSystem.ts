// ScrapPoolSystem: Host-only. Handles DRAW_SCRAP messages.
// Draws one plate at random from the shared Scrap Pool (blind — player does
// not know the shape until they draw it). Adds it to the drawing player's
// inventory. Deducts 1 AP.
//
// Broadcasts:
//   - MATRIX_STATE_UPDATE (scrap pool count implicitly reflected in HUD)
//   - INVENTORY_UPDATE { playerId, drawnShape } so the Guest's NetworkSystem
//     can add the shape to the Guest's local inventory state, revealing it.

import type { IWorld } from 'bitecs';
import { scrapPool } from '@/state/ScrapPoolState';
import { inventory } from '@/state/InventoryState';
import type { GameStateData } from '@/state/GameState';
import type { DrawScrapMessage, MatrixStateUpdateMessage, InventoryUpdateMessage } from '@/network/messages';
import { buildMatrixStatePayload } from './matrixStateHelpers';

export function ScrapPoolSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  const drawInputs = state.pendingInputs.filter(
    (m): m is DrawScrapMessage => m.type === 'DRAW_SCRAP',
  );

  for (const input of drawInputs) {
    if (state.apPool < 1) continue;
    if (scrapPool.plates.length === 0) continue; // pool empty — reject

    const pid = input.senderId;
    const playerInventory = pid === 0 ? inventory.player0 : inventory.player1;

    // Pick a random plate (blind draw).
    const idx = Math.floor(Math.random() * scrapPool.plates.length);
    const plate = scrapPool.plates.splice(idx, 1)[0];

    playerInventory.push({
      entityId: `scrap_drawn_${Date.now()}`,
      shape:    plate.shape,
      rotation: plate.rotation,
    });

    state.apPool -= 1;

    // Broadcast matrix update (pool count changed).
    const matrixUpdate: MatrixStateUpdateMessage = {
      type: 'MATRIX_STATE_UPDATE',
      grid: buildMatrixStatePayload(world),
    };
    state.outboundMessages.push(matrixUpdate);

    // Reveal the drawn shape to the Guest's client.
    const invUpdate: InventoryUpdateMessage = {
      type:        'INVENTORY_UPDATE',
      playerId:    pid,
      drawnShape:  plate.shape,
    };
    state.outboundMessages.push(invUpdate);
  }

  state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'DRAW_SCRAP');
}
