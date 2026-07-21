// Neuro-Resonance tests (mechanics.md §4.5, SPRINT_026).
//
// Covers the three cost-relevant effects (Discharge, Anchor, Dampening) plus
// Guest-side sync of the new Conduit.base field over MATRIX_STATE_UPDATE.
// Clarity is intentionally not covered here — it has no AP/cost effect, only
// a Scrap Pool render change (MatrixRenderer.ts), consistent with the solver
// also leaving it unmodeled (see LevelSolver.ts's evaluateInsertResonance).

import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld, addEntity, addComponent } from 'bitecs';
import type { IWorld } from 'bitecs';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { GameState } from '@/state/GameState';
import { inventory } from '@/state/InventoryState';
import { entityRegistry } from '@/registry/EntityRegistry';
import { resonanceState } from '@/state/ResonanceState';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery } from '@/queries';
import { computeFaceMask } from '@/utils/ConduitFaceMask';
import { ConduitShape, ConduitBase } from '@/types';
import type {
  InsertConduitMessage, RotateConduitMessage, GameMessage,
} from '@/network/messages';

async function asHost(levelId: string): Promise<IWorld> {
  GameState.localPlayerId = 0;
  GameState.viewPlayerId  = 0;
  return loadLevel(createWorld(), levelId);
}

async function asGuest(levelId: string): Promise<IWorld> {
  GameState.localPlayerId = 1;
  GameState.viewPlayerId  = 1;
  return loadLevel(createWorld(), levelId);
}

function tick(world: IWorld): void {
  runCoreSystems(world, GameState);
}

function drainOutbound(): GameMessage[] {
  const msgs = GameState.outboundMessages;
  GameState.outboundMessages = [];
  return msgs;
}

describe('Neuro-Resonance', () => {
  beforeEach(() => {
    GameState.outboundMessages = [];
    GameState.pendingInputs    = [];
  });

  it('Discharge (EX→IN): the insert that forms the pair grants +1 AP net of its own cost', async () => {
    // level_26 "First Spark": P1 holds an EX-based STRAIGHT plate; column 2
    // row 0 already has an IN-based STRAIGHT plate pre-placed. Inserting
    // fromTop shifts the IN plate to row 1, directly beneath the new EX
    // plate — the exact pair the level was designed to form.
    const world = await asHost('level_26');
    const apBefore = GameState.apPool;
    expect(apBefore).toBe(13);

    const insert: InsertConduitMessage = {
      type: 'INSERT_CONDUIT', column: 2, fromTop: true,
      shape: 0, rotation: 0, sourceEntityId: 'inv_p1_conduit_01', apCost: 2,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(insert);
    tick(world);

    // Net: -2 (insert cost) +1 (Discharge) = -1.
    expect(GameState.apPool).toBe(apBefore - 1);
    expect(GameState.apMax).toBeGreaterThanOrEqual(GameState.apPool);

    // The pair only ever fires once per SPRINT_026's fired-pairs rule — a
    // second, unrelated tick must not grant a second Discharge.
    tick(world);
    expect(GameState.apPool).toBe(apBefore - 1);
  });

  it('Guest sync: Conduit.base propagates through MATRIX_STATE_UPDATE', async () => {
    const host = await asHost('level_26');
    const insert: InsertConduitMessage = {
      type: 'INSERT_CONDUIT', column: 2, fromTop: true,
      shape: 0, rotation: 0, sourceEntityId: 'inv_p1_conduit_01', apCost: 2,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(insert);
    tick(host);
    const outbound = drainOutbound();
    const matrixMsg = outbound.find(m => m.type === 'MATRIX_STATE_UPDATE');
    expect(matrixMsg).toBeDefined();

    const guest = await asGuest('level_26');
    GameState.pendingInputs.push(...outbound);
    tick(guest);

    const conduits = conduitQuery(guest)
      .filter(eid => MatrixNode.column[eid] === 2)
      .sort((a, b) => MatrixNode.row[a] - MatrixNode.row[b]);
    expect(conduits.length).toBe(2);
    expect(Conduit.base[conduits[0]]).toBe(ConduitBase.EX);  // row 0: the inserted plate
    expect(Conduit.base[conduits[1]]).toBe(ConduitBase.IN);  // row 1: shifted down
  });

  it('Anchor (STAB→MOD): when armed, the next Insert costs 1 AP instead of 2', async () => {
    const world = await asHost('level_02'); // P1 holds one base-less STRAIGHT plate
    const apBefore = GameState.apPool;
    resonanceState.anchorActive = true;

    const insert: InsertConduitMessage = {
      type: 'INSERT_CONDUIT', column: 2, fromTop: true,
      shape: 0, rotation: 0, sourceEntityId: inventory.player0[0].entityId, apCost: 2,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(insert);
    tick(world);

    expect(GameState.apPool).toBe(apBefore - 1); // discounted cost, no base → no Discharge
    expect(resonanceState.anchorActive).toBe(false); // consumed
  });

  it('Dampening (IN→EX): when armed, the next Rotate costs 0 AP', async () => {
    const world = await asHost('level_02');

    // Place a rotatable (non-Master-Set) conduit directly, bypassing INSERT
    // entirely, so this test isolates the Rotate discount alone.
    const eid = addEntity(world);
    addComponent(world, Conduit, eid);
    addComponent(world, MatrixNode, eid);
    Conduit.shape[eid]    = ConduitShape.CURVED;
    Conduit.rotation[eid] = 0;
    Conduit.faceMask[eid] = computeFaceMask(ConduitShape.CURVED, 0);
    Conduit.base[eid]     = 0;
    MatrixNode.column[eid] = 2;
    MatrixNode.row[eid]    = 3;
    MatrixNode.abilityType[eid] = 0;
    MatrixNode.active[eid] = 0;
    entityRegistry.register('test_curved_plate', eid);

    const apBefore = GameState.apPool;
    resonanceState.dampeningActive = true;

    const rotate: RotateConduitMessage = {
      type: 'ROTATE_CONDUIT', column: 2, row: 3, apCost: 1,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(rotate);
    tick(world);

    expect(Conduit.rotation[eid]).toBe(1); // rotation still applied
    expect(GameState.apPool).toBe(apBefore); // but free
    expect(resonanceState.dampeningActive).toBe(false); // consumed
  });
});
