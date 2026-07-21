// Echo Tile test (mechanic_roadmap.md #3, SPRINT_025) — purely a local
// rendering effect: standing on the tile forces GameState.revealBothDims,
// which reverts after the reveal window elapses.

import { describe, it, expect } from 'vitest';
import { createWorld } from 'bitecs';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { GameState } from '@/state/GameState';
import type { MoveAvatarMessage } from '@/network/messages';

async function loadAsHost(levelId: string) {
  GameState.localPlayerId = 0;
  GameState.viewPlayerId  = 0;
  GameState.pendingInputs = [];
  return loadLevel(createWorld(), levelId);
}

function tick(world: ReturnType<typeof createWorld>): void {
  runCoreSystems(world, GameState);
}

describe('Echo Tile (mechanic_roadmap.md #3)', () => {
  it('reveals both dimensions while standing on the tile, then reverts', async () => {
    // level_25 "Thin Place": echo_a at (0,1,0), directly on P1's own path.
    const world = await loadAsHost('level_25');
    expect(GameState.revealBothDims).toBe(false); // real networked default

    const move: MoveAvatarMessage = {
      type: 'MOVE_AVATAR', entityId: 'avatar_p1', dq: 0, dr: -1, jump: false,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(move);
    tick(world); // P1 steps onto (0,1) — the echo tile

    expect(GameState.revealBothDims).toBe(true);

    // Step off; the reveal must persist for a few ticks, not vanish instantly.
    const moveAway: MoveAvatarMessage = {
      type: 'MOVE_AVATAR', entityId: 'avatar_p1', dq: 0, dr: -1, jump: false,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(moveAway);
    tick(world);
    expect(GameState.revealBothDims).toBe(true);

    // Run out the reveal window (well under a second of ticks is enough
    // margin over the ~3s constant without hardcoding its exact value).
    for (let i = 0; i < 400; i++) tick(world);
    expect(GameState.revealBothDims).toBe(false);
  });
});
