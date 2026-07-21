// WitnessReplay: the playability half of the solvability proof.
//
// The solver (LevelSolver.ts) proves a level solvable inside ITS OWN model of
// the rules. This module replays the solver's witness through the REAL game —
// LevelLoaderSystem + the exact fixed-step pipeline (systems/pipeline.ts),
// headless in Node — and asserts every action is accepted with its exact AP
// cost and the run ends in LEVEL_COMPLETE. Any divergence between the solver's
// model and the shipped systems (routing, movement, insert semantics, exit
// sequencing, AP accounting) surfaces here as a named failure instead of a
// player-facing dead level.
//
// Message-level fidelity: each witness action is synthesized as the same
// GameMessage the input/UI layer would produce, under the same producibility
// constraints (moves must be a 1-hex step or an explicit straight-line 2-hex
// jump; inserts must name a plate the acting player actually holds; draws must
// yield the witness's worst-case shape via a stubbed RNG). One action per
// tick, mirroring how routing (start of tick) and matrix mutation (end of
// tick) interleave for real players.
//
// This gate deliberately does NOT touch the DOM: click→message translation is
// covered by the static producer scan in validateLevels (SPRINT_015).

import { createWorld } from 'bitecs';
import type { IWorld } from 'bitecs';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { GameState } from '@/state/GameState';
import { inventory } from '@/state/InventoryState';
import { scrapPool } from '@/state/ScrapPoolState';
import { entityRegistry } from '@/registry/EntityRegistry';
import { Position, APUnlock, Dimension } from '@/components';
import { apUnlockQuery, pushableQuery } from '@/queries';
import { hexDistance } from '@/rendering/HexMath';
import { ConduitShape } from '@/types';
import type { SolverAction } from './LevelSolver';
import type {
  MoveAvatarMessage, InsertConduitMessage, RotateConduitMessage, DrawScrapMessage,
} from '@/network/messages';

export type ReplayResult =
  | { ok: true; ticks: number }
  | { ok: false; step: number; action: SolverAction; reason: string };

const ACTION_COST: Record<SolverAction['kind'], number> = {
  MOVE: 1, PUSH: 1, INSERT: 2, ROTATE: 1, DRAW: 1,
};

// Finds the Pushable entity at (z,q,r), or -1. Push has no dedicated network
// message (see PUSH branch below) — this is how the replay verifies the
// block actually moved, the same way a human player would only see it happen.
function pushableEidAt(world: IWorld, z: number, q: number, r: number): number {
  for (const eid of pushableQuery(world)) {
    if (Dimension.layer[eid] === z && Position.q[eid] === q && Position.r[eid] === r) return eid;
  }
  return -1;
}

function shapeByName(name: string): number {
  const v = ConduitShape[name as keyof typeof ConduitShape];
  if (typeof v !== 'number') throw new Error(`unknown shape "${name}"`);
  return v;
}

export async function replayWitness(
  levelId: string, witness: SolverAction[],
): Promise<ReplayResult> {
  const world: IWorld = await loadLevel(createWorld(), levelId);
  GameState.localPlayerId = 0;
  GameState.viewPlayerId  = 0;

  const tick = (): void => runCoreSystems(world, GameState);
  const realRandom = Math.random;

  // Sum of AP already credited by triggered Shared Unlocks — a MOVE that
  // completes a pair gains +value in the same tick it costs 1, and the cost
  // assertion below must see through that.
  const creditedUnlockAP = (): number => {
    let sum = 0;
    for (const eid of apUnlockQuery(world)) {
      if (APUnlock.triggered[eid] === 1) sum += APUnlock.value[eid];
    }
    // Each pair is two node entities; both carry value + triggered.
    return sum / 2;
  };

  try {
    for (let step = 0; step < witness.length; step++) {
      const action = witness[step];
      const fail = (reason: string): ReplayResult => ({ ok: false, step, action, reason });
      const apBefore     = GameState.apPool;
      const creditBefore = creditedUnlockAP();

      if (action.kind === 'MOVE') {
        const m = /^P([12])→\((-?\d+),(-?\d+)\)( jump)?$/.exec(action.detail);
        if (!m) return fail('unparseable MOVE detail');
        const who = Number(m[1]) as 1 | 2;
        const tq = Number(m[2]), tr = Number(m[3]);
        const jump = m[4] !== undefined;
        const avatarId = `avatar_p${who}`;
        if (!entityRegistry.has(avatarId)) return fail('avatar not in registry');
        const eid = entityRegistry.get(avatarId);
        const dq = tq - Position.q[eid], dr = tr - Position.r[eid];
        const dist = hexDistance(0, 0, dq, dr);
        // UI producibility: 1-hex step, or explicit straight-line 2-hex jump.
        let unitDq: number, unitDr: number;
        if (!jump && dist === 1)      { unitDq = dq;     unitDr = dr; }
        else if (jump && dist === 2 && dq % 2 === 0 && dr % 2 === 0) {
          unitDq = dq / 2; unitDr = dr / 2;
        } else return fail(`move Δ(${dq},${dr})${jump ? ' jump' : ''} is not UI-producible`);

        const msg: MoveAvatarMessage = {
          type: 'MOVE_AVATAR', entityId: avatarId, dq: unitDq, dr: unitDr, jump,
          seq: GameState.outSeq++, senderId: (who - 1) as 0 | 1, tick: 0,
        };
        GameState.pendingInputs.push(msg);
        tick();
        if (Position.q[eid] !== tq || Position.r[eid] !== tr) {
          return fail(`move rejected by MovementSystem (still at ${Position.q[eid]},${Position.r[eid]})`);
        }
      } else if (action.kind === 'PUSH') {
        // No dedicated network message: a push IS a MOVE_AVATAR toward a
        // pushable, interpreted by live game state at receipt time exactly
        // like a real player's directional input (MovementSystem/PushSystem).
        const m = /^P([12]) Δ\((-?\d+),(-?\d+)\) block\((-?\d+),(-?\d+)\)→\((-?\d+),(-?\d+)\)$/
          .exec(action.detail);
        if (!m) return fail('unparseable PUSH detail');
        const who = Number(m[1]) as 1 | 2;
        const dq = Number(m[2]), dr = Number(m[3]);
        const dstQ = Number(m[6]), dstR = Number(m[7]);
        const z = who - 1;
        const avatarId = `avatar_p${who}`;
        if (!entityRegistry.has(avatarId)) return fail('avatar not in registry');
        const eid = entityRegistry.get(avatarId);
        const avatarQBefore = Position.q[eid], avatarRBefore = Position.r[eid];

        const msg: MoveAvatarMessage = {
          type: 'MOVE_AVATAR', entityId: avatarId, dq, dr, jump: false,
          seq: GameState.outSeq++, senderId: (who - 1) as 0 | 1, tick: 0,
        };
        GameState.pendingInputs.push(msg);
        tick();

        if (Position.q[eid] !== avatarQBefore || Position.r[eid] !== avatarRBefore) {
          return fail(`push moved the avatar instead of the block (now at ${Position.q[eid]},${Position.r[eid]})`);
        }
        if (pushableEidAt(world, z, dstQ, dstR) === -1) {
          return fail(`no pushable at expected destination (${dstQ},${dstR})`);
        }
      } else if (action.kind === 'INSERT') {
        const m = /^(\w+) r(\d) col([24]) (top|bottom)$/.exec(action.detail);
        if (!m) return fail('unparseable INSERT detail');
        const shape = shapeByName(m[1]);
        const rotation = Number(m[2]) as 0 | 1 | 2 | 3;
        const column = Number(m[3]) as 2 | 4;
        const fromTop = m[4] === 'top';
        // The acting player must actually hold a plate of this shape
        // (the solver merges inventories; the game does not).
        const owner = inventory.player0.some(c => c.shape === shape) ? 0
                    : inventory.player1.some(c => c.shape === shape) ? 1
                    : null;
        if (owner === null) return fail(`no player holds a ${m[1]} plate`);
        const inv = owner === 0 ? inventory.player0 : inventory.player1;
        const plate = inv.find(c => c.shape === shape)!;

        const msg: InsertConduitMessage = {
          type: 'INSERT_CONDUIT', column, fromTop,
          shape: shape as 0 | 1 | 2 | 3 | 4, rotation,
          sourceEntityId: plate.entityId, apCost: 2,
          seq: GameState.outSeq++, senderId: owner, tick: 0,
        };
        GameState.pendingInputs.push(msg);
        tick();
      } else if (action.kind === 'ROTATE') {
        const m = /^col([24]) row(\d)$/.exec(action.detail);
        if (!m) return fail('unparseable ROTATE detail');
        const msg: RotateConduitMessage = {
          type: 'ROTATE_CONDUIT', column: Number(m[1]) as 2 | 4, row: Number(m[2]),
          apCost: 1, seq: GameState.outSeq++, senderId: 0, tick: 0,
        };
        GameState.pendingInputs.push(msg);
        tick();
      } else if (action.kind === 'DRAW') {
        const m = /^worst-case (\w+)$/.exec(action.detail);
        if (!m) return fail('unparseable DRAW detail');
        const shape = shapeByName(m[1]);
        const idx = scrapPool.plates.findIndex(p => p.shape === shape);
        if (idx === -1) return fail(`scrap pool holds no ${m[1]} plate`);
        // Force the blind draw onto the witness's worst-case shape.
        Math.random = () => (idx + 0.5) / scrapPool.plates.length;
        const msg: DrawScrapMessage = {
          type: 'DRAW_SCRAP', apCost: 1,
          // P2 never exits before the final action — always a legal actor.
          seq: GameState.outSeq++, senderId: 1, tick: 0,
        };
        GameState.pendingInputs.push(msg);
        tick();
        Math.random = realRandom;
      } else {
        return fail(`unknown action kind`);
      }

      // Uniform cost assertion: a rejected input leaves the pool untouched.
      // Unlock surges triggered this tick are netted out first.
      const credit = creditedUnlockAP() - creditBefore;
      const spent  = apBefore + credit - GameState.apPool;
      if (spent !== ACTION_COST[action.kind]) {
        return fail(`expected ${ACTION_COST[action.kind]} AP spent, saw ${spent} (unlock credit ${credit}) — action rejected or mispriced`);
      }
      if (GameState.phase !== 'PLAYING' && step < witness.length - 1) {
        return fail(`phase left PLAYING early (${GameState.phase})`);
      }
    }

    // Let exit/transition events settle, then require completion.
    for (let i = 0; i < 3; i++) tick();
    if (GameState.phase !== 'LEVEL_COMPLETE') {
      return {
        ok: false, step: witness.length - 1, action: witness[witness.length - 1],
        reason: `witness exhausted but phase is ${GameState.phase}, not LEVEL_COMPLETE`,
      };
    }
    return { ok: true, ticks: witness.length + 3 };
  } finally {
    Math.random = realRandom;
  }
}
