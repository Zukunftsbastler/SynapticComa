// MouseInput: click/tap an adjacent hex to move the controlled wisp there.
// Complements KeyboardInput — same message type, same routing. The key-hint
// letters drawn on neighbor tiles double as click affordances.
//
// Hit testing: the click is mapped into the controlled wisp's dimension grid
// (pixelToAxial with cube rounding). Only distance-1 targets dispatch a move;
// everything else is ignored (matrix clicks are handled by MatrixUI, whose
// hit zones do not overlap the hex grids).

import { GameState } from '@/state/GameState';
import { world } from '@/gameLoop';
import { entityRegistry } from '@/registry/EntityRegistry';
import { Position } from '@/components';
import { pixelToAxial, hexDistance } from '@/rendering/HexMath';
import type { PixiDriver } from '@/rendering/PixiDriver';
import type { MoveAvatarMessage } from '@/network/messages';
import { HEX_SIZE } from '@/constants';

export function initMouseInput(driver: PixiDriver): void {
  window.addEventListener('click', (e: MouseEvent) => {
    if (GameState.phase !== 'PLAYING') return;

    const avatarId = `avatar_p${GameState.viewPlayerId + 1}`;
    if (!entityRegistry.has(avatarId)) return;
    const eid = entityRegistry.get(avatarId);

    const z = Position.z[eid];
    // Grid origin of the controlled wisp's dimension.
    const origin = z === 0 ? driver.hexToScreenA(0, 0) : driver.hexToScreenB(0, 0);
    const { q, r } = pixelToAxial(e.clientX - origin.x, e.clientY - origin.y, HEX_SIZE);

    // Only react to clicks that land on the board at all.
    if (hexDistance(0, 0, q, r) > GameState.gridRadius) return;

    const dq = q - Position.q[eid];
    const dr = r - Position.r[eid];
    if (hexDistance(0, 0, dq, dr) !== 1) return; // adjacent tiles only

    const msg: MoveAvatarMessage = {
      type:     'MOVE_AVATAR',
      entityId: avatarId,
      dq,
      dr,
      seq:      GameState.outSeq++,
      senderId: GameState.viewPlayerId,
      tick:     0,
    };

    if (GameState.localPlayerId === 0) GameState.pendingInputs.push(msg);
    else                                GameState.outboundMessages.push(msg);
  });
}
