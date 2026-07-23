// Covers the state-diff completion predicates for the blocking Monitor
// concepts (MOVE/INSERT/ROTATE/SCRAP_DRAW) — the piece of the Monitor build
// that's genuinely testable logic rather than DOM presentation (consistent
// with this codebase's existing convention of not unit-testing presentation
// classes like HUD.ts/LegendPanel.ts). Each blocking spec must read false
// before the action and true after, using the SAME real system pipeline any
// other test in this project uses (resonance.test.ts/guestSync.test.ts).

import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld } from 'bitecs';
import type { IWorld } from 'bitecs';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { setWorld } from '@/gameLoop';
import { GameState } from '@/state/GameState';
import { scrapPool } from '@/state/ScrapPoolState';
import { CONCEPTS } from '@/tutorial/concepts';
import { ConceptId } from '@/tutorial/TutorialState';
import type {
  MoveAvatarMessage, RotateConduitMessage, InsertConduitMessage, DrawScrapMessage,
} from '@/network/messages';

async function asHost(levelId: string): Promise<IWorld> {
  GameState.localPlayerId = 0;
  GameState.viewPlayerId  = 0;
  const world = await loadLevel(createWorld(), levelId);
  // concepts.ts's predicates import `world` from '@/gameLoop' directly (same
  // pattern LegendPanel.ts already uses) — real gameplay keeps that live via
  // main.ts's setWorld() call after loadLevel(); tests must do the same.
  setWorld(world);
  return world;
}

function tick(world: IWorld): void {
  runCoreSystems(world, GameState);
}

function concept(id: ConceptId) {
  const c = CONCEPTS.find((c) => c.id === id);
  if (!c) throw new Error(`concept ${id} not found in registry`);
  if (!c.blocking) throw new Error(`concept ${id} is not blocking`);
  return c;
}

describe('Monitor blocking completion predicates', () => {
  beforeEach(() => {
    GameState.outboundMessages = [];
    GameState.pendingInputs    = [];
  });

  it('MOVE: false before the avatar moves, true after', async () => {
    const world = await asHost('level_01');
    const spec = concept(ConceptId.MOVE).blocking!();
    const snap = spec.snapshot();
    expect(spec.isComplete(snap)).toBe(false);

    const msg: MoveAvatarMessage = {
      type: 'MOVE_AVATAR', entityId: 'avatar_p1', dq: 0, dr: -1,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(msg);
    tick(world);

    expect(spec.isComplete(snap)).toBe(true);
  });

  it('ROTATE: false before a placed conduit rotates, true after (level_09, pre-placed plates)', async () => {
    const world = await asHost('level_09');
    const spec = concept(ConceptId.ROTATE).blocking!();
    const snap = spec.snapshot();
    expect(spec.isComplete(snap)).toBe(false);

    const msg: RotateConduitMessage = {
      type: 'ROTATE_CONDUIT', column: 2, row: 0, apCost: 1,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(msg);
    tick(world);

    expect(spec.isComplete(snap)).toBe(true);
  });

  it('INSERT: false before the held plate is placed, true after (level_03, P1 starts holding one)', async () => {
    const world = await asHost('level_03');
    const spec = concept(ConceptId.INSERT).blocking!();
    const snap = spec.snapshot();
    expect(spec.isComplete(snap)).toBe(false);

    const msg: InsertConduitMessage = {
      type: 'INSERT_CONDUIT', column: 2, fromTop: true,
      shape: 0, rotation: 0, sourceEntityId: 'inv_p1_conduit_01', apCost: 2,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(msg);
    tick(world);

    expect(spec.isComplete(snap)).toBe(true);
  });

  it('SCRAP_DRAW: false before a blind draw, true after', async () => {
    const world = await asHost('level_01'); // initialAP 8, empty starting inventory
    scrapPool.plates.push({ shape: 0, rotation: 0 });

    const spec = concept(ConceptId.SCRAP_DRAW).blocking!();
    const snap = spec.snapshot();
    expect(spec.isComplete(snap)).toBe(false);

    const msg: DrawScrapMessage = {
      type: 'DRAW_SCRAP', apCost: 1,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(msg);
    tick(world);

    expect(spec.isComplete(snap)).toBe(true);
  });
});
