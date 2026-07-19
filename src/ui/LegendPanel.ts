// LegendPanel: the map key Till asked for — every board and matrix element
// present in the CURRENT level, shown as a real graphic swatch (inline SVG in
// the exact game colors) with a one-line explanation. Collapsible; refreshes
// itself once a second so it always matches the loaded level.
//
// Colors are imported from RenderSystem's palette so legend and board can
// never drift apart.

import { world } from '@/gameLoop';
import { GameState } from '@/state/GameState';
import { hasComponent } from 'bitecs';
import { Renderable, Dimension, Static, APUnlock, MatrixNode } from '@/components';
import { renderableQuery, matrixNodeQuery } from '@/queries';
import { SpriteId } from '@/registry/SpriteRegistry';

// ── Swatch builders (inline SVG) ─────────────────────────────────────────────

const hexPoints = (s: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${s + s * Math.cos(a)},${s + s * Math.sin(a)}`);
  }
  return pts.join(' ');
};

const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

function hexSwatch(color: number, ring?: number): string {
  const r = ring !== undefined
    ? `<circle cx="11" cy="11" r="5" fill="${css(ring)}"/>` : '';
  return `<svg width="22" height="22" viewBox="0 0 22 22">` +
    `<polygon points="${hexPoints(11)}" fill="${css(color)}"/>` + r + `</svg>`;
}

function circleSwatch(color: number, ringed = false): string {
  const ring = ringed ? `<circle cx="11" cy="11" r="10" fill="#FFFFFF" opacity="0.35"/>` : '';
  return `<svg width="22" height="22" viewBox="0 0 22 22">${ring}` +
    `<circle cx="11" cy="11" r="8" fill="${css(color)}"/></svg>`;
}

function squareSwatch(color: number, inner?: string): string {
  return `<svg width="22" height="22" viewBox="0 0 22 22">` +
    `<rect x="1" y="1" width="20" height="20" fill="${css(color)}"/>${inner ?? ''}</svg>`;
}

// ── Legend catalogue ─────────────────────────────────────────────────────────

interface LegendItem { swatch: string; label: string }

// Only elements on the VIEWED player's board — everything else is noise for
// this player (the legend is as player-sensitive as the boards themselves).
function boardItems(
  present: Set<SpriteId>, viewId: 0 | 1, exitLocked: boolean,
): LegendItem[] {
  const items: LegendItem[] = [];
  const wispColor = viewId === 0 ? 0x8B2FC9 : 0x3AAED8;
  items.push({ swatch: circleSwatch(wispColor, true), label: 'You (ring = controlled)' });
  items.push({
    swatch: hexSwatch(exitLocked ? 0x14401E : 0x1E8A3C),
    label: exitLocked ? 'Your exit — opens after P1 exits' : 'Your exit — the goal',
  });
  if (present.has(SpriteId.AP_UNLOCK_NODE)) {
    items.push({ swatch: hexSwatch(0xC9A227), label: 'Shared Unlock — both wisps on it: +AP' });
  }
  if (present.has(SpriteId.WALL_HEX)) items.push({ swatch: hexSwatch(0x3A3A42), label: 'Wall' });
  if (present.has(SpriteId.HAZARD_LOCKED_RED)) items.push({ swatch: hexSwatch(0x8B2430), label: 'Red door — open while R is powered' });
  if (present.has(SpriteId.HAZARD_LOCKED_BLUE)) items.push({ swatch: hexSwatch(0x24478B), label: 'Blue door — open while B is powered' });
  if (present.has(SpriteId.HAZARD_FIRE)) items.push({ swatch: hexSwatch(0xB0521A), label: 'Fire — lethal without ♨' });
  if (present.has(SpriteId.HAZARD_LETHAL_A) || present.has(SpriteId.HAZARD_LETHAL_B)) {
    items.push({ swatch: hexSwatch(0x7A1010), label: 'Lethal — never enter; ⇈ jumps across' });
  }
  if (present.has(SpriteId.HAZARD_PHASE_BARRIER)) items.push({ swatch: hexSwatch(0x3A6A78), label: 'Phase barrier — open while ◈ is powered' });
  if (present.has(SpriteId.THRESHOLD_HEX)) items.push({ swatch: hexSwatch(0xD8D8E8), label: 'Threshold — both stand + confirm: one-way flip' });
  if (present.has(SpriteId.CONDUIT_UNKNOWN)) {
    items.push({
      swatch: squareSwatch(0x2A1A2E, `<rect x="6" y="6" width="10" height="10" fill="#D8CCAA"/>`),
      label: 'Face-down plate — walk over it to collect',
    });
  }
  return items;
}

const ABILITY_LABELS: Record<number, string> = {
  1: '⇈ jump (2 hexes, leaps obstacles)',
  2: '▶ push blocks',
  3: 'R opens red doors',
  4: 'B opens blue doors',
  5: '◈ pass phase barriers',
  6: '♨ fire immunity',
};

function matrixItems(presentAbilities: Set<number>): LegendItem[] {
  const items: LegendItem[] = [
    { swatch: squareSwatch(0xD4820A, `<circle cx="11" cy="11" r="5" fill="#FFCC44"/>`),
      label: 'Source — always powered; flow is left→right' },
    { swatch: squareSwatch(0x3D2E12, `<rect x="2" y="9" width="18" height="4" fill="#2A1E08"/>`),
      label: 'Plate — grooves carry power · click = rotate (1 AP) · ▼/▲ = insert (2 AP)' },
    { swatch: squareSwatch(0x50D050, `<circle cx="11" cy="11" r="6" fill="#8FFF70"/>`),
      label: 'Ability node — green = powered:' },
  ];
  for (const [type, label] of Object.entries(ABILITY_LABELS)) {
    if (presentAbilities.has(Number(type))) {
      items.push({ swatch: '<svg width="22" height="22"></svg>', label });
    }
  }
  return items;
}

// ── Panel ────────────────────────────────────────────────────────────────────

export class LegendPanel {
  private el:        HTMLElement;
  private body:      HTMLElement;
  private collapsed = false;
  private frame     = 0;
  private lastViewId: 0 | 1 = 0;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;right:8px;top:150px;width:280px;max-height:440px;',
      'background:#0c0a08ee;border:1px solid #3a2508;font-family:monospace;',
      'color:#c8a87c;font-size:0.68rem;z-index:25;overflow-y:auto;',
    ].join('');

    const header = document.createElement('div');
    header.textContent = '▤ LEGEND (click to toggle)';
    header.style.cssText = [
      'padding:5px 8px;color:#7a6040;letter-spacing:0.12em;cursor:pointer;',
      'border-bottom:1px solid #2a1a08;user-select:none;',
    ].join('');
    header.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.body.style.display = this.collapsed ? 'none' : 'block';
    });

    this.body = document.createElement('div');
    this.body.style.cssText = 'padding:6px 8px;';

    this.el.appendChild(header);
    this.el.appendChild(this.body);
    container.appendChild(this.el);
    this.refresh();
  }

  /** Call each render frame — refreshes on wisp switch, else once a second. */
  update(): void {
    if (GameState.viewPlayerId !== this.lastViewId) {
      this.lastViewId = GameState.viewPlayerId;
      this.refresh();
      return;
    }
    if (++this.frame % 60 !== 0) return;
    this.refresh();
  }

  private refresh(): void {
    const viewId = GameState.viewPlayerId;

    // Scan only the VIEWED player's dimension — P2's hazards are irrelevant
    // to P1 and vice versa.
    const present = new Set<SpriteId>();
    let exitLocked = false;
    const rs = renderableQuery(world);
    for (let i = 0; i < rs.length; i++) {
      const eid = rs[i];
      if (Dimension.layer[eid] !== viewId) continue;
      const sid = Renderable.spriteId[eid] as SpriteId;
      const isOwnExit = viewId === 0
        ? sid === SpriteId.EXIT_NEXUS_A : sid === SpriteId.EXIT_NEXUS_B;
      if (hasComponent(world, APUnlock, eid) && APUnlock.triggered[eid] === 1) {
        continue; // consumed unlock: no legend entry needed anymore
      }
      present.add(sid);
      if (isOwnExit && hasComponent(world, Static, eid)) exitLocked = true;
    }

    // Abilities actually present in this level's matrix.
    const presentAbilities = new Set<number>();
    const nodes = matrixNodeQuery(world);
    for (let i = 0; i < nodes.length; i++) {
      const t = MatrixNode.abilityType[nodes[i]];
      if (t > 0) presentAbilities.add(t);
    }

    const row = (it: LegendItem): string =>
      `<div style="display:flex;gap:7px;align-items:center;margin:3px 0;">` +
      `<span style="flex-shrink:0;display:inline-flex">${it.swatch}</span>` +
      `<span>${it.label}</span></div>`;

    const section = (title: string): string =>
      `<div style="color:#5a4630;letter-spacing:0.15em;margin:6px 0 2px;">${title}</div>`;

    this.body.innerHTML =
      section(`YOUR BOARD (P${viewId + 1})`) +
      boardItems(present, viewId, exitLocked).map(row).join('') +
      section('DNA MATRIX') +
      matrixItems(presentAbilities).map(row).join('');
  }

  destroy(): void { this.el.remove(); }
}
