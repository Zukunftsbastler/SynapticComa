// Guest-side network sync tests (docs/roadmap.md §1 — the highest-risk
// untested surface: "Guest-side mirroring is untested here", unchanged since
// SPRINT_016). Runs the full pipeline headless in Node, exactly like
// WitnessReplay.ts, but as TWO sequential simulations in one process: a
// "Host" phase whose real outbound messages are captured, then a "Guest"
// phase (a completely fresh world + a fresh load of the same level, which
// resets every module-level singleton — entityRegistry, inventory, scrapPool,
// focusVaults — via LevelLoaderSystem's own reset logic) that applies those
// captured messages exactly as a real Guest client would receive them.
//
// This is deliberately NOT a two-process/real-PeerJS test: it verifies the
// message-application logic (GuestSyncSystem, and each system's own Guest
// branch — APUnlockSystem, FocusVaultSystem), which is where the actual
// risk lives, without the complexity of real transport.

import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld, hasComponent } from 'bitecs';
import type { IWorld } from 'bitecs';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { GameState } from '@/state/GameState';
import { inventory } from '@/state/InventoryState';
import { entityRegistry } from '@/registry/EntityRegistry';
import { Position, Static, Conduit, MatrixNode } from '@/components';
import { conduitQuery } from '@/queries';
import type {
  MoveAvatarMessage, InsertConduitMessage, DrawScrapMessage, GameMessage,
} from '@/network/messages';

function insertMsg(
  senderId: 0 | 1, sourceEntityId: string, shape: 0 | 1 | 2 | 3 | 4, column: 2 | 4 = 2,
): InsertConduitMessage {
  return {
    type: 'INSERT_CONDUIT', column, fromTop: true, shape, rotation: 0,
    sourceEntityId, apCost: 2, seq: GameState.outSeq++, senderId, tick: 0,
  };
}

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

// Drains and returns everything the Host would have broadcast this "session"
// so far — mirrors what NetworkSystem does in the real pipeline (never run
// here, since these tests bypass PeerJS entirely).
function drainOutbound(): GameMessage[] {
  const msgs = GameState.outboundMessages;
  GameState.outboundMessages = [];
  return msgs;
}

function moveMsg(who: 1 | 2, dq: number, dr: number): MoveAvatarMessage {
  return {
    type: 'MOVE_AVATAR', entityId: `avatar_p${who}`, dq, dr, jump: false,
    seq: GameState.outSeq++, senderId: (who - 1) as 0 | 1, tick: 0,
  };
}

describe('Guest-side network sync', () => {
  beforeEach(() => {
    GameState.outboundMessages = [];
    GameState.pendingInputs    = [];
  });

  it('mirrors avatar movement via STATE_UPDATE', async () => {
    const host = await asHost('level_01');
    GameState.pendingInputs.push(moveMsg(2, 0, -1)); // P2 one step
    tick(host);
    const outbound = drainOutbound();
    expect(outbound.some(m => m.type === 'STATE_UPDATE')).toBe(true);

    const guest = await asGuest('level_01');
    GameState.pendingInputs.push(...outbound);
    tick(guest);

    const p2 = entityRegistry.get('avatar_p2');
    expect(Position.q[p2]).toBe(0);
    expect(Position.r[p2]).toBe(1); // level_01 spawns P2 at (0,2); moved (0,-1)
  });

  it('mirrors a matrix insert via MATRIX_STATE_UPDATE (full reconcile)', async () => {
    const host = await asHost('level_02'); // P1 holds a STRAIGHT plate
    const invItem = inventory.player0[0];
    expect(invItem).toBeDefined();

    const insert: InsertConduitMessage = {
      type: 'INSERT_CONDUIT', column: 2, fromTop: true,
      shape: invItem.shape as 0 | 1 | 2 | 3 | 4, rotation: 0,
      sourceEntityId: invItem.entityId, apCost: 2,
      seq: GameState.outSeq++, senderId: 0, tick: 0,
    };
    GameState.pendingInputs.push(insert);
    tick(host);
    const outbound = drainOutbound();
    const matrixMsg = outbound.find(m => m.type === 'MATRIX_STATE_UPDATE');
    expect(matrixMsg).toBeDefined();

    const guest = await asGuest('level_02');
    GameState.pendingInputs.push(...outbound);
    tick(guest);

    const conduits = conduitQuery(guest).filter(eid => MatrixNode.column[eid] === 2);
    expect(conduits.length).toBe(1);
    expect(Conduit.shape[conduits[0]]).toBe(invItem.shape);
    expect(MatrixNode.row[conduits[0]]).toBe(0); // top insert -> row 0
  });

  it('mirrors a Shared Unlock trigger via AP_UNLOCK (spends nothing, grants AP)', async () => {
    const host = await asHost('level_02'); // unlock_01 at (-1,1), value 4
    const apBefore = GameState.apPool;

    // Walk both avatars onto the unlock hex: (0,2) -> (0,1) -> (-1,1).
    GameState.pendingInputs.push(moveMsg(1, 0, -1));
    tick(host);
    GameState.pendingInputs.push(moveMsg(1, -1, 0));
    tick(host);
    GameState.pendingInputs.push(moveMsg(2, 0, -1));
    tick(host);
    GameState.pendingInputs.push(moveMsg(2, -1, 0));
    tick(host);
    const outbound = drainOutbound();
    const unlockMsg = outbound.find(m => m.type === 'AP_UNLOCK');
    expect(unlockMsg).toBeDefined();
    expect(GameState.apPool).toBe(apBefore - 4 + 4); // 4 moves to reach the pair, then +4 grant
    const hostFinalAP = GameState.apPool;

    // The Guest applies the SAME sequence of STATE_UPDATEs (each an absolute
    // snapshot, not a delta) followed by AP_UNLOCK in one batched tick — the
    // real property under test is convergence to the Host's authoritative
    // value, regardless of what the Guest's pool happened to start at.
    const guest = await asGuest('level_02');
    GameState.pendingInputs.push(...outbound);
    tick(guest);

    expect(GameState.apPool).toBe(hostFinalAP);
  });

  it('mirrors a Focus Vault trigger via FOCUS_VAULT (spends AP, spawns the plate)', async () => {
    const host = await asHost('level_23'); // vault_01 at (1,1), cost 3
    const apBefore = GameState.apPool;

    GameState.pendingInputs.push(moveMsg(1, 1, -1));
    tick(host);
    GameState.pendingInputs.push(moveMsg(2, 1, -1));
    tick(host);
    const outbound = drainOutbound();
    const vaultMsg = outbound.find(m => m.type === 'FOCUS_VAULT');
    expect(vaultMsg).toBeDefined();
    expect(GameState.apPool).toBe(apBefore - 2 - 3); // 2 moves to reach the pair, then -3 cost
    expect(entityRegistry.has('vault_01_plate')).toBe(true);
    const hostFinalAP = GameState.apPool;

    const guest = await asGuest('level_23');
    GameState.pendingInputs.push(...outbound);
    tick(guest);

    expect(GameState.apPool).toBe(hostFinalAP);
    expect(entityRegistry.has('vault_01_plate')).toBe(true);
    const plateEid = entityRegistry.get('vault_01_plate');
    expect(Position.q[plateEid]).toBe(2);
    expect(Position.r[plateEid]).toBe(0);
  });

  it('mirrors floor collection via COLLECTED, honoring the privacy rule', async () => {
    // level_17 "Signal Chain": col_straight_a sits ON (0,1,0), which is ALSO
    // a LOCKED_RED hazard hex (Static) — deliberate SPRINT_017 design ("a
    // plate hidden ON the red door"). RED must be routed before P1 can even
    // step there; P1's starting STRAIGHT plate does that in one insert.
    const host = await asHost('level_17');
    GameState.pendingInputs.push(insertMsg(0, 'inv_p1_straight', 0));
    tick(host);
    GameState.pendingInputs.push(moveMsg(1, 0, -1));
    tick(host);
    const outbound = drainOutbound();
    const collectedMsg = outbound.find(m => m.type === 'COLLECTED');
    expect(collectedMsg).toBeDefined();
    expect(inventory.player0.some(c => c.entityId === 'col_straight_a')).toBe(true);

    const guest = await asGuest('level_17');
    GameState.pendingInputs.push(...outbound);
    tick(guest);

    // The entity must be gone from the Guest's world (both clients agree the
    // floor tile is empty)...
    expect(entityRegistry.has('col_straight_a')).toBe(false);
    // ...but P1's collection must NEVER reveal the shape into the Guest's own
    // (=P2's) inventory — that's the whole point of the privacy rule.
    expect(inventory.player1.some(c => c.entityId === 'col_straight_a')).toBe(false);
  });

  it('mirrors a Scrap Pool draw via INVENTORY_UPDATE, only for the drawing player', async () => {
    const host = await asHost('level_04'); // "Scrap Pool" — non-empty pool, empty hands
    const draw: DrawScrapMessage = {
      type: 'DRAW_SCRAP', apCost: 1, seq: GameState.outSeq++, senderId: 1, tick: 0,
    };
    GameState.pendingInputs.push(draw); // P2 (the eventual Guest) draws
    tick(host);
    const outbound = drainOutbound();
    const invMsg = outbound.find(m => m.type === 'INVENTORY_UPDATE');
    expect(invMsg).toBeDefined();

    const guest = await asGuest('level_04');
    GameState.pendingInputs.push(...outbound);
    tick(guest);

    // Guest IS player 1 here, so the drawn shape must be revealed.
    expect(inventory.player1.length).toBe(1);
  });

  it('mirrors sequential exit via PHASE_UPDATE, unlocking P2\'s exit on the Guest', async () => {
    const host = await asHost('level_01'); // no matrix requirement — pure movement
    // Walk P1 to their exit (0,-2) from (0,2): 4 steps north.
    for (let i = 0; i < 4; i++) { GameState.pendingInputs.push(moveMsg(1, 0, -1)); tick(host); }
    const outbound = drainOutbound();
    expect(outbound.some(m => m.type === 'PHASE_UPDATE')).toBe(true);
    expect(GameState.p1HasExited).toBe(true);

    const guest = await asGuest('level_01');
    const p2ExitEid = entityRegistry.get('exit_p2');
    expect(hasComponent(guest, Static, p2ExitEid)).toBe(true); // locked pre-sync

    GameState.pendingInputs.push(...outbound);
    tick(guest);

    expect(GameState.p1HasExited).toBe(true);
    expect(hasComponent(guest, Static, p2ExitEid)).toBe(false); // unlocked post-sync
  });
});
