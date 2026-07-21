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
//
// Role Asymmetry (decisions_needed.md D14, option C — mechanics.md §5.6):
// an ability node MAY be marked `restrictedTo` a single player
// (MatrixNode.restrictedTo, set from level JSON, default 2 = unrestricted).
// Routing itself (MatrixRoutingSystem) stays completely player-agnostic —
// a node is "powered" or not, full stop; the restriction is applied here,
// as a pure filter on WHO benefits from an already-powered node. Every node
// in every level before SPRINT_024 defaults to unrestricted, so this is a
// strict superset of the old global behavior, never a behavior change for
// existing content.

import type { IWorld } from 'bitecs';
import { hasComponent, addComponent, removeComponent } from 'bitecs';
import {
  MatrixNode, Hazard, Static, Resistances, Avatar, Position,
} from '@/components';
import { matrixNodeQuery, hazardQuery, avatarQuery } from '@/queries';
import { AbilityType, HazardType } from '@/types';

interface PlayerAbilityFlags {
  jumpActive:       boolean;
  pushActive:       boolean;
  phaseShiftActive: boolean;
}

function emptyFlags(): PlayerAbilityFlags {
  return { jumpActive: false, pushActive: false, phaseShiftActive: false };
}

// ── Public flags read by MovementSystem and PushSystem, per player ──────────
// Updated each tick by AbilitySystem before those systems run.
export const abilityFlags: Record<0 | 1, PlayerAbilityFlags> = {
  0: emptyFlags(),
  1: emptyFlags(),
};

// Does a powered node of this abilityType benefit `playerId`?
function isAbilityActiveFor(world: IWorld, abilityType: AbilityType, playerId: 0 | 1): boolean {
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (MatrixNode.abilityType[eid] !== abilityType) continue;
    if (MatrixNode.active[eid] !== 1) continue;
    const restrictedTo = MatrixNode.restrictedTo[eid];
    if (restrictedTo === 2 || restrictedTo === playerId) return true;
  }
  return false;
}

export function AbilitySystem(world: IWorld): void {
  // ── Update movement-modifier flags (read by MovementSystem / PushSystem) ──
  for (const p of [0, 1] as const) {
    abilityFlags[p].jumpActive       = isAbilityActiveFor(world, AbilityType.JUMP, p);
    abilityFlags[p].pushActive       = isAbilityActiveFor(world, AbilityType.PUSH, p);
    abilityFlags[p].phaseShiftActive = isAbilityActiveFor(world, AbilityType.PHASE_SHIFT, p);
  }

  // ── UNLOCK_RED / UNLOCK_BLUE: remove/restore Static on locked doors ───────
  // A hazard lives in exactly one dimension (Position.z); the door unlocks
  // iff the ability is active for THAT dimension's owning player (z=0↔P1,
  // z=1↔P2 — the invariant every level and system already assumes).
  const hazards = hazardQuery(world);
  for (let i = 0; i < hazards.length; i++) {
    const eid = hazards[i];
    const owner = Position.z[eid] as 0 | 1;
    let unlockType: AbilityType | null = null;
    if (Hazard.hazardType[eid] === HazardType.LOCKED_RED)  unlockType = AbilityType.UNLOCK_RED;
    if (Hazard.hazardType[eid] === HazardType.LOCKED_BLUE) unlockType = AbilityType.UNLOCK_BLUE;
    if (unlockType === null) continue;

    const active = isAbilityActiveFor(world, unlockType, owner);
    if (active) {
      if (hasComponent(world, Static, eid)) removeComponent(world, Static, eid);
    } else {
      if (!hasComponent(world, Static, eid)) addComponent(world, Static, eid);
    }
  }

  // ── FIRE_IMMUNITY: set Resistances.fire per avatar's own player ───────────
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    const eid = avatars[i];
    const playerId = Avatar.playerId[eid] as 0 | 1;
    if (!hasComponent(world, Resistances, eid)) {
      addComponent(world, Resistances, eid);
    }
    Resistances.fire[eid] = isAbilityActiveFor(world, AbilityType.FIRE_IMMUNITY, playerId) ? 1 : 0;
    // Laser resistance is not controlled by an ability in MVP — stays 0 unless
    // a future ability type sets it.
  }
}
