// FocusVaultSystem: the optional-content half of mechanic_roadmap.md #8.
//
// A Focus Vault is a *pair* of hex entities (one per dimension) linked by
// FocusNode.id — same pairing convention as APUnlockSystem. When both
// avatars stand on their respective node of an untriggered pair in the same
// tick AND the pool can afford the pair's cost, the Host:
//   1. deducts `cost` AP from the shared pool (SPENDS, never grants),
//   2. marks both entities triggered (one-time activation),
//   3. spawns the described plate at the vault hex via createCollectible,
//   4. broadcasts FOCUS_VAULT so the Guest mirrors both the spend and the
//      newly spawned entity.
//
// Deliberately NEVER load-bearing: no level's required solution may depend
// on triggering one (mechanic_roadmap.md #8's whole justification is that
// it's a genuine, cost-bearing choice, not a hidden requirement). The solver
// has no awareness of this system at all — it doesn't need any, since an
// entity nothing in the required solution ever touches cannot affect a
// solvability proof either way.

import type { IWorld } from 'bitecs';
import { Position, Avatar, FocusNode } from '@/components';
import { focusNodeQuery, avatarQuery } from '@/queries';
import { createCollectible } from '@/entities/ConduitFactory';
import { focusVaults } from '@/state/FocusVaultState';
import { markActivity } from '@/state/GameState';
import type { GameStateData } from '@/state/GameState';
import type { FocusVaultMessage } from '@/network/messages';

function isAvatarAt(
  world: IWorld, playerId: number, q: number, r: number, z: number,
): boolean {
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    const eid = avatars[i];
    if (
      Avatar.playerId[eid] === playerId &&
      Position.q[eid] === q && Position.r[eid] === r && Position.z[eid] === z
    ) return true;
  }
  return false;
}

function markTriggered(world: IWorld, vaultId: number): void {
  const nodes = focusNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (FocusNode.id[eid] === vaultId) FocusNode.triggered[eid] = 1;
  }
}

export function FocusVaultSystem(world: IWorld, state: GameStateData): void {
  // ── Guest: apply authoritative FOCUS_VAULT messages from the Host ────────
  if (state.localPlayerId !== 0) {
    const msgs = state.pendingInputs.filter(
      (m): m is FocusVaultMessage => m.type === 'FOCUS_VAULT',
    );
    for (const msg of msgs) {
      state.apPool = msg.newAP;
      markTriggered(world, msg.vaultId);
      createCollectible(world, {
        type: 'collectible', id: msg.entityId,
        shape: msg.shape, rotation: msg.rotation,
        q: msg.q, r: msg.r, z: msg.z,
      });
    }
    state.pendingInputs = state.pendingInputs.filter(m => m.type !== 'FOCUS_VAULT');
    return;
  }

  // ── Host: detect pair occupancy ──────────────────────────────────────────
  if (state.phase !== 'PLAYING') return;

  const nodes = focusNodeQuery(world);

  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (FocusNode.triggered[eid] === 1) continue;
    if (Position.z[eid] !== 0) continue; // evaluate each pair once, via its Dim A node

    const vaultId = FocusNode.id[eid];

    let partnerEid = -1;
    for (let j = 0; j < nodes.length; j++) {
      const other = nodes[j];
      if (
        other !== eid && FocusNode.id[other] === vaultId &&
        Position.z[other] === 1 && FocusNode.triggered[other] === 0
      ) { partnerEid = other; break; }
    }
    if (partnerEid === -1) continue; // unpaired node — level data error, skip

    const p1OnNode = isAvatarAt(world, 0, Position.q[eid], Position.r[eid], 0);
    const p2OnNode = isAvatarAt(world, 1, Position.q[partnerEid], Position.r[partnerEid], 1);
    if (!p1OnNode || !p2OnNode) continue;

    const cost = FocusNode.cost[eid];
    if (state.apPool < cost) continue; // can't afford it — no trigger, no partial spend

    const spec = focusVaults.get(vaultId);
    if (!spec) continue; // level data error — no vault spec for this pair id

    state.apPool -= cost;
    markTriggered(world, vaultId);
    createCollectible(world, {
      type: 'collectible', id: spec.entityId,
      shape: spec.shape, rotation: spec.rotation,
      q: spec.q, r: spec.r, z: spec.z,
    });

    const msg: FocusVaultMessage = {
      type: 'FOCUS_VAULT', vaultId, newAP: state.apPool,
      entityId: spec.entityId, q: spec.q, r: spec.r, z: spec.z,
      shape: spec.shape, rotation: spec.rotation,
    };
    state.outboundMessages.push(msg);
    markActivity(state, 0);
    markActivity(state, 1);
    console.debug(`[FocusVaultSystem] Vault #${vaultId} opened — −${cost} AP (pool: ${state.apPool}).`);
  }
}
