// ResonanceSystem: Host-only. Evaluates Neuro-Resonance (mechanics.md §4.5)
// every tick after MatrixInsertSystem/MatrixRotateSystem have run.
//
// A pair fires once, the moment two based plates become vertically adjacent
// in the same conduit column (col 2 or 4) — including plates already
// adjacent when the level loads, which fires naturally on the first tick
// since `firedPairs` starts empty. Re-scanning an unchanged pair every tick
// is intentionally cheap and side-effect-free: `firedPairs` is keyed by the
// exact ordered (upperEid, lowerEid) identity, so it can only ever fire once
// per distinct pair of physical plates — even if they separate and later
// happen to become re-adjacent (a deliberate simplification flagged in
// SPRINT_026's sprint doc: prevents any separate/rejoin AP-farming loop,
// addressing the balance risk Chris flagged in mechanics.md §4.5).
//
// Dampening/Anchor are consumed by MatrixRotateSystem/MatrixInsertSystem on
// the next action, not the action that formed the pair. Clarity's reveal is
// cleared here whenever a mutation happened this tick, then possibly reset
// if that same mutation formed a new Clarity pair.

import type { IWorld } from 'bitecs';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery } from '@/queries';
import { resonanceState } from '@/state/ResonanceState';
import { scrapPool } from '@/state/ScrapPoolState';
import type { GameStateData } from '@/state/GameState';
import { ConduitBase } from '@/types';

export function ResonanceSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host-only
  if (state.phase !== 'PLAYING') return;

  if (resonanceState.mutatedThisTick) {
    resonanceState.clarityRevealedPlate = null;
  }

  for (const column of [2, 4] as const) {
    const colEntities = conduitQuery(world)
      .filter(eid => MatrixNode.column[eid] === column)
      .sort((a, b) => MatrixNode.row[a] - MatrixNode.row[b]);

    for (let i = 0; i < colEntities.length - 1; i++) {
      const upperEid = colEntities[i];
      const lowerEid = colEntities[i + 1];
      if (MatrixNode.row[lowerEid] !== MatrixNode.row[upperEid] + 1) continue; // not adjacent

      const upperBase = Conduit.base[upperEid];
      const lowerBase = Conduit.base[lowerEid];
      if (upperBase === ConduitBase.NONE || lowerBase === ConduitBase.NONE) continue;

      const key = `${upperEid}:${lowerEid}`;
      if (resonanceState.firedPairs.has(key)) continue;

      const fired = applyResonance(state, upperBase, lowerBase);
      if (fired) resonanceState.firedPairs.add(key);
    }
  }

  resonanceState.mutatedThisTick = false;
}

/** Returns true iff (upperBase, lowerBase) is one of the four valid ordered pairs. */
function applyResonance(state: GameStateData, upperBase: number, lowerBase: number): boolean {
  if (upperBase === ConduitBase.EX && lowerBase === ConduitBase.IN) {
    // Discharge: +1 AP surge to the shared pool.
    state.apPool += 1;
    if (state.apPool > state.apMax) state.apMax = state.apPool;
    resonanceState.totalDischargeCredit += 1;
    console.debug('[ResonanceSystem] Discharge (EX→IN): +1 AP.');
    return true;
  }
  if (upperBase === ConduitBase.IN && lowerBase === ConduitBase.EX) {
    // Dampening: next Rotate costs 0 AP.
    resonanceState.dampeningActive = true;
    console.debug('[ResonanceSystem] Dampening (IN→EX): next Rotate free.');
    return true;
  }
  if (upperBase === ConduitBase.MOD && lowerBase === ConduitBase.STAB) {
    // Clarity: reveal the topmost Scrap Pool plate face-up until the next mutation.
    const top = scrapPool.plates[scrapPool.plates.length - 1] ?? null;
    resonanceState.clarityRevealedPlate = top;
    console.debug('[ResonanceSystem] Clarity (MOD→STAB): top Scrap Pool plate revealed.');
    return true;
  }
  if (upperBase === ConduitBase.STAB && lowerBase === ConduitBase.MOD) {
    // Anchor: next Insert costs 1 AP instead of 2.
    resonanceState.anchorActive = true;
    console.debug('[ResonanceSystem] Anchor (STAB→MOD): next Insert discounted.');
    return true;
  }
  return false;
}
