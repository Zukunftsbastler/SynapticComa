// concepts.ts: the Monitor's concept registry (tutorial_design.md §2/§4.1).
// Every element that needs explanation is one entry here — a trigger
// predicate, the Monitor-styled text, WHERE to highlight it (`focus`), and
// whether the box waits for the actual action or just times out
// (`blocking`). This is the single extension point: a new mechanic means
// adding one entry, nothing else in TutorialDirector/TutorialOverlay changes.
//
// `focus`/`blocking` are FUNCTIONS, not static values — resolving which unlock
// node, which conduit, which ability-node cell etc. depends on live level
// state, not just the concept id. `blocking` is a snapshot/isComplete pair
// (state-diff detection, not message interception — see docs/tutorial_design.md
// and the sprint plan for why: every consuming system splices its message out
// of pendingInputs in the same tick it's processed, so there is no
// end-of-tick point where "an action was just processed" is observable as a
// message without touching MovementSystem/MatrixInsertSystem/etc.).
//
// Blocking is only used where the LOCAL player alone completes the step
// (their own move/insert/rotate/draw). Anything that needs the PARTNER to
// act too, or that fires before it's actionable (an ability node existing in
// the matrix, long before it's powered), stays non-blocking with a timeout —
// a hard block on either could stall the tutorial waiting for something
// that isn't imminent.

import { world } from '@/gameLoop';
import {
  Position, Conduit, MatrixNode, APUnlock, FocusNode,
} from '@/components';
import {
  matrixNodeQuery, conduitQuery, apUnlockQuery, focusNodeQuery, echoTileQuery, exitQuery,
} from '@/queries';
import { GameState } from '@/state/GameState';
import { inventory } from '@/state/InventoryState';
import { scrapPool } from '@/state/ScrapPoolState';
import { entityRegistry } from '@/registry/EntityRegistry';
import { AbilityType } from '@/types';
import { ConceptId } from './TutorialState';

// ── Focus target — resolved to screen rect(s) by TutorialOverlay ───────────

export type FocusTarget =
  | { kind: 'hex';         q: number; r: number; z: 0 | 1 }
  | { kind: 'hexes';       hexes: { q: number; r: number; z: 0 | 1 }[] }
  | { kind: 'dom';         selector: string }
  | { kind: 'matrixCell';  column: number; row: number }
  | { kind: 'matrixArrow'; column: number; fromTop: boolean }
  | { kind: 'scrapPile' }
  | { kind: 'matrixPanel' } // coarse cue — the whole tray, for concepts without one pinpointable cell
  | null; // box only, no dim/frame/arrow (e.g. ROLES — no single physical target)

export interface BlockingSpec {
  snapshot: () => unknown;
  isComplete: (snap: unknown) => boolean;
}

export interface ConceptDef {
  id: ConceptId;
  trigger: () => boolean;
  title: string;
  bodyHtml: string;
  focus: () => FocusTarget;
  /** null = non-blocking (box times out after 8s or Enter). */
  blocking: (() => BlockingSpec) | null;
}

// ── Small live-state lookups shared by several concepts ─────────────────────

function viewerInventory() {
  return GameState.viewPlayerId === 0 ? inventory.player0 : inventory.player1;
}

// Does the CURRENT level's matrix contain a node of this ability? (level-START
// briefing — fires the moment the ability EXISTS, not once it's finally
// powered, so both players know to look/ask for it before it matters.)
function levelHasAbility(type: AbilityType): boolean {
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    if (MatrixNode.abilityType[nodes[i]] === type) return true;
  }
  return false;
}

function abilityNodeCell(type: AbilityType): { column: number; row: number } | null {
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (MatrixNode.abilityType[eid] === type) {
      return { column: MatrixNode.column[eid], row: MatrixNode.row[eid] };
    }
  }
  return null;
}

// Role-Asymmetry (D14/SPRINT_024): a restricted node marked for one player.
// restrictedTo 2 = unrestricted (default for every node before SPRINT_024).
function levelHasRestrictedNode(): boolean {
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (MatrixNode.abilityType[eid] === 0) continue; // not an ability node
    if (MatrixNode.restrictedTo[eid] !== 2) return true;
  }
  return false;
}

function restrictedNodeCell(): { column: number; row: number } | null {
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (MatrixNode.abilityType[eid] === 0) continue;
    if (MatrixNode.restrictedTo[eid] !== 2) {
      return { column: MatrixNode.column[eid], row: MatrixNode.row[eid] };
    }
  }
  return null;
}

// ALL untriggered Shared Unlocks in the VIEWED player's own dimension (the
// legend/board are player-sensitive; the highlight should be too) — a level
// can have more than one (level_21 requires two simultaneously), and Till's
// ask (2026-07-24) is exactly this: every relevant instance gets its own
// frame+line, not just the first found.
function unlockNodeHexes(): { q: number; r: number; z: 0 | 1 }[] {
  const nodes = apUnlockQuery(world);
  const out: { q: number; r: number; z: 0 | 1 }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (APUnlock.triggered[eid] === 1) continue;
    if (Position.z[eid] !== GameState.viewPlayerId) continue;
    out.push({ q: Position.q[eid], r: Position.r[eid], z: Position.z[eid] as 0 | 1 });
  }
  return out;
}

function focusNodeHexes(): { q: number; r: number; z: 0 | 1 }[] {
  const nodes = focusNodeQuery(world);
  const out: { q: number; r: number; z: 0 | 1 }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (FocusNode.triggered[eid] === 1) continue;
    if (Position.z[eid] !== GameState.viewPlayerId) continue;
    out.push({ q: Position.q[eid], r: Position.r[eid], z: Position.z[eid] as 0 | 1 });
  }
  return out;
}

function echoTileHexes(): { q: number; r: number; z: 0 | 1 }[] {
  const tiles = echoTileQuery(world);
  const out: { q: number; r: number; z: 0 | 1 }[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const eid = tiles[i];
    if (Position.z[eid] !== GameState.viewPlayerId) continue;
    out.push({ q: Position.q[eid], r: Position.r[eid], z: Position.z[eid] as 0 | 1 });
  }
  return out;
}

// Both exits (own + partner's) — always exactly 2 entities.
function bothExitHexes(): { q: number; r: number; z: 0 | 1 }[] {
  const exits = exitQuery(world);
  const out: { q: number; r: number; z: 0 | 1 }[] = [];
  for (let i = 0; i < exits.length; i++) {
    const eid = exits[i];
    out.push({ q: Position.q[eid], r: Position.r[eid], z: Position.z[eid] as 0 | 1 });
  }
  return out;
}

function localAvatarEid(): number | null {
  const key = `avatar_p${GameState.viewPlayerId + 1}`;
  return entityRegistry.has(key) ? entityRegistry.get(key) : null;
}

// ── The registry ─────────────────────────────────────────────────────────────

export const CONCEPTS: ConceptDef[] = [
  {
    id: ConceptId.ROLES,
    trigger: () => GameState.currentLevel !== '',
    title: 'TWO FRAGMENTS, ONE MIND',
    bodyHtml:
      `The patient's psyche is split.<br><br>` +
      `<b style="color:#8B2FC9">P1 — THE ID</b>: raw impulse. Its dimension is ` +
      `organic, hungry, littered with buried resources.<br>` +
      `<b style="color:#3AAED8">P2 — THE SUPEREGO</b>: cold order. Its dimension ` +
      `is structured, guarded, rule-bound.<br><br>` +
      `You see only your own half of the mind. The DNA Matrix in the middle is ` +
      `the last bridge between you — every plate placed there changes <i>both</i> ` +
      `worlds. <b>Talk about what you need. Stay silent about what you hold.</b>`,
    focus: () => null,
    blocking: null,
  },
  {
    id: ConceptId.MOVE,
    trigger: () => GameState.currentLevel === 'level_01',
    title: 'MOTOR CORTEX RESPONSE REQUIRED',
    bodyHtml:
      `Move your wisp <b>one hex</b> using the lettered keys shown on the ` +
      `neighboring tiles, or click an adjacent tile directly. Each step costs ` +
      `<b>1 AP</b> from the pool you share with your partner.`,
    focus: () => {
      const eid = localAvatarEid();
      if (eid === null) return null;
      return { kind: 'hex', q: Position.q[eid], r: Position.r[eid], z: Position.z[eid] as 0 | 1 };
    },
    blocking: () => {
      const eid = localAvatarEid();
      return {
        snapshot: () => (eid === null ? null : { q: Position.q[eid], r: Position.r[eid] }),
        isComplete: (snap) => {
          if (eid === null || snap === null) return false;
          const s = snap as { q: number; r: number };
          return Position.q[eid] !== s.q || Position.r[eid] !== s.r;
        },
      };
    },
  },
  {
    id: ConceptId.AP_POOL,
    trigger: () => GameState.currentLevel === 'level_01',
    title: 'THE SHARED AP POOL',
    bodyHtml:
      `That vial row is <b>every action point you and your partner have between you</b> — ` +
      `not per-player, shared. It never refills on its own; only a Shared Unlock ` +
      `node (next) grants more. Spend it carefully.`,
    focus: () => ({ kind: 'dom', selector: '[data-tutorial-target="ap-pool"]' }),
    blocking: null,
  },
  {
    id: ConceptId.UNLOCK_NODE,
    trigger: () => {
      const nodes = apUnlockQuery(world);
      for (let i = 0; i < nodes.length; i++) {
        if (APUnlock.triggered[nodes[i]] === 0) return true;
      }
      return false;
    },
    title: 'SHARED UNLOCK DETECTED',
    bodyHtml:
      `The <b style="color:#c9a227">gold node</b> exists in BOTH minds at once.<br><br>` +
      `When <b>both wisps stand on their gold node in the same moment</b>, ` +
      `the pool surges: <b>+AP for everyone</b>. It works once.<br><br>` +
      `AP is shared and never refills on its own — this node and clever routing ` +
      `are the only ways to gain ground.`,
    focus: () => {
      const hexes = unlockNodeHexes();
      return hexes.length > 0 ? { kind: 'hexes', hexes } : null;
    },
    blocking: null, // partner-dependent — can't hard-block on both players cooperating
  },
  {
    id: ConceptId.INSERT,
    trigger: () => viewerInventory().length > 0,
    title: 'YOU HOLD A CONDUIT PLATE',
    bodyHtml:
      `Plates route power through the DNA Matrix. To insert one (<b>2 AP</b>):<br><br>` +
      `1. <b>Click the plate</b> in your P-PLATES panel (bottom left) — the matrix ` +
      `<b style="color:#c9a227">▼/▲ arrows start pulsing</b>.<br>` +
      `2. <b>Click a pulsing arrow</b>: ▼ pushes in from the top, ▲ from the bottom.<br><br>` +
      `The whole column <b>slides one slot</b> — a plate shoved past the far end ` +
      `falls face-down into the Scrap Pool. <i>Where your plate lands depends on ` +
      `which end you push from.</i><br><br>` +
      `<b>Plates only enter at the ends.</b> To reach the middle rows, ` +
      `<b>push more plates in behind</b> — every insert shoves the whole chain ` +
      `one row deeper. Your partner's inserts push your plates too: reaching ` +
      `row 2 or 3 is usually a <i>two-person</i> maneuver.<br><br>` +
      `Hover an arrow <i>before</i> clicking to preview where every plate ends up.<br>` +
      `Keyboard: [TAB] select · [R] pre-rotate (free) · click a placed plate = rotate (1 AP).`,
    focus: () => ({ kind: 'dom', selector: '[data-slot="0"]' }),
    blocking: () => {
      const startLen = viewerInventory().length;
      return {
        snapshot: () => startLen,
        isComplete: (snap) => viewerInventory().length < (snap as number),
      };
    },
  },
  {
    id: ConceptId.ROTATE,
    // Fires once any conduit sits in the matrix — whether pre-placed by the
    // level (the L9 "Forced Rotation" case: explain it before the player
    // ever needs it) or freshly inserted by a player (right after their
    // first insert, same "act on it immediately" principle as INSERT).
    trigger: () => conduitQuery(world).length > 0,
    title: 'ROTATING A PLACED PLATE',
    bodyHtml:
      `A plate already sitting in the matrix isn't fixed — <b>click it</b> to ` +
      `rotate it 90° clockwise for <b>1 AP</b>. The column does not slide; ` +
      `only that one plate's orientation changes, and routing re-runs instantly.<br><br>` +
      `Rotating (1 AP) is often <b>cheaper than a fresh insert</b> (2 AP) when the ` +
      `right shape is already in place — it just needs to face a different way.`,
    focus: () => {
      const conduits = conduitQuery(world);
      if (conduits.length === 0) return null;
      const eid = conduits[0];
      return { kind: 'matrixCell', column: MatrixNode.column[eid], row: MatrixNode.row[eid] };
    },
    blocking: () => {
      const snap = new Map<number, number>();
      for (const eid of conduitQuery(world)) snap.set(eid, Conduit.rotation[eid]);
      return {
        snapshot: () => snap,
        isComplete: (s) => {
          const map = s as Map<number, number>;
          for (const eid of conduitQuery(world)) {
            if (Conduit.rotation[eid] !== map.get(eid)) return true;
          }
          return false;
        },
      };
    },
  },
  {
    id: ConceptId.SCRAP_DRAW,
    // Fires when the pool holds plates while the viewing player's hands are
    // empty — the Level-3 opening position, where drawing is the only way in.
    trigger: () => scrapPool.plates.length > 0 && viewerInventory().length === 0,
    title: 'THE SCRAP POOL',
    bodyHtml:
      `Below the matrix lies a <b>face-down pile</b> of ejected plates. Everyone ` +
      `sees <i>how many</i>; no one sees <i>what</i>.<br><br>` +
      `<b>Click the pile</b> to draw one blind for <b>1 AP</b> — it lands in ` +
      `your private inventory, shape revealed only to you.<br><br>` +
      `You may say you drew. You may <b>never describe the shape</b> — ` +
      `talk about goals, not about plates.`,
    focus: () => ({ kind: 'scrapPile' }),
    blocking: () => {
      const startLen = scrapPool.plates.length;
      return {
        snapshot: () => startLen,
        isComplete: (snap) => scrapPool.plates.length < (snap as number),
      };
    },
  },
  {
    id: ConceptId.JUMP,
    trigger: () => levelHasAbility(AbilityType.JUMP),
    title: '⇈ JUMP NODE IN THE MATRIX',
    bodyHtml:
      `This level's matrix holds a <b>⇈ JUMP node</b>. While it is powered, a ` +
      `wisp can leap <b>2 tiles in a straight line for 1 AP</b> — and the tile ` +
      `in between <b>does not matter</b>: doors, chasms, even walls are vaulted.<br><br>` +
      `<b>Click a tile two steps away</b> (straight line) to jump. With keys, ` +
      `the jump fires automatically when the single step is blocked.<br><br>` +
      `<b>Hold no plates?</b> Then you cannot power ⇈ yourself — tell your ` +
      `partner where you are stuck and what a jump would solve. ` +
      `If the ⇈ path is severed mid-level, the ability dies instantly.`,
    focus: () => {
      const cell = abilityNodeCell(AbilityType.JUMP);
      return cell && { kind: 'matrixCell', ...cell };
    },
    blocking: null,
  },
  {
    id: ConceptId.PHASE_SHIFT,
    trigger: () => levelHasAbility(AbilityType.PHASE_SHIFT),
    title: '◈ PHASE SHIFT NODE IN THE MATRIX',
    bodyHtml:
      `This level's matrix holds a <b>◈ PHASE SHIFT node</b> — a <b>Tier 2</b> ` +
      `ability, in the matrix's rightmost column. Power must cross <i>both</i> ` +
      `conduit layers to reach it: one plate in the near column, one in the far ` +
      `column, each with an open path through.<br><br>` +
      `While active, your wisp passes through <b>ghostly barrier hexes</b> as if ` +
      `they weren't there, for the normal 1 AP move cost. Sever the path and the ` +
      `barriers turn solid again — instantly, mid-step if you're unlucky.`,
    focus: () => {
      const cell = abilityNodeCell(AbilityType.PHASE_SHIFT);
      return cell && { kind: 'matrixCell', ...cell };
    },
    blocking: null,
  },
  {
    id: ConceptId.FIRE_IMMUNITY,
    trigger: () => levelHasAbility(AbilityType.FIRE_IMMUNITY),
    title: '♨ FIRE IMMUNITY NODE IN THE MATRIX',
    bodyHtml:
      `This level's matrix holds a <b>♨ FIRE IMMUNITY node</b> (Tier 2). While ` +
      `powered, smoldering Fire hazards no longer destroy your wisp on contact — ` +
      `walk through for the normal 1 AP.<br><br>` +
      `<b>Don't hold the plate for it?</b> Someone else's board has what you need — ` +
      `describe the fire, not the fix, and let your partner find the route.`,
    focus: () => {
      const cell = abilityNodeCell(AbilityType.FIRE_IMMUNITY);
      return cell && { kind: 'matrixCell', ...cell };
    },
    blocking: null,
  },
  {
    id: ConceptId.PUSH,
    trigger: () => levelHasAbility(AbilityType.PUSH),
    title: '▶ PUSH NODE IN THE MATRIX',
    bodyHtml:
      `This level's matrix holds a <b>▶ PUSH node</b>. While active, moving into ` +
      `an adjacent <b>Impulse Block</b> doesn't step onto it — it shoves the ` +
      `block <b>one hex further in the same direction</b>, for the normal 1 AP. ` +
      `Your wisp stays put; only the block moves.<br><br>` +
      `A block is solid until shoved — plan <i>where</i> it lands before you push. ` +
      `If the space behind it is blocked, the push does nothing (but still costs the AP).`,
    focus: () => {
      const cell = abilityNodeCell(AbilityType.PUSH);
      return cell && { kind: 'matrixCell', ...cell };
    },
    blocking: null,
  },
  {
    id: ConceptId.ROLE_ASYMMETRY,
    // Level-START briefing, same principle as JUMP/PHASE/FIRE/PUSH: explained
    // the moment a restricted node exists, before it matters, so both
    // players know to look for the colored corner tab.
    trigger: levelHasRestrictedNode,
    title: 'A NODE MARKED FOR ONE MIND',
    bodyHtml:
      `A matrix node with a <b style="color:#8B2FC9">violet</b> or ` +
      `<b style="color:#3AAED8">cyan</b> corner tab benefits <i>only</i> that ` +
      `fragment — Id or Superego — even though either of you may route power ` +
      `to it.<br><br>` +
      `Sometimes the plate that powers <i>your</i> ability sits in your ` +
      `<b>partner's</b> hands, and the plate that powers <i>theirs</i> sits in ` +
      `yours. Routing for someone else is not a mistake — for a marked node, ` +
      `it's the only way either of you gets anywhere.`,
    focus: () => {
      const cell = restrictedNodeCell();
      return cell && { kind: 'matrixCell', ...cell };
    },
    blocking: null,
  },
  {
    id: ConceptId.ECHO_TILE,
    // Level-START briefing: fires the moment an Echo Tile exists in the
    // level, regardless of proximity — so players know what the teal hex
    // is BEFORE they step on it, matching the JUMP/PHASE/PUSH pattern.
    trigger: () => echoTileQuery(world).length > 0,
    title: 'A THIN PLACE IN THE SPLIT',
    bodyHtml:
      `The <b style="color:#3A6A6A">teal hex</b> is a thin place — where the ` +
      `wall between minds runs shallow.<br><br>` +
      `Stand on it and <b>both boards become briefly visible to you</b> — ` +
      `their world's shape: walls, hazards, where they stand. Any of their ` +
      `plates still lying on the floor stay face-down; what's in their ` +
      `hands or the Scrap Pool never shows at all.<br><br>` +
      `The reveal fades a few seconds after you step off. <b>Never required</b> ` +
      `— a glimpse, not a shortcut.`,
    focus: () => {
      const hexes = echoTileHexes();
      return hexes.length > 0 ? { kind: 'hexes', hexes } : null;
    },
    blocking: null,
  },
  {
    id: ConceptId.FOCUS_VAULT,
    // Fires on proximity to an untriggered Focus node — mirrors UNLOCK_NODE's
    // pattern exactly, but the framing must be unmistakably optional: this is
    // never required, unlike a Shared Unlock.
    trigger: () => {
      const nodes = focusNodeQuery(world);
      for (let i = 0; i < nodes.length; i++) {
        if (FocusNode.triggered[nodes[i]] === 0) return true;
      }
      return false;
    },
    title: 'FOCUS VAULT DETECTED',
    bodyHtml:
      `The <b style="color:#8A5AC9">violet node</b> exists in both minds at once — ` +
      `like a Shared Unlock, but it <b>costs</b> AP instead of granting it.<br><br>` +
      `Stand together, and the pool pays the price to open a sealed Vault ` +
      `elsewhere on the board — a bonus plate, nothing more.<br><br>` +
      `<b>This is never required.</b> No level needs it solved. Open it only if ` +
      `you can spare the AP and want to know what's behind it.`,
    focus: () => {
      const hexes = focusNodeHexes();
      return hexes.length > 0 ? { kind: 'hexes', hexes } : null;
    },
    blocking: null, // partner-dependent
  },
  {
    id: ConceptId.RESONANCE,
    // Fires the moment the matrix holds any base-bearing plate (Conduit.base
    // !== NONE) — same "explain before it matters" principle as the ability
    // concepts, rather than waiting to detect an actual formed pair (harder
    // to observe cleanly and unnecessary — the player should know the rule
    // before they place the second plate of a pair, not after).
    trigger: () => {
      const conduits = conduitQuery(world);
      for (let i = 0; i < conduits.length; i++) {
        if (Conduit.base[conduits[i]] !== 0) return true;
      }
      return false;
    },
    title: 'NEURO-RESONANCE: BASE PAIRS',
    bodyHtml:
      `Some plates carry a <b>neurotransmitter base</b>. Insert one <b>directly ` +
      `above another</b> in the same column and, if their bases form a known ` +
      `pair, something happens automatically — no extra action, no extra AP.<br><br>` +
      `Order matters: a pair only fires in a specific top/bottom arrangement. ` +
      `Effects range from a one-time AP bonus to discounts on your very next ` +
      `Insert or Rotate.`,
    focus: () => ({ kind: 'matrixPanel' }), // exact base-pair cells are dynamic; a coarse cue is enough
    blocking: null,
  },
  {
    id: ConceptId.DEAD_END,
    trigger: () => GameState.deadEnd,
    title: 'DEAD END',
    bodyHtml:
      `No sequence of legal actions can reach the exits from here — the AP ` +
      `remaining can't cover any remaining path.<br><br>` +
      `<b>Press [ENTER]</b> to restart the level immediately. Your first Dead ` +
      `End on a level is <b>free</b> — no retry consumed.`,
    focus: () => ({ kind: 'dom', selector: '[data-tutorial-target="dead-end"]' }),
    blocking: null,
  },
  {
    id: ConceptId.EXIT_SEQUENCE,
    // Level-START briefing: fires the moment both exits exist, regardless of
    // proximity — the sequential rule needs to be known well before either
    // player reaches their exit, not discovered by surprise at P2's locked one.
    trigger: () => exitQuery(world).length > 0,
    title: 'SEQUENTIAL EXIT',
    bodyHtml:
      `Two Nexus hexes, one per mind. <b>P1 (Id) must exit first</b> — only ` +
      `then does <b>P2's (Superego) exit unlock</b>. Reaching your own exit ` +
      `before your partner is ready accomplishes nothing but waiting.`,
    focus: () => {
      const hexes = bothExitHexes();
      return hexes.length > 0 ? { kind: 'hexes', hexes } : null;
    },
    blocking: null, // partner-dependent
  },
];
