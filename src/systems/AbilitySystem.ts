// AbilitySystem: continuous evaluation — no state diffing, no caching (Decision 7).
// Runs every tick after MatrixRoutingSystem. Reads powered node state and
// reconciles component presence on the relevant entities directly.
//
// hasComponent guards prevent redundant archetype migrations (which are
// expensive in bitECS and create the "permanently unlocked door" bug class).
//
// Ability effects:
//   JUMP (1)          — handled in MovementSystem (range check).
//   PUSH (2)          — handled in PushSystem (activated flag read from here).
//   UNLOCK_RED (3)    — removes Static from LOCKED_RED hazard entities when on.
//   UNLOCK_BLUE (4)   — removes Static from LOCKED_BLUE hazard entities when on.
//   PHASE_SHIFT (5)   — handled in MovementSystem (PhaseBarrier passability).
//   FIRE_IMMUNITY (6) — sets Resistances.fire on all avatars.

import type { IWorld } from 'bitecs';
import { hasComponent, addComponent, removeComponent } from 'bitecs';
import {
  MatrixNode, Hazard, Static, Resistances, Avatar,
} from '@/components';
import { matrixNodeQuery, hazardQuery, avatarQuery } from '@/queries';
import { AbilityType, HazardType } from '@/types';

// ── Public flags read by MovementSystem and PushSystem ───────────────────────
// Updated each tick by AbilitySystem before those systems run.
export const abilityFlags = {
  jumpActive:       false,
  pushActive:       false,
  phaseShiftActive: false,
};

// Check whether any ability node of the given type is currently powered.
function isAbilityActive(world: IWorld, abilityType: AbilityType): boolean {
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (
      MatrixNode.abilityType[eid] === abilityType &&
      MatrixNode.active[eid] === 1
    ) return true;
  }
  return false;
}

export function AbilitySystem(world: IWorld): void {
  // ── Update movement-modifier flags (read by MovementSystem / PushSystem) ──
  abilityFlags.jumpActive       = isAbilityActive(world, AbilityType.JUMP);
  abilityFlags.pushActive       = isAbilityActive(world, AbilityType.PUSH);
  abilityFlags.phaseShiftActive = isAbilityActive(world, AbilityType.PHASE_SHIFT);

  // ── UNLOCK_RED: remove/restore Static on red locked doors ─────────────────
  const unlockRedActive = isAbilityActive(world, AbilityType.UNLOCK_RED);
  const hazards = hazardQuery(world);
  for (let i = 0; i < hazards.length; i++) {
    const eid = hazards[i];
    if (Hazard.hazardType[eid] !== HazardType.LOCKED_RED) continue;
    if (unlockRedActive) {
      if (hasComponent(world, Static, eid)) removeComponent(world, Static, eid);
    } else {
      if (!hasComponent(world, Static, eid)) addComponent(world, Static, eid);
    }
  }

  // ── UNLOCK_BLUE: same pattern for blue locked doors ───────────────────────
  const unlockBlueActive = isAbilityActive(world, AbilityType.UNLOCK_BLUE);
  for (let i = 0; i < hazards.length; i++) {
    const eid = hazards[i];
    if (Hazard.hazardType[eid] !== HazardType.LOCKED_BLUE) continue;
    if (unlockBlueActive) {
      if (hasComponent(world, Static, eid)) removeComponent(world, Static, eid);
    } else {
      if (!hasComponent(world, Static, eid)) addComponent(world, Static, eid);
    }
  }

  // ── FIRE_IMMUNITY: set Resistances.fire on all avatars ────────────────────
  const fireImmunityActive = isAbilityActive(world, AbilityType.FIRE_IMMUNITY);
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    const eid = avatars[i];
    if (!hasComponent(world, Resistances, eid)) {
      addComponent(world, Resistances, eid);
    }
    Resistances.fire[eid]  = fireImmunityActive ? 1 : 0;
    // Laser resistance is not controlled by an ability in MVP — stays 0 unless
    // a future ability type sets it.
  }
}
