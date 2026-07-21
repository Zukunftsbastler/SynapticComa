// EchoTileSystem: local-only, read-only rendering trigger (mechanic_roadmap.md
// #3 "Echo Tiles"). No gameplay effect, no network message — each client
// decides independently whether ITS OWN view should reveal the far
// dimension, the same way the tutorial layer is local-per-client
// (tutorial_design.md §1). Runs identically on Host and Guest; no
// localPlayerId guard.
//
// Mechanism: while the VIEWED avatar stands on an Echo Tile in its own
// dimension, GameState.revealBothDims — the existing local-testing "show
// both boards" flag (RenderSystem's visibility mask, checked nowhere else)
// — is forced true, exactly as if the player had toggled local debug mode.
// The reveal persists for REVEAL_TICKS after last standing on the tile, then
// reverts to whatever the flag was before (false in real networked play,
// true and unaffected in local single-machine testing, where both boards
// are already always shown).

import type { IWorld } from 'bitecs';
import { Position, Dimension, Avatar } from '@/components';
import { avatarQuery, echoTileQuery } from '@/queries';
import type { GameStateData } from '@/state/GameState';

const REVEAL_TICKS = 180; // ~3s at 60 ticks/sec (FIXED_TIMESTEP)

let ticksRemaining = 0;
let baseRevealBothDims = false; // value to restore to once the echo fades

/** Test-only: reset module state between level loads / test cases. */
export function resetEchoTileState(): void {
  ticksRemaining = 0;
  baseRevealBothDims = false;
}

function isViewerOnEchoTile(world: IWorld, state: GameStateData): boolean {
  const avatars = avatarQuery(world);
  let avatarEid = -1;
  for (let i = 0; i < avatars.length; i++) {
    if (Avatar.playerId[avatars[i]] === state.viewPlayerId) { avatarEid = avatars[i]; break; }
  }
  if (avatarEid === -1) return false;
  const aq = Position.q[avatarEid], ar = Position.r[avatarEid], az = Position.z[avatarEid];

  const tiles = echoTileQuery(world);
  for (let i = 0; i < tiles.length; i++) {
    const eid = tiles[i];
    if (Dimension.layer[eid] === az && Position.q[eid] === aq && Position.r[eid] === ar) return true;
  }
  return false;
}

export function EchoTileSystem(world: IWorld, state: GameStateData): void {
  if (state.phase !== 'PLAYING') return;

  if (isViewerOnEchoTile(world, state)) {
    if (ticksRemaining === 0) baseRevealBothDims = state.revealBothDims;
    ticksRemaining = REVEAL_TICKS;
    state.revealBothDims = true;
  } else if (ticksRemaining > 0) {
    ticksRemaining--;
    if (ticksRemaining === 0) state.revealBothDims = baseRevealBothDims;
  }
}
