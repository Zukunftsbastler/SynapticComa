// TutorialOverlay: the Monitor's dim/frame/arrow presentation (tutorial_design.md
// §3). Pure DOM/SVG, layered above every other UI panel — deliberately NOT a
// PixiJS layer: targets are a mix of canvas-drawn hexes/matrix cells and plain
// DOM panels (HUD/inventory/ability), and resolving both through one SVG
// overlay (using getBoundingClientRect for DOM, PixiDriver's hexToScreenA/B
// for the board) is simpler than coordinating a Pixi-drawn overlay with DOM
// popups. z-index sits above LevelCompleteScreen/NeuralCollapseScreen (200,
// the highest existing panel — see main.ts's stacking order).
//
// Simplification, disclosed: the connector arrow is a straight line from the
// box's nearest edge to the target's center, with the box placed in whichever
// viewport quadrant is farthest from the target — not real obstacle routing.
// Good enough in practice; real path-finding around arbitrary UI is a much
// bigger problem this doesn't need solved.

import type { PixiDriver } from '@/rendering/PixiDriver';
import { cellRect, insertArrowRect, scrapPileRect, matrixPanelRect } from '@/rendering/MatrixRenderer';
import { HEX_SIZE } from '@/constants';
import type { FocusTarget } from './concepts';

interface Rect { x: number; y: number; w: number; h: number }

const SVG_NS = 'http://www.w3.org/2000/svg';
const Z_INDEX = 210; // above LevelCompleteScreen/NeuralCollapseScreen (200)

export interface OverlayContent {
  title: string;
  bodyHtml: string;
  focus: FocusTarget;
  /** Present only for blocking steps — omit the "UNDERSTOOD" button/Enter-to-dismiss. */
  waitingForAction: boolean;
  onDismiss: () => void;
}

export class TutorialOverlay {
  private driver: PixiDriver;
  private root:   HTMLDivElement;
  private svg:    SVGSVGElement;
  private mask:   SVGMaskElement;
  private box:    HTMLDivElement;
  private content: OverlayContent | null = null;

  constructor(container: HTMLElement, driver: PixiDriver) {
    this.driver = driver;

    this.root = document.createElement('div');
    this.root.style.cssText = [
      `position:fixed;inset:0;z-index:${Z_INDEX};pointer-events:none;display:none;`,
    ].join('');

    this.svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.cssText = 'position:absolute;inset:0;';

    const defs = document.createElementNS(SVG_NS, 'defs');
    this.mask = document.createElementNS(SVG_NS, 'mask') as SVGMaskElement;
    this.mask.id = 'tut-dim-mask';
    const maskBase = document.createElementNS(SVG_NS, 'rect');
    maskBase.setAttribute('width', '100%');
    maskBase.setAttribute('height', '100%');
    maskBase.setAttribute('fill', 'white');
    this.mask.appendChild(maskBase);
    defs.appendChild(this.mask);
    this.svg.appendChild(defs);

    const dimRect = document.createElementNS(SVG_NS, 'rect');
    dimRect.setAttribute('width', '100%');
    dimRect.setAttribute('height', '100%');
    dimRect.setAttribute('fill', 'black');
    dimRect.setAttribute('opacity', '0.4');
    dimRect.setAttribute('mask', 'url(#tut-dim-mask)');
    this.svg.appendChild(dimRect);

    this.root.appendChild(this.svg);

    this.box = document.createElement('div');
    this.box.style.cssText = [
      'position:absolute;width:340px;background:#040a04f5;border:1px solid #2a7a2a;',
      'box-shadow:0 0 30px #10401088;padding:16px 18px;pointer-events:auto;',
      'font-family:monospace;color:#50d050;font-size:0.82rem;line-height:1.5;',
      'text-shadow:0 0 6px #205020;',
    ].join('');
    this.root.appendChild(this.box);

    container.appendChild(this.root);
  }

  show(content: OverlayContent): void {
    this.content = content;
    this.root.style.display = 'block';
    this.render();
  }

  hide(): void {
    this.content = null;
    this.root.style.display = 'none';
  }

  get visible(): boolean {
    return this.content !== null;
  }

  /** Call every frame while visible — re-resolves target rects (they can move,
   *  e.g. a hovered/moving hex) and animates the frame pulse. */
  tick(): void {
    if (this.content) this.render();
  }

  private render(): void {
    const c = this.content!;
    const rects = this.resolveRects(c.focus);

    // ── Dim cutouts + pulsing frames ──────────────────────────────────────
    while (this.mask.children.length > 1) this.mask.removeChild(this.mask.lastChild!);
    for (const el of Array.from(this.svg.querySelectorAll('.tut-frame'))) el.remove();
    for (const el of Array.from(this.svg.querySelectorAll('.tut-arrow'))) el.remove();

    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);
    for (const r of rects) {
      const cutout = document.createElementNS(SVG_NS, 'rect');
      cutout.setAttribute('x', String(r.x - 4));
      cutout.setAttribute('y', String(r.y - 4));
      cutout.setAttribute('width', String(r.w + 8));
      cutout.setAttribute('height', String(r.h + 8));
      cutout.setAttribute('rx', '6');
      cutout.setAttribute('fill', 'black');
      this.mask.appendChild(cutout);

      const frame = document.createElementNS(SVG_NS, 'rect');
      frame.setAttribute('class', 'tut-frame');
      frame.setAttribute('x', String(r.x - 4));
      frame.setAttribute('y', String(r.y - 4));
      frame.setAttribute('width', String(r.w + 8));
      frame.setAttribute('height', String(r.h + 8));
      frame.setAttribute('rx', '6');
      frame.setAttribute('fill', 'none');
      frame.setAttribute('stroke', '#8fff70');
      frame.setAttribute('stroke-width', '2.5');
      frame.setAttribute('stroke-opacity', pulse.toFixed(2));
      this.svg.appendChild(frame);
    }

    // ── Box position: farthest viewport quadrant from the primary target ──
    const vw = window.innerWidth, vh = window.innerHeight;
    const primary = rects[0];
    let boxX: number, boxY: number;
    if (!primary) {
      boxX = vw / 2 - 170; boxY = vh / 2 - 80; // no target (e.g. ROLES) — center
    } else {
      const tcx = primary.x + primary.w / 2, tcy = primary.y + primary.h / 2;
      boxX = tcx < vw / 2 ? vw - 360 : 20;
      boxY = tcy < vh / 2 ? vh - 260 : 20;
    }

    // ── One arrow per target, not just the first ───────────────────────────
    // Till's report, 2026-07-24: when a concept explains several things at
    // once (e.g. EXIT_SEQUENCE in local mode, both boards visible — or any
    // concept whose focus resolves to N hexes), every target needs its own
    // frame AND its own line — a single arrow to only the first target read
    // as "one thing explained, one thing unexplained" instead of "two things
    // explained together." Frames were already drawn per-rect above; only
    // the arrow was hardcoded to the primary one.
    for (const r of rects) {
      const boxEdgeX = r.x + r.w / 2 < boxX ? boxX : boxX + 340;
      const boxEdgeY = boxY + 40;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', 'tut-arrow');
      line.setAttribute('x1', String(boxEdgeX));
      line.setAttribute('y1', String(boxEdgeY));
      line.setAttribute('x2', String(r.x + r.w / 2));
      line.setAttribute('y2', String(r.y + r.h / 2));
      line.setAttribute('stroke', '#8fff70');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-opacity', String(pulse * 0.8));
      line.setAttribute('stroke-dasharray', '5,4');
      this.svg.appendChild(line);
    }

    this.box.style.left = `${boxX}px`;
    this.box.style.top  = `${boxY}px`;
    this.box.innerHTML =
      `<div style="color:#2a7a2a;letter-spacing:0.2em;font-size:0.7rem;margin-bottom:8px;">▌MONITOR${c.waitingForAction ? ' — STANDBY' : ''}▐</div>` +
      `<div style="color:#8fff70;letter-spacing:0.12em;margin-bottom:10px;">${c.title}</div>` +
      `<div>${c.bodyHtml}</div>` +
      (c.waitingForAction
        ? `<div style="margin-top:14px;color:#4a7a4a;font-size:0.7rem;letter-spacing:0.1em;">▌ awaiting action ▐</div>`
        : `<button id="tut-ok" style="margin-top:14px;background:#0a1e0a;color:#50d050;` +
          `border:1px solid #2a7a2a;padding:6px 18px;font-family:monospace;cursor:pointer;` +
          `letter-spacing:0.15em;">UNDERSTOOD [ENTER]</button>`);
    if (!c.waitingForAction) {
      this.box.querySelector('#tut-ok')!.addEventListener('click', c.onDismiss);
    }
  }

  private resolveRects(focus: FocusTarget): Rect[] {
    if (focus === null) return [];
    switch (focus.kind) {
      case 'hex': return [this.hexRect(focus.q, focus.r, focus.z)];
      case 'hexes': return focus.hexes.map((h) => this.hexRect(h.q, h.r, h.z));
      case 'dom': {
        const el = document.querySelector(focus.selector);
        if (!el) return [];
        const r = el.getBoundingClientRect();
        return [{ x: r.x, y: r.y, w: r.width, h: r.height }];
      }
      case 'matrixCell': {
        const o = this.driver.getMatrixOrigin();
        return [cellRect(o.x, o.y, focus.column, focus.row)];
      }
      case 'matrixArrow': {
        const o = this.driver.getMatrixOrigin();
        return [insertArrowRect(o.x, o.y, focus.column, focus.fromTop)];
      }
      case 'scrapPile': {
        const o = this.driver.getMatrixOrigin();
        return [scrapPileRect(o.x, o.y)];
      }
      case 'matrixPanel': {
        const o = this.driver.getMatrixOrigin();
        return [matrixPanelRect(o.x, o.y)];
      }
      default: return [];
    }
  }

  private hexRect(q: number, r: number, z: 0 | 1): Rect {
    const s = z === 0 ? this.driver.hexToScreenA(q, r) : this.driver.hexToScreenB(q, r);
    return { x: s.x - HEX_SIZE, y: s.y - HEX_SIZE, w: HEX_SIZE * 2, h: HEX_SIZE * 2 };
  }

  destroy(): void {
    this.root.remove();
  }
}
