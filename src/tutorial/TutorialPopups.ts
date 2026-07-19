// TutorialPopups: v1 of the Monitor's first-encounter explanations
// (tutorial_design.md §2/§3). The rule this enforces: WHENEVER a new
// mechanic appears for the first time, it MUST be explained.
//
// Each concept has a trigger predicate over live state and a Monitor-styled
// CRT box shown exactly once per profile (TutorialState). One box at a time;
// dismissed by button or Enter. Non-pausing (the fixed-step simulation keeps
// running — cheap AP loss is impossible while the player reads, since nothing
// moves without input).

import { GameState } from '@/state/GameState';
import { world } from '@/gameLoop';
import { inventory } from '@/state/InventoryState';
import { scrapPool } from '@/state/ScrapPoolState';
import { apUnlockQuery, matrixNodeQuery } from '@/queries';
import { APUnlock, MatrixNode } from '@/components';
import { AbilityType } from '@/types';
import { ConceptId, hasSeen, markSeen } from './TutorialState';

// Does the CURRENT level's matrix contain a node of this ability?
// Used for level-START briefings: a mechanic is explained the moment it can
// matter — before it is powered — so players can plan (and talk) toward it.
function levelHasAbility(type: AbilityType): boolean {
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    if (MatrixNode.abilityType[nodes[i]] === type) return true;
  }
  return false;
}

interface Concept {
  id:      ConceptId;
  trigger: () => boolean;
  title:   string;
  bodyHtml: string;
}

const CONCEPTS: Concept[] = [
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
  },
  {
    id: ConceptId.INSERT,
    trigger: () => {
      const inv = GameState.viewPlayerId === 0 ? inventory.player0 : inventory.player1;
      return inv.length > 0;
    },
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
  },
  {
    id: ConceptId.SCRAP_DRAW,
    // Fires when the pool holds plates while the viewing player's hands are
    // empty — the Level-3 opening position, where drawing is the only way in.
    trigger: () => {
      const inv = GameState.viewPlayerId === 0 ? inventory.player0 : inventory.player1;
      return scrapPool.plates.length > 0 && inv.length === 0;
    },
    title: 'THE SCRAP POOL',
    bodyHtml:
      `Below the matrix lies a <b>face-down pile</b> of ejected plates. Everyone ` +
      `sees <i>how many</i>; no one sees <i>what</i>.<br><br>` +
      `<b>Click the pile</b> to draw one blind for <b>1 AP</b> — it lands in ` +
      `your private inventory, shape revealed only to you.<br><br>` +
      `You may say you drew. You may <b>never describe the shape</b> — ` +
      `talk about goals, not about plates.`,
  },
  {
    id: ConceptId.JUMP,
    // Level-START briefing: fires when a ⇈ node exists in the matrix — not
    // when it is finally powered. Whoever cannot route it themselves learns
    // what to ask their partner for; that conversation is the game.
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
  },
];

export class TutorialPopups {
  private container: HTMLElement;
  private activeEl:  HTMLElement | null = null;
  private activeId:  ConceptId | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.activeEl) this.dismiss();
    });
  }

  /** Call each render frame — shows at most one unseen concept at a time. */
  update(): void {
    if (this.activeEl) return;
    if (GameState.phase !== 'PLAYING') return;
    for (const c of CONCEPTS) {
      if (hasSeen(c.id)) continue;
      if (!c.trigger()) continue;
      this.show(c);
      break;
    }
  }

  private show(c: Concept): void {
    this.activeId = c.id;
    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);',
      'width:420px;background:#040a04f5;border:1px solid #2a7a2a;',
      'box-shadow:0 0 30px #10401088;padding:16px 18px;z-index:150;',
      'font-family:monospace;color:#50d050;font-size:0.85rem;line-height:1.5;',
      'text-shadow:0 0 6px #205020;',
    ].join('');
    el.innerHTML =
      `<div style="color:#2a7a2a;letter-spacing:0.2em;font-size:0.7rem;margin-bottom:8px;">▌MONITOR — CALIBRATION▐</div>` +
      `<div style="color:#8fff70;letter-spacing:0.12em;margin-bottom:10px;">${c.title}</div>` +
      `<div>${c.bodyHtml}</div>` +
      `<button id="tut-ok" style="margin-top:14px;background:#0a1e0a;color:#50d050;` +
      `border:1px solid #2a7a2a;padding:6px 18px;font-family:monospace;cursor:pointer;` +
      `letter-spacing:0.15em;">UNDERSTOOD [ENTER]</button>`;
    el.querySelector('#tut-ok')!.addEventListener('click', () => this.dismiss());
    this.container.appendChild(el);
    this.activeEl = el;
  }

  private dismiss(): void {
    if (this.activeId) markSeen(this.activeId);
    this.activeEl?.remove();
    this.activeEl = null;
    this.activeId = null;
  }

  destroy(): void { this.activeEl?.remove(); }
}
