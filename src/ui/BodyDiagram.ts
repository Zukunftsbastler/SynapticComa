// BodyDiagram: the comatose patient's body, drawn as a schematic silhouette
// with each region rendered in its own state — dormant, awake, or waking right
// now (docs/body_awakening.md §9, decisions_needed.md D16).
//
// WHY THIS IS DRAWN, NOT GENERATED ART. §9 proposed one AI-generated raster
// silhouette plus a hand-authored rect lookup. This builds the same thing
// procedurally instead, following §9.4's own argument to its conclusion: "it's
// a HUD/diagram element like the Matrix panel, not a narrative image, so it
// should be built like one" — and the Matrix panel (rendering/MatrixRenderer.ts)
// is drawn from geometry, not from an asset. Three concrete wins over the
// raster plan: per-region shapes highlight exactly instead of approximating
// with bounding rects, the feature ships with zero art dependency (nothing in
// public/cutscenes/ exists yet), and it stays crisp at every size this is drawn
// at — 96px beside a completion banner up to 300px in a reveal. Swapping in a
// raster + rects later needs only this file changed.
//
// The region table is deliberately the same shape as MatrixRenderer's cellRect:
// pure geometry over a fixed coordinate space (viewBox 0 0 100 210), authored
// once, never per-state.

import { BodyRegion } from '@/narrative/regions';

type Shape =
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r?: number };

interface RegionShape {
  shapes: Shape[];
  /** Drawn only once awake — never part of the dormant silhouette. Used for
   *  WHOLE_BODY, which is a halo around the figure rather than a body part. */
  haloOnly?: boolean;
  /** Stroked rather than filled (the halo). */
  strokeOnly?: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Front-facing, symmetric, neutral pose. Coordinates are the viewBox space. */
const BODY_SHAPES: Record<BodyRegion, RegionShape> = {
  [BodyRegion.HEAD]: {
    shapes: [{ k: 'ellipse', cx: 50, cy: 26, rx: 15, ry: 18 }],
  },
  // Lateralised to one hemisphere — language genuinely is, and it keeps this
  // region visually distinct from HEAD, which it otherwise sits inside.
  [BodyRegion.LANGUAGE]: {
    shapes: [{ k: 'ellipse', cx: 43, cy: 24, rx: 9, ry: 11 }],
  },
  [BodyRegion.EYES]: {
    shapes: [
      { k: 'ellipse', cx: 44, cy: 23, rx: 3.2, ry: 2.2 },
      { k: 'ellipse', cx: 56, cy: 23, rx: 3.2, ry: 2.2 },
    ],
  },
  [BodyRegion.EARS]: {
    shapes: [
      { k: 'ellipse', cx: 34, cy: 28, rx: 2.8, ry: 4.5 },
      { k: 'ellipse', cx: 66, cy: 28, rx: 2.8, ry: 4.5 },
    ],
  },
  [BodyRegion.FACE_MOUTH]: {
    shapes: [{ k: 'ellipse', cx: 50, cy: 35, rx: 5.5, ry: 2.4 }],
  },
  [BodyRegion.VOICE]: {
    shapes: [{ k: 'rect', x: 45, y: 44, w: 10, h: 9, r: 2 }],
  },
  [BodyRegion.TORSO]: {
    shapes: [{ k: 'rect', x: 33, y: 53, w: 34, h: 56, r: 7 }],
  },
  // Shoulder → elbow. The Act-3 "full limb mobility" milestone.
  [BodyRegion.LIMB_MOBILITY]: {
    shapes: [
      { k: 'rect', x: 24, y: 56, w: 8, h: 32, r: 4 },
      { k: 'rect', x: 68, y: 56, w: 8, h: 32, r: 4 },
    ],
  },
  // Elbow → wrist.
  [BodyRegion.HANDS_FOREARMS]: {
    shapes: [
      { k: 'rect', x: 22, y: 88, w: 8, h: 30, r: 4 },
      { k: 'rect', x: 70, y: 88, w: 8, h: 30, r: 4 },
    ],
  },
  // The first thing to twitch: hands and toe tips.
  [BodyRegion.FINGERS_TOES]: {
    shapes: [
      { k: 'ellipse', cx: 26, cy: 122, rx: 4.5, ry: 5 },
      { k: 'ellipse', cx: 74, cy: 122, rx: 4.5, ry: 5 },
      { k: 'ellipse', cx: 40, cy: 199, rx: 4, ry: 3 },
      { k: 'ellipse', cx: 60, cy: 199, rx: 4, ry: 3 },
    ],
  },
  [BodyRegion.FEET_LEGS]: {
    shapes: [
      { k: 'rect', x: 37, y: 108, w: 10, h: 84, r: 5 },
      { k: 'rect', x: 53, y: 108, w: 10, h: 84, r: 5 },
      { k: 'rect', x: 35, y: 192, w: 12, h: 7, r: 3 },
      { k: 'rect', x: 53, y: 192, w: 12, h: 7, r: 3 },
    ],
  },
  // Not a body part — whole-body coordination, drawn as a halo around the
  // figure so it reads as "all of it, together" rather than another limb.
  [BodyRegion.WHOLE_BODY]: {
    shapes: [{ k: 'ellipse', cx: 50, cy: 108, rx: 45, ry: 100 }],
    haloOnly: true,
    strokeOnly: true,
  },
};

// The dormant silhouette has to read clearly against the clinical-reality
// panel tints it is drawn over (beats.ts's WARD/MONITOR are #2a3230/#16201c) —
// a darker body than these simply disappeared in the first pass.
const DORMANT_FILL   = '#33443d';
const DORMANT_STROKE = '#4e6459';
const AWAKE_FILL     = '#5c9a7c';
const AWAKE_STROKE   = '#8fc4a5';
const WAKING_FILL    = '#b6efd0';
const WAKING_STROKE  = '#e8fff4';

const PULSE_STYLE_ID = 'body-diagram-pulse';

/** Injected once — the reveal "juice" is a CSS animation over the fixed
 *  geometry, exactly as body_awakening.md §9.5 proposed. Deliberately NOT an
 *  ECS Fx entity: those carry Position + Dimension and are drawn by
 *  RenderSystem into the hex grid's coordinate space, which this diagram is
 *  not in. Forcing it through the ECS would be ceremony, not architecture. */
function ensurePulseStyle(): void {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
/* Pulses BRIGHTER, never toward invisible: the point is to draw the eye to
   the region that just woke, so the trough still has to read clearly. */
@keyframes body-region-wake {
  0%   { opacity: 0.62; }
  50%  { opacity: 1; }
  100% { opacity: 0.62; }
}
.body-region-waking { animation: body-region-wake 1.25s ease-in-out infinite; }
`;
  document.head.appendChild(style);
}

function appendShape(parent: SVGElement, shape: Shape, attrs: Record<string, string>): void {
  const el = document.createElementNS(SVG_NS, shape.k === 'ellipse' ? 'ellipse' : 'rect');
  if (shape.k === 'ellipse') {
    el.setAttribute('cx', String(shape.cx));
    el.setAttribute('cy', String(shape.cy));
    el.setAttribute('rx', String(shape.rx));
    el.setAttribute('ry', String(shape.ry));
  } else {
    el.setAttribute('x', String(shape.x));
    el.setAttribute('y', String(shape.y));
    el.setAttribute('width',  String(shape.w));
    el.setAttribute('height', String(shape.h));
    if (shape.r !== undefined) {
      el.setAttribute('rx', String(shape.r));
      el.setAttribute('ry', String(shape.r));
    }
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.appendChild(el);
}

export interface BodyDiagramOptions {
  /** Regions already awake and staying that way. */
  awake:   ReadonlySet<BodyRegion>;
  /** The region waking right now — pulses, and is drawn as awake. */
  waking?: BodyRegion | null;
  /** Rendered width in px; height follows the 100:210 aspect ratio. */
  width:   number;
}

/** Total regions in the campaign — the denominator of the progress read. */
export const BODY_REGION_COUNT = Object.keys(BODY_SHAPES).length;

/**
 * Builds the silhouette. Every region is present at every call; only its
 * styling changes with state, so the diagram reads as one continuous body that
 * lights up rather than as parts being added to it.
 */
export function buildBodyDiagram(opts: BodyDiagramOptions): SVGSVGElement {
  ensurePulseStyle();

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 210');
  svg.setAttribute('width',  String(opts.width));
  svg.setAttribute('height', String(Math.round(opts.width * 2.1)));
  svg.dataset.bodyDiagram = '';
  svg.style.cssText = 'display:block;overflow:visible;';

  for (const [regionKey, def] of Object.entries(BODY_SHAPES) as [BodyRegion, RegionShape][]) {
    const isWaking = opts.waking === regionKey;
    const isAwake  = isWaking || opts.awake.has(regionKey);
    if (def.haloOnly && !isAwake) continue;

    const group = document.createElementNS(SVG_NS, 'g');
    group.dataset.region = regionKey;
    group.dataset.state  = isWaking ? 'waking' : isAwake ? 'awake' : 'dormant';
    if (isWaking) group.setAttribute('class', 'body-region-waking');

    const fill = def.strokeOnly
      ? 'none'
      : isWaking ? WAKING_FILL : isAwake ? AWAKE_FILL : DORMANT_FILL;
    const stroke = isWaking ? WAKING_STROKE : isAwake ? AWAKE_STROKE : DORMANT_STROKE;

    for (const shape of def.shapes) {
      appendShape(group, shape, {
        fill,
        stroke,
        'stroke-width': def.strokeOnly ? '1.2' : '0.8',
        // Regions overlap by design (EYES sit inside HEAD, LANGUAGE inside one
        // hemisphere) — translucency keeps the one underneath readable.
        'fill-opacity': isAwake ? '0.85' : '1',
      });
    }
    svg.appendChild(group);
  }

  return svg;
}

/** "3 / 12 AWAKE" — the at-a-glance progress read that makes the diagram
 *  legible without a legend or any hover interaction. */
export function bodyProgressLabel(awake: ReadonlySet<BodyRegion>): string {
  return `${awake.size} / ${BODY_REGION_COUNT} AWAKE`;
}
