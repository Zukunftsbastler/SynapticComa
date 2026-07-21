// Role Asymmetry backward-compatibility test (D14/SPRINT_024).
//
// The whole safety argument for shipping this feature without re-verifying
// every existing level by hand is: MatrixNode.restrictedTo defaults to 2
// (unrestricted) for every node that doesn't set it, and an unrestricted
// node must behave EXACTLY like the old single-global-Set AbilitySystem —
// both avatars benefit. This test asserts that property directly, plus the
// restricted case actually restricting.

import { describe, it, expect } from 'vitest';
import { createWorld } from 'bitecs';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { GameState } from '@/state/GameState';
import { abilityFlags } from '@/systems/AbilitySystem';
import type { InsertConduitMessage } from '@/network/messages';

async function loadAsHost(levelId: string) {
  GameState.localPlayerId = 0;
  GameState.viewPlayerId  = 0;
  GameState.pendingInputs = [];
  return loadLevel(createWorld(), levelId);
}

function tick(world: ReturnType<typeof createWorld>): void {
  runCoreSystems(world, GameState);
}

describe('Role Asymmetry backward compatibility', () => {
  it('an unrestricted node (every level before SPRINT_024) benefits BOTH players', async () => {
    // level_03 "Column Shift": one JUMP node (col3 row0), restrictedTo unset
    // (=2, the pre-SPRINT_024 default) — P1's held STRAIGHT plate, top-
    // inserted, completes the route in one action (confirmed via the
    // solver's own witness for this level).
    const world = await loadAsHost('level_03');
    const insert: InsertConduitMessage = {
      type: 'INSERT_CONDUIT', column: 2, fromTop: true,
      shape: 0, rotation: 0, sourceEntityId: 'inv_p1_conduit_01', apCost: 2,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(insert);
    tick(world);
    // AbilitySystem runs BEFORE MatrixInsertSystem in the pipeline, so its
    // flags lag the insert by one tick — a second (no-op) tick lets routing
    // catch up, exactly as it would across two real frames of play.
    tick(world);

    // Old global-AbilitySystem behavior: ANY avatar benefits once powered.
    // P1 did the inserting, but P2 must get JUMP too — that's the whole
    // backward-compat property under test.
    expect(abilityFlags[0].jumpActive).toBe(true);
    expect(abilityFlags[1].jumpActive).toBe(true);
    void world;
  });

  it('a restricted node (level 24) benefits ONLY the assigned player', async () => {
    const world = await loadAsHost('level_24');
    // P2 inserts their own STRAIGHT into col2 top -> powers row0 (JUMP,
    // restrictedTo: 0). Only P1 should get jumpActive; P2 must not.
    const insert: InsertConduitMessage = {
      type: 'INSERT_CONDUIT', column: 2, fromTop: true,
      shape: 0, rotation: 0, sourceEntityId: 'inv_p2_straight', apCost: 2,
      seq: GameState.outSeq++, senderId: 1, tick: 0,
    };
    GameState.pendingInputs.push(insert);
    tick(world);
    tick(world); // let routing catch up (see note above)

    expect(abilityFlags[0].jumpActive).toBe(true);
    expect(abilityFlags[1].jumpActive).toBe(false);
    void world;
  });
});
