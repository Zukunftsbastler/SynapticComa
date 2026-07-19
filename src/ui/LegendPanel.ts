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
import { Renderable, Static, APUnlock } from '@/components';
import { renderableQuery } from '@/queries';
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

function boardItems(present: Set<SpriteId>, exitLocked: boolean, unlockConsumed: boolean): LegendItem[] {
  const items: LegendItem[] = [];
  items.push({ swatch: circleSwatch(0x8B2FC9, true), label: 'P1 wisp — ring marks the one you control' });
  items.push({ swatch: circleSwatch(0x3AAED8), label: 'P2 wisp' });
  items.push({ swatch: hexSwatch(0x1E8A3C), label: 'NEXUS EXIT — the goal. P1 first, then P2' });
  if (exitLocked) items.push({ swatch: hexSwatch(0x14401E), label: 'Exit still sealed (opens after P1 exits)' });
  if (present.has(SpriteId.AP_UNLOCK_NODE)) {
    items.push({ swatch: hexSwatch(0xC9A227), label: 'SHARED UNLOCK — both wisps on it at once: +AP' });
    if (unlockConsumed) items.push({ swatch: hexSwatch(0x4A3E1A), label: 'Shared Unlock already used' });
  }
  if (present.has(SpriteId.WALL_HEX)) items.push({ swatch: hexSwatch(0x3A3A42), label: 'Wall — impassable' });
  if (present.has(SpriteId.HAZARD_LOCKED_RED)) items.push({ swatch: hexSwatch(0x8B2430), label: 'RED door — passable while matrix node R is powered' });
  if (present.has(SpriteId.HAZARD_LOCKED_BLUE)) items.push({ swatch: hexSwatch(0x24478B), label: 'BLUE door — passable while matrix node B is powered' });
  if (present.has(SpriteId.HAZARD_FIRE)) items.push({ swatch: hexSwatch(0xB0521A), label: 'Fire — lethal without ♨ immunity' });
  if (present.has(SpriteId.HAZARD_LETHAL_A) || present.has(SpriteId.HAZARD_LETHAL_B)) {
    items.push({ swatch: hexSwatch(0x7A1010), label: 'Lethal hazard — never enter (chasm/laser); ⇈ can jump across' });
  }
  if (present.has(SpriteId.HAZARD_PHASE_BARRIER)) items.push({ swatch: hexSwatch(0x3A6A78), label: 'Phase barrier — passable while ◈ is powered' });
  if (present.has(SpriteId.THRESHOLD_HEX)) items.push({ swatch: hexSwatch(0xD8D8E8), label: 'Threshold — both stand + confirm: board flips (one-way)' });
  if (present.has(SpriteId.CONDUIT_UNKNOWN)) {
    items.push({
      swatch: squareSwatch(0x2A1A2E, `<rect x="6" y="6" width="10" height="10" fill="#D8CCAA"/>`),
      label: 'Face-down plate — walk over it to collect into your inventory',
    });
  }
  return items;
}

const MATRIX_ITEMS: LegendItem[] = [
  { swatch: squareSwatch(0xD4820A, `<circle cx="11" cy="11" r="5" fill="#FFCC44"/>`),
    label: 'SOURCE — always powered; energy flows left→right' },
  { swatch: squareSwatch(0x3D2E12, `<rect x="2" y="9" width="18" height="4" fill="#2A1E08"/>`),
    label: 'Conduit plate — its grooves carry power; click to rotate (1 AP)' },
  { swatch: squareSwatch(0x1E1710),
    label: 'Empty slot — ▼/▲ arrows: insert a plate from your inventory (2 AP, slides the column)' },
  { swatch: squareSwatch(0x1A2A1A, `<circle cx="11" cy="11" r="6" fill="#0D1A0D"/>`),
    label: 'Ability node, dark = OFF' },
  { swatch: squareSwatch(0x50D050, `<circle cx="11" cy="11" r="6" fill="#8FFF70"/>`),
    label: 'Ability node, green = ON: ⇈ jump · ▶ push · R/B open doors · ◈ phase · ♨ fire-proof' },
];

// ── Panel ────────────────────────────────────────────────────────────────────

export class LegendPanel {
  private el:        HTMLElement;
  private body:      HTMLElement;
  private collapsed = false;
  private frame     = 0;

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

  /** Call each render frame — internally refreshes once a second. */
  update(): void {
    if (++this.frame % 60 !== 0) return;
    this.refresh();
  }

  private refresh(): void {
    // Scan the live world for which sprite types this level contains.
    const present = new Set<SpriteId>();
    let exitLocked = false;
    let unlockConsumed = false;
    const rs = renderableQuery(world);
    for (let i = 0; i < rs.length; i++) {
      const eid = rs[i];
      const sid = Renderable.spriteId[eid] as SpriteId;
      present.add(sid);
      if ((sid === SpriteId.EXIT_NEXUS_A || sid === SpriteId.EXIT_NEXUS_B) &&
          hasComponent(world, Static, eid)) exitLocked = true;
      if (hasComponent(world, APUnlock, eid) && APUnlock.triggered[eid] === 1) unlockConsumed = true;
    }
    void GameState;

    const row = (it: LegendItem): string =>
      `<div style="display:flex;gap:7px;align-items:center;margin:3px 0;">` +
      `<span style="flex-shrink:0;display:inline-flex">${it.swatch}</span>` +
      `<span>${it.label}</span></div>`;

    const section = (title: string): string =>
      `<div style="color:#5a4630;letter-spacing:0.15em;margin:6px 0 2px;">${title}</div>`;

    this.body.innerHTML =
      section('BOARD') +
      boardItems(present, exitLocked, unlockConsumed).map(row).join('') +
      section('DNA MATRIX') +
      MATRIX_ITEMS.map(row).join('');
  }

  destroy(): void { this.el.remove(); }
}
