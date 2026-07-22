import type { IWorld } from 'bitecs';
import { hasComponent } from 'bitecs';
import {
  Position, Renderable, Dimension, Avatar, APUnlock, Static, Collectible, Movable,
  FocusNode,
} from '@/components';
import { Fx } from '@/components';
import { FxKind } from '@/components/Fx';
import { renderableQuery, avatarQuery, staticQuery, fxQuery } from '@/queries';
import { animateTo } from '@/rendering/AnimationState';
import { renderCommandBuffer } from '@/rendering/RenderCommandBuffer';
import { renderMatrix } from '@/rendering/MatrixRenderer';
import type { PixiDriver } from '@/rendering/PixiDriver';
import { SpriteId } from '@/registry/SpriteRegistry';
import { isSpriteLoaded } from '@/registry/TextureRegistry';
import { GameState } from '@/state/GameState';
import { decals } from '@/state/DecalState';
import { uiState } from '@/ui/uiState';
import { HEX_DIRECTIONS, hexDistance } from '@/rendering/HexMath';
import { HEX_SIZE } from '@/constants';
import { isHexPassable } from '@/systems/MovementSystem';
import { abilityFlags } from '@/systems/AbilitySystem';
import { entityRegistry } from '@/registry/EntityRegistry';

// Size of an entity-icon sprite (avatars, hazards, matrix pieces, etc.) once
// a real asset exists for its SpriteId — a hex tile's bounding square.
const SPRITE_SIZE = HEX_SIZE * 2;

// Hex border: a permanent low-contrast "grout" line on every floor tile
// (photographic sprite art has no natural edge the way a flat color fill
// does — Till's feedback, 2026-07-21) plus a bright highlight on whichever
// hex the pointer is over (uiState.hoveredHex), so tile boundaries stay
// legible either way.
// Explicitly NOT black/white (Till's feedback, 2026-07-21) — a neutral warm
// gray so it reads as "a rough seam between stones" rather than a hard grid
// line. Alpha/width raised again 2026-07-22 — even with decals removed, the
// tiles still needed clearer separation ("die Grenzen... müssen noch
// deutlicher werden").
const HEX_GROUT_COLOR  = 0x4A4038;
const HEX_GROUT_ALPHA  = 0.55;
const HEX_GROUT_WIDTH  = 5;
const HEX_HOVER_ALPHA  = 0.9;
const HEX_HOVER_WIDTH  = 3;

// Hover highlight color depends on what hovering-then-clicking would DO
// (Till's feedback, 2026-07-21) — computed once per frame (classifyHover
// below), not re-derived per hex, since only one hex can be hovered at a time.
const HEX_HOVER_NEUTRAL     = 0xE8DCB8; // hovering, but not a one-action move target
const HEX_HOVER_VALID_STEP  = 0x8FFF70; // green — a normal 1-hex step lands here
const HEX_HOVER_VALID_JUMP  = 0x9AD0FF; // blue — matches the JUMP ability glyph color
const HEX_HOVER_BLOCKED     = 0xFF5A6A; // red — adjacent/in-line but not passable

// Avatar idle animation (Till's ask, 2026-07-22): a slow rotation, a subtle
// scale pulse, and a small height bob so the wisp reads as floating rather
// than pinned flat to the tile — plus a ground-level drop shadow that
// shrinks/fades as the wisp "rises", selling the float. Purely cosmetic wall-
// clock animation (like the hex hover highlight, never networked) — driven
// by performance.now() directly rather than an ECS/ Fx component, since
// nothing about it needs to be deterministic or shared between Host/Guest.
// P1/P2 get opposite phase offsets so the two wisps don't move in lockstep.
const ROTATE_PERIOD_MS = 9000;
const PULSE_PERIOD_MS  = 2200;
const PULSE_AMPLITUDE  = 0.06;   // ±6% scale
const BOB_PERIOD_MS    = 3400;
const BOB_AMPLITUDE    = 0.16;   // fraction of HEX_SIZE the sprite rises

// Ambient pulsing rings for "this tile is special" markers — originally
// used for both AP unlock node and Focus node (Till's ask, 2026-07-22:
// "gelbe, konzentrische Ringe, die nach und nach verblassen"). Also the
// answer to a broader complaint the same message raised: special tiles
// looked like a "harter Bruch" from the regular floor because their art
// used to bake the whole hex (see the sprite-regeneration note in
// docs/art_pipeline_roadmap.md) — the glow is now a real-time effect layered
// over an ordinary floor tile + a small transparent-background icon, rather
// than baked into the icon art itself, so it can't reintroduce a hard edge.
// AP unlock node moved OFF this effect 2026-07-23 (see pushGroundedGlow
// below) — Focus node still uses it.
const NODE_RING_PERIOD_MS         = 1600;
const NODE_RING_MAX_RADIUS_FACTOR = 0.9; // × HEX_SIZE
const NODE_RING_VIOLET            = 0xC79CFF; // Focus node

/** Three staggered expanding-and-fading ring outlines, looping forever on
 *  wall-clock time (never networked — purely decorative, like the avatar
 *  idle animation above). `eid` seeds a phase offset so multiple special
 *  tiles on the same board don't all pulse in lockstep. */
function pushPulseRings(x: number, y: number, color: number, eid: number): void {
  const phaseMs = (eid * 137) % NODE_RING_PERIOD_MS;
  const now = performance.now() + phaseMs;
  for (const lag of [0, 1 / 3, 2 / 3]) {
    const t = (((now / NODE_RING_PERIOD_MS) % 1) + lag) % 1;
    renderCommandBuffer.push({
      cmd: 'drawRing', x, y,
      radius: HEX_SIZE * NODE_RING_MAX_RADIUS_FACTOR * t,
      color, lineWidth: 2.5, alpha: (1 - t) * 0.6,
    });
  }
}

// AP unlock node's own effect (2026-07-23): the ring-pulse above visually
// echoed HAZARD_PHASE_BARRIER's shimmer closely enough that Till flagged a
// real risk of confusing "a beneficial AP node" with "a hazard" — a single
// soft, slowly-breathing glow with a FIXED radius (no expansion, no rings)
// reads as "ambient light seeping from the tile" instead, which is both
// visually distinct from the barrier and helps the node feel embedded in
// its floor tile rather than a cutout pasted on top (the other half of the
// same complaint — "besser in das jeweilige Tile integriert").
const NODE_GLOW_PERIOD_MS  = 2400;
const NODE_GLOW_RADIUS_FACTOR = 0.55; // × HEX_SIZE — stays within the tile

function pushGroundedGlow(x: number, y: number, color: number, eid: number): void {
  const now = performance.now() + (eid * 89) % 1000;
  const breathe = 0.5 + 0.5 * Math.sin((now / NODE_GLOW_PERIOD_MS) * 2 * Math.PI);
  renderCommandBuffer.push({
    cmd: 'drawCircle', x, y,
    radius: HEX_SIZE * NODE_GLOW_RADIUS_FACTOR,
    fillColor: color, alpha: 0.12 + 0.10 * breathe,
  });
}

// Fire hazard animation (Till's ask, 2026-07-23): "wirklich gefährlich
// aussehen... flirrender Hitze und flackernden Flammen." A static texture
// alone can't sell "dangerous," so the sprite itself flickers (irregular
// alpha/scale jitter — two sine waves at unrelated frequencies, not one
// clean pulse, so it doesn't read as a metronome) and small glowing embers
// rise and fade above it. Same wall-clock/non-ECS approach as the avatar
// idle animation and the node pulse rings above — purely cosmetic, `eid`
// seeds a phase offset so multiple fire hazards don't flicker in lockstep.
const FIRE_FLICKER_PERIOD_MS = 260;
const FIRE_EMBER_PERIOD_MS   = 1100;
const FIRE_EMBER_COUNT       = 4;
const FIRE_EMBER_RISE_FACTOR = 0.9;  // × HEX_SIZE, total rise over one ember's lifetime
const FIRE_EMBER_COLOR       = 0xFFA030;

function fireFlickerAlpha(eid: number): number {
  const now = performance.now() + (eid * 53) % 1000;
  const n1 = Math.sin((now / FIRE_FLICKER_PERIOD_MS) * 2 * Math.PI);
  const n2 = Math.sin((now / (FIRE_FLICKER_PERIOD_MS * 0.37)) * 2 * Math.PI);
  const combined = n1 * 0.65 + n2 * 0.35; // -1..1, deliberately irregular
  return 0.82 + 0.18 * (combined * 0.5 + 0.5); // stays in [0.82, 1.0] — flickers, never vanishes
}

function fireFlickerScale(eid: number): number {
  const now = performance.now() + (eid * 71) % 1000;
  return 1 + 0.07 * Math.sin((now / (FIRE_FLICKER_PERIOD_MS * 1.3)) * 2 * Math.PI);
}

// Phase barrier shimmer (Till's ask, 2026-07-23): "dringend mit einer
// Flirren-Animation belegt werden." A gentler, faster wave than fire's
// flicker (no "flame" quality wanted here) plus a tiny positional jitter —
// real heat-haze bends light slightly, so a small wobble sells "shimmering"
// better than an alpha/scale pulse alone would.
const BARRIER_SHIMMER_PERIOD_MS = 900;
const BARRIER_JITTER_PERIOD_MS  = 340;
const BARRIER_JITTER_AMPLITUDE  = 0.045; // × HEX_SIZE

function barrierShimmerAlpha(eid: number): number {
  const now = performance.now() + (eid * 61) % 1000;
  const n1 = Math.sin((now / BARRIER_SHIMMER_PERIOD_MS) * 2 * Math.PI);
  const n2 = Math.sin((now / (BARRIER_SHIMMER_PERIOD_MS * 0.53)) * 2 * Math.PI);
  return 0.78 + 0.22 * ((n1 * 0.6 + n2 * 0.4) * 0.5 + 0.5);
}

function barrierShimmerScale(eid: number): number {
  const now = performance.now() + (eid * 83) % 1000;
  return 1 + 0.05 * Math.sin((now / (BARRIER_SHIMMER_PERIOD_MS * 0.8)) * 2 * Math.PI);
}

function barrierShimmerOffset(eid: number): { dx: number; dy: number } {
  const now = performance.now();
  const px = (eid * 97) % 1000;
  const py = (eid * 131) % 1000;
  return {
    dx: Math.sin(((now + px) / BARRIER_JITTER_PERIOD_MS) * 2 * Math.PI) * HEX_SIZE * BARRIER_JITTER_AMPLITUDE,
    dy: Math.cos(((now + py) / (BARRIER_JITTER_PERIOD_MS * 1.15)) * 2 * Math.PI) * HEX_SIZE * BARRIER_JITTER_AMPLITUDE,
  };
}

/** Small embers rising and fading above the hazard, looping on wall-clock
 *  time — the "flirrende Hitze" cue a static sprite can't provide alone. */
function pushFireFlicker(x: number, y: number, eid: number): void {
  const now = performance.now();
  const basePhase = (eid * 211) % FIRE_EMBER_PERIOD_MS;
  for (let i = 0; i < FIRE_EMBER_COUNT; i++) {
    const lag = i / FIRE_EMBER_COUNT;
    const t = (((now + basePhase) / FIRE_EMBER_PERIOD_MS) + lag) % 1; // 0..1
    const driftSeed = (eid * 37 + i * 91) % 1000;
    const dx = Math.sin(driftSeed + t * Math.PI * 2) * HEX_SIZE * 0.12;
    renderCommandBuffer.push({
      cmd: 'drawCircle',
      x: x + dx, y: y - HEX_SIZE * FIRE_EMBER_RISE_FACTOR * t,
      radius: HEX_SIZE * 0.06 * (1 - t * 0.5),
      fillColor: FIRE_EMBER_COLOR, alpha: (1 - t) * 0.85,
    });
  }
}

// Unlockable-door glow, breathing exits, and echo-tile shimmer (Till's ask,
// 2026-07-23, confirmed via a quick check-in on which elements deserved
// animation). Doors/exits both already expose "currently open" via the same
// `Static` component RenderSystem's own color logic reads (absence of
// Static = unlocked) — reusing that instead of a second copy of the rule.
const DOOR_GLOW_PERIOD_MS    = 1400;
const DOOR_GLOW_COLOR_RED    = 0xFF4050;
const DOOR_GLOW_COLOR_BLUE   = 0x4AA0FF;
const EXIT_BREATHE_PERIOD_MS = 2600;
const EXIT_BREATHE_LOCKED    = 0.025;  // subtle — still just a locked marker
const EXIT_BREATHE_ACTIVE    = 0.07;   // more inviting once it's the actual goal
const ECHO_SHIMMER_PERIOD_MS = 2000;

/** Alpha pulse for a currently-unlockable door — only meaningful while the
 *  door is actually passable, so callers gate this on `!hasComponent(Static)`. */
function doorGlowAlpha(eid: number): number {
  const now = performance.now() + (eid * 47) % 1000;
  return 0.85 + 0.15 * Math.sin((now / DOOR_GLOW_PERIOD_MS) * 2 * Math.PI);
}

/** Three staggered glow rings in the door's own bright color — reuses
 *  pushPulseRings' shape, just a different color per door and gated on the
 *  door actually being open right now. */
function pushDoorGlow(x: number, y: number, color: number, eid: number): void {
  pushPulseRings(x, y, color, eid);
}

function exitBreatheScale(eid: number, active: boolean): number {
  const now = performance.now() + (eid * 59) % 1000;
  const amp = active ? EXIT_BREATHE_ACTIVE : EXIT_BREATHE_LOCKED;
  return 1 + amp * Math.sin((now / EXIT_BREATHE_PERIOD_MS) * 2 * Math.PI);
}

function echoShimmerAlpha(eid: number): number {
  const now = performance.now() + (eid * 43) % 1000;
  return 0.7 + 0.3 * (Math.sin((now / ECHO_SHIMMER_PERIOD_MS) * 2 * Math.PI) * 0.5 + 0.5);
}

// Erratic lightning-variant flicker for HAZARD_LETHAL_B (Till's ask,
// 2026-07-23): "die 'Elektroden' dürfen sich nicht ändern, sondern nur die
// Blitze... am besten erratisch." The four hazard_lethal_b*.webp files share
// pixel-identical electrodes (one base render + a procedurally-composited
// bolt per variant — see SKILL.md) — only WHICH variant shows needs to
// change over time. Unlike every other multi-variant sprite (floor tiles),
// which picks ONE variant per-instance forever via a stable hash, this one
// needs to keep changing — and irregularly, not on a metronome, which needs
// real per-entity state rather than a pure function of wall-clock time. Same
// non-ECS Map pattern AnimationState.ts already uses for movement tweening;
// stale entries after a level reload (bitECS recycles eids) are harmless —
// worst case a reused eid inherits a leftover flicker phase, imperceptible
// for a purely cosmetic effect.
const LIGHTNING_VARIANT_COUNT = 4;
const lightningFlicker = new Map<number, { variant: number; nextSwitchMs: number }>();

function lightningVariantSeed(eid: number): number {
  const now = performance.now();
  const state = lightningFlicker.get(eid);
  if (!state || now >= state.nextSwitchMs) {
    lightningFlicker.set(eid, {
      variant: Math.floor(Math.random() * LIGHTNING_VARIANT_COUNT),
      nextSwitchMs: now + 60 + Math.random() * 160, // 60-220ms — irregular, not a steady rate
    });
  }
  return lightningFlicker.get(eid)!.variant;
}

type HoverKind = 'neutral' | 'step' | 'jump' | 'blocked';

/**
 * Classifies what a click on the hovered hex would currently do, from the
 * controlled avatar's perspective — mirrors MovementSystem's own step/jump
 * decision (mechanics.md §5.1) exactly, via the shared isHexPassable() rather
 * than a second copy of the rule. Read-only: never mutates state.
 */
function classifyHover(world: IWorld, viewPlayerId: 0 | 1): HoverKind {
  const hover = uiState.hoveredHex;
  if (!hover) return 'neutral';

  const avatarId = `avatar_p${viewPlayerId + 1}`;
  if (!entityRegistry.has(avatarId)) return 'neutral';
  const eid = entityRegistry.get(avatarId);
  if (Position.z[eid] !== hover.z) return 'neutral';

  const dq = hover.q - Position.q[eid];
  const dr = hover.r - Position.r[eid];
  const dist = hexDistance(0, 0, dq, dr);

  if (dist === 1) {
    return isHexPassable(world, hover.q, hover.r, hover.z) ? 'step' : 'blocked';
  }
  if (dist === 2 && dq % 2 === 0 && dr % 2 === 0 && abilityFlags[hover.z].jumpActive) {
    return isHexPassable(world, hover.q, hover.r, hover.z) ? 'jump' : 'blocked';
  }
  return 'neutral';
}

function hoverHighlightColor(kind: HoverKind): number {
  switch (kind) {
    case 'step':    return HEX_HOVER_VALID_STEP;
    case 'jump':    return HEX_HOVER_VALID_JUMP;
    case 'blocked': return HEX_HOVER_BLOCKED;
    default:        return HEX_HOVER_NEUTRAL;
  }
}

// Stable per-hex integer, used to pick a texture variant so the same hex
// always shows the same variant across frames/reloads (not a new random
// pick every tick) while different hexes still land on different variants.
function hexHash(q: number, r: number): number {
  return ((q * 73856093) ^ (r * 19349663)) >>> 0;
}

// Art palette — Medical Macabre Diorama (docs/art_and_ui.md)
// Dim A (The Id): bruised purples, sickly crimson
const COLOR_DIM_A_FLOOR = 0x2A1A2E; // deep bruised purple (velvet)
const COLOR_AVATAR_P1   = 0x8B2FC9; // obsidian-violet
// Dim B (The Superego): cold clinical steel, icy blue
const COLOR_DIM_B_FLOOR = 0x0D1F2D; // near-black steel
const COLOR_AVATAR_P2   = 0x3AAED8; // surgical cyan

// Entity hex colors — every board element must be readable at a glance.
// Placeholder flats until the sprite pipeline lands; hues follow art_and_ui.md.
const ENTITY_COLORS: Partial<Record<SpriteId, number>> = {
  [SpriteId.EXIT_NEXUS_A]:         0x1E8A3C, // nexus green (goal!)
  [SpriteId.EXIT_NEXUS_B]:         0x1E8A3C,
  [SpriteId.AP_UNLOCK_NODE_A]:     0xC9A227, // shared-unlock gold
  [SpriteId.AP_UNLOCK_NODE_B]:     0xC9A227,
  [SpriteId.HAZARD_LETHAL_A]:      0x7A1010, // repressed fear — deep blood red
  [SpriteId.HAZARD_LETHAL_B]:      0x7A1010, // firewall laser
  [SpriteId.HAZARD_FIRE_A]:        0xB0521A, // smoldering orange
  [SpriteId.HAZARD_FIRE_B]:        0xB0521A,
  [SpriteId.HAZARD_LOCKED_RED]:    0x8B2430, // fleshy red door
  [SpriteId.HAZARD_LOCKED_BLUE]:   0x24478B, // vault blue door
  [SpriteId.HAZARD_PHASE_BARRIER]: 0x3A6A78, // ghostly teal
  [SpriteId.WALL_HEX_A]:           0x3A3A42, // solid slate wall
  [SpriteId.WALL_HEX_B]:           0x3A3A42,
  [SpriteId.PUSHABLE_BLOCK]:       0x5A4A32, // impulse block — mobile clot/logic-block
  [SpriteId.FOCUS_NODE]:           0x8A5AC9, // focus vault node — violet, distinct from unlock gold
  [SpriteId.ECHO_TILE]:            0x3A6A6A, // echo tile — thin teal, "the split runs shallow here"
};

export function RenderSystem(world: IWorld, driver: PixiDriver, localPlayerId: 0 | 1): void {
  renderCommandBuffer.clear();

  const renderables = renderableQuery(world);
  const hoverColor = hoverHighlightColor(classifyHover(world, localPlayerId));

  // ── Pass 1: floor tiles ──────────────────────────────────────────────────
  for (let i = 0; i < renderables.length; i++) {
    const eid = renderables[i];
    if (Renderable.visible[eid] === 0) continue;
    const dimLayer = Dimension.layer[eid];
    if (!GameState.revealBothDims && dimLayer !== localPlayerId) continue;
    const sid = Renderable.spriteId[eid] as SpriteId;
    if (sid !== SpriteId.HEX_ID_FLOOR && sid !== SpriteId.HEX_SUPEREGO_FLOOR) continue;

    // Floor tiles are ordinary per-hex sprites like any other game piece —
    // the board's shape is whatever hexes exist, not a fixed background
    // frame (Till's call, 2026-07-21; docs/art_pipeline_roadmap.md §1).
    const q = Position.q[eid];
    const r = Position.r[eid];
    if (isSpriteLoaded(sid)) {
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      renderCommandBuffer.push({
        cmd: 'drawSprite', x: screen.x, y: screen.y,
        width: SPRITE_SIZE, height: SPRITE_SIZE, spriteId: sid, alpha: 1, visible: true,
        variantSeed: hexHash(q, r),
      });
    } else {
      const baseColor = dimLayer === 0 ? COLOR_DIM_A_FLOOR : COLOR_DIM_B_FLOOR;
      renderCommandBuffer.push({
        cmd: 'drawHex', q, r,
        fillColor: (dimLayer << 24) | baseColor, alpha: 1,
      });
    }

    // Permanent low-contrast grout, every tile.
    renderCommandBuffer.push({
      cmd: 'drawHexBorder', q, r, dim: dimLayer as 0 | 1,
      color: HEX_GROUT_COLOR, lineWidth: HEX_GROUT_WIDTH, alpha: HEX_GROUT_ALPHA,
    });
    // Bright highlight on whichever hex the pointer is over.
    const hover = uiState.hoveredHex;
    if (hover && hover.q === q && hover.r === r && hover.z === dimLayer) {
      renderCommandBuffer.push({
        cmd: 'drawHexBorder', q, r, dim: dimLayer as 0 | 1,
        color: hoverColor, lineWidth: HEX_HOVER_WIDTH, alpha: HEX_HOVER_ALPHA,
      });
    }
  }

  // ── Pass 2: entity hexes (exits, unlock nodes, hazards, thresholds) ──────
  for (let i = 0; i < renderables.length; i++) {
    const eid = renderables[i];
    if (Renderable.visible[eid] === 0) continue;
    const dimLayer = Dimension.layer[eid];
    if (!GameState.revealBothDims && dimLayer !== localPlayerId) continue;
    if (hasComponent(world, Avatar, eid)) continue; // avatars drawn in pass 3
    const sid = Renderable.spriteId[eid] as SpriteId;
    if (sid === SpriteId.HEX_ID_FLOOR || sid === SpriteId.HEX_SUPEREGO_FLOOR) continue;

    const q = Position.q[eid];
    const r = Position.r[eid];
    let color = ENTITY_COLORS[sid];
    let alpha = 1;

    const isExit = sid === SpriteId.EXIT_NEXUS_A || sid === SpriteId.EXIT_NEXUS_B;
    let exitLocked = false;
    if (isExit) {
      // Locked exit (P2's, pre-P1-exit) renders dim; active exit glows.
      if (hasComponent(world, Static, eid)) { color = 0x14401E; alpha = 0.9; exitLocked = true; }
    }
    let unlockTriggered = false;
    let focusTriggered  = false;
    if (hasComponent(world, APUnlock, eid) && APUnlock.triggered[eid] === 1) {
      color = 0x4A3E1A; // consumed unlock — burnt-out gold
      unlockTriggered = true;
    }
    if (hasComponent(world, FocusNode, eid) && FocusNode.triggered[eid] === 1) {
      color = 0x2E2440; // spent focus node — dimmed violet
      focusTriggered = true;
    }

    const isUnlockNode = sid === SpriteId.AP_UNLOCK_NODE_A || sid === SpriteId.AP_UNLOCK_NODE_B;
    if (isUnlockNode && !unlockTriggered) {
      // Cool steel-blue glow for the Superego-styled half, violet for the
      // Id-styled half — the glow color itself reinforces which world each
      // one is "from," same crossover idea as the material split.
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      pushGroundedGlow(screen.x, screen.y, sid === SpriteId.AP_UNLOCK_NODE_A ? 0x8FD8FF : 0xB07AFF, eid);
    }
    if (sid === SpriteId.FOCUS_NODE && !focusTriggered) {
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      pushPulseRings(screen.x, screen.y, NODE_RING_VIOLET, eid);
    }

    const isFire = sid === SpriteId.HAZARD_FIRE_A || sid === SpriteId.HAZARD_FIRE_B;
    if (isFire) {
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      pushFireFlicker(screen.x, screen.y, eid);
    }
    const isBarrier = sid === SpriteId.HAZARD_PHASE_BARRIER;
    const isEcho    = sid === SpriteId.ECHO_TILE;

    const isDoor = sid === SpriteId.HAZARD_LOCKED_RED || sid === SpriteId.HAZARD_LOCKED_BLUE;
    const doorOpen = isDoor && !hasComponent(world, Static, eid);
    if (doorOpen) {
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      pushDoorGlow(screen.x, screen.y, sid === SpriteId.HAZARD_LOCKED_RED ? DOOR_GLOW_COLOR_RED : DOOR_GLOW_COLOR_BLUE, eid);
    }

    if (isSpriteLoaded(sid)) {
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      const offset = isBarrier ? barrierShimmerOffset(eid) : { dx: 0, dy: 0 };
      const animAlpha = isFire ? alpha * fireFlickerAlpha(eid)
        : isBarrier ? alpha * barrierShimmerAlpha(eid)
        : isEcho ? alpha * echoShimmerAlpha(eid)
        : doorOpen ? alpha * doorGlowAlpha(eid)
        : alpha;
      const animScale = isFire ? fireFlickerScale(eid)
        : isBarrier ? barrierShimmerScale(eid)
        : isExit ? exitBreatheScale(eid, !exitLocked)
        : 1;
      renderCommandBuffer.push({
        cmd: 'drawSprite', x: screen.x + offset.dx, y: screen.y + offset.dy,
        width: SPRITE_SIZE * animScale, height: SPRITE_SIZE * animScale,
        spriteId: sid, alpha: animAlpha, visible: true,
        variantSeed: sid === SpriteId.HAZARD_LETHAL_B ? lightningVariantSeed(eid) : 0,
      });
    } else if (color !== undefined) {
      renderCommandBuffer.push({
        cmd: 'drawHex', q, r, fillColor: (dimLayer << 24) | color, alpha,
      });
    }

    // Collectible plates: face-down "???" marker on top of the floor.
    if (hasComponent(world, Collectible, eid)) {
      const screen = dimLayer === 0 ? driver.hexToScreenA(q, r) : driver.hexToScreenB(q, r);
      renderCommandBuffer.push({
        cmd: 'drawRect',
        x: screen.x - HEX_SIZE * 0.28, y: screen.y - HEX_SIZE * 0.28,
        width: HEX_SIZE * 0.56, height: HEX_SIZE * 0.56,
        fillColor: 0xD8CCAA, alpha: 0.9,
      });
    }
  }

  // ── Pass 3: avatars (always on top) ──────────────────────────────────────
  const avatars = avatarQuery(world);
  for (let i = 0; i < avatars.length; i++) {
    const eid = avatars[i];
    if (Renderable.visible[eid] === 0) continue;

    const dimLayer = Dimension.layer[eid];
    if (!GameState.revealBothDims && dimLayer !== localPlayerId) continue;

    const q = Position.q[eid];
    const r = Position.r[eid];
    const screen = dimLayer === 0
      ? driver.hexToScreenA(q, r)
      : driver.hexToScreenB(q, r);

    const playerId = Avatar.playerId[eid];
    const sid      = playerId === 0 ? SpriteId.AVATAR_P1 : SpriteId.AVATAR_P2;
    const color    = playerId === 0 ? COLOR_AVATAR_P1 : COLOR_AVATAR_P2;

    // Smooth movement: tween toward the logical position (Decision 8 —
    // animation never writes back into ECS state).
    const anim = animateTo(eid, screen.x, screen.y);

    // Controlled wisp gets a bright ring so the active piece is unmistakable.
    if (playerId === GameState.viewPlayerId) {
      renderCommandBuffer.push({
        cmd: 'drawCircle', x: anim.x, y: anim.y,
        radius: HEX_SIZE * 0.58, fillColor: 0xFFFFFF, alpha: 0.35,
      });
    }

    if (isSpriteLoaded(sid)) {
      // Idle float animation — see the constants block above for why
      // wall-clock time rather than an ECS/Fx component.
      const now         = performance.now();
      const phaseOffset = playerId * Math.PI;
      const rotation    = ((now / ROTATE_PERIOD_MS) * 2 * Math.PI + phaseOffset) % (2 * Math.PI);
      const pulseScale  = 1 + PULSE_AMPLITUDE * Math.sin((now / PULSE_PERIOD_MS) * 2 * Math.PI + phaseOffset);
      // liftT: 0 = grounded, 1 = fully risen. Always >= 0 (never dips below
      // the tile) — reads as "hovering, with a bit of drift" rather than
      // bobbing symmetrically through the floor.
      const liftT       = 0.5 + 0.5 * Math.sin((now / BOB_PERIOD_MS) * 2 * Math.PI + phaseOffset);
      const riseOffset  = HEX_SIZE * BOB_AMPLITUDE * liftT;

      // Drop shadow at ground level (never rises with the sprite) — shrinks
      // and fades slightly as the wisp lifts, so higher = "further from the
      // ground" reads visually instead of just floating in place.
      renderCommandBuffer.push({
        cmd: 'drawCircle', x: anim.x, y: anim.y + HEX_SIZE * 0.32,
        radius: HEX_SIZE * (0.34 - 0.10 * liftT), fillColor: 0x000000, alpha: 0.30 - 0.12 * liftT,
      });

      renderCommandBuffer.push({
        cmd: 'drawSprite', x: anim.x, y: anim.y - riseOffset,
        width: SPRITE_SIZE * pulseScale, height: SPRITE_SIZE * pulseScale,
        spriteId: sid, alpha: 1, visible: true, rotation,
      });
    } else {
      renderCommandBuffer.push({
        cmd:       'drawCircle',
        x:         anim.x,
        y:         anim.y,
        radius:    HEX_SIZE * 0.45,
        fillColor: color,
        alpha:     1,
      });
    }

    // Movement key hints: letters on the controlled wisp's neighbor tiles.
    if (playerId === GameState.viewPlayerId && hasComponent(world, Movable, eid)) {
      drawKeyHints(world, driver, playerId as 0 | 1, dimLayer, q, r);
    }
  }

  // ── Pass 4: visual effects (Fx entities — shockwaves, dissolves, pulses) ──
  const fx = fxQuery(world);
  for (let i = 0; i < fx.length; i++) {
    const eid = fx[i];
    const dimLayer = Dimension.layer[eid];
    if (!GameState.revealBothDims && dimLayer !== localPlayerId) continue;

    const screen = dimLayer === 0
      ? driver.hexToScreenA(Position.q[eid], Position.r[eid])
      : driver.hexToScreenB(Position.q[eid], Position.r[eid]);
    const p = Fx.age[eid] / Fx.duration[eid]; // 0 → 1

    switch (Fx.kind[eid] as FxKind) {
      case FxKind.UNLOCK_SURGE: {
        // Gold shockwave: three staggered rings + a wide soft flash.
        for (const lag of [0, 0.15, 0.3]) {
          const lp = Math.max(0, Math.min(1, (p - lag) / (1 - lag)));
          if (lp <= 0 || lp >= 1) continue;
          renderCommandBuffer.push({
            cmd: 'drawCircle', x: screen.x, y: screen.y,
            radius: HEX_SIZE * (0.3 + 2.6 * lp),
            fillColor: 0xFFD84A, alpha: (1 - lp) * 0.55,
          });
        }
        renderCommandBuffer.push({
          cmd: 'drawCircle', x: screen.x, y: screen.y,
          radius: HEX_SIZE * 5 * p, fillColor: 0xFFF2B0, alpha: (1 - p) * 0.18,
        });
        break;
      }
      case FxKind.EXIT_DISSOLVE: {
        // Green dissolve: expanding ring while the center fades out.
        renderCommandBuffer.push({
          cmd: 'drawCircle', x: screen.x, y: screen.y,
          radius: HEX_SIZE * (0.45 + 1.8 * p),
          fillColor: 0x50FF80, alpha: (1 - p) * 0.5,
        });
        renderCommandBuffer.push({
          cmd: 'drawCircle', x: screen.x, y: screen.y,
          radius: HEX_SIZE * 0.45 * (1 - p),
          fillColor: 0xC8FFD8, alpha: (1 - p) * 0.8,
        });
        break;
      }
      case FxKind.LEVEL_COMPLETE: {
        renderCommandBuffer.push({
          cmd: 'drawCircle', x: screen.x, y: screen.y,
          radius: HEX_SIZE * 6 * p, fillColor: 0xFFFFFF, alpha: (1 - p) * 0.35,
        });
        break;
      }
    }
  }

  // ── Cosmetic decal overlay ─────────────────────────────────────────────────
  // Breaks up the otherwise-uniform, repeating floor tiles (Till's feedback,
  // 2026-07-21) — purely visual, re-scattered fresh every level load
  // (state/DecalState.ts), no gameplay meaning, never networked.
  for (const d of decals) {
    if (!GameState.revealBothDims && d.z !== localPlayerId) continue;
    const origin = d.z === 0 ? driver.hexToScreenA(0, 0) : driver.hexToScreenB(0, 0);
    renderCommandBuffer.push({
      cmd: 'drawDecal', x: origin.x + d.dx, y: origin.y + d.dy,
      width: d.width, height: d.height, path: d.path,
    });
  }

  // ── DNA Matrix ─────────────────────────────────────────────────────────────
  // Always visible on both screens — it is the shared workspace.
  const origin = driver.getMatrixOrigin();
  renderMatrix(world, renderCommandBuffer, origin.x, origin.y);

  // Flush commands to PixiDriver
  const cmds = renderCommandBuffer.drain();
  driver.executeBuffer(cmds);
}

// ── Movement key hints ───────────────────────────────────────────────────────
// The key letter of each direction is drawn on the corresponding neighbor tile
// of the controlled wisp, so the keyboard↔board mapping is always visible.
// Blocked tiles show the letter dimmed; off-board neighbors show nothing.
// (Answering the playtest question directly: the mapping mirrors the keyboard
// block — Q↖ W↑ E↗ / A↙ S↓ D↘, and U/I/O + J/K/L for P2. Confusion about it
// is NOT a design element.)

const KEY_FOR_DIRECTION: Record<0 | 1, Record<string, string>> = {
  0: { '-1,0': 'Q', '0,-1': 'W', '1,-1': 'E', '-1,1': 'A', '0,1': 'S', '1,0': 'D' },
  1: { '-1,0': 'U', '0,-1': 'I', '1,-1': 'O', '-1,1': 'J', '0,1': 'K', '1,0': 'L' },
};

function drawKeyHints(
  world: IWorld, driver: PixiDriver, playerId: 0 | 1,
  dimLayer: number, q: number, r: number,
): void {
  const statics = staticQuery(world);

  for (const [dq, dr] of HEX_DIRECTIONS) {
    const nq = q + dq, nr = r + dr;
    if (hexDistance(0, 0, nq, nr) > GameState.gridRadius) continue; // off-board

    let blocked = false;
    for (let i = 0; i < statics.length; i++) {
      const seid = statics[i];
      if (Position.q[seid] === nq && Position.r[seid] === nr && Position.z[seid] === dimLayer) {
        blocked = true;
        break;
      }
    }

    const screen = dimLayer === 0
      ? driver.hexToScreenA(nq, nr)
      : driver.hexToScreenB(nq, nr);

    renderCommandBuffer.push({
      cmd:   'drawText',
      x:     screen.x,
      y:     screen.y,
      text:  KEY_FOR_DIRECTION[playerId][`${dq},${dr}`] ?? '',
      color: blocked ? 0x555555 : 0xE8DCB8,
      size:  13,
      alpha: blocked ? 0.5 : 0.85,
      // Dark outline so this stays legible against EITHER dimension's floor
      // art — a fixed fill color alone read fine against the Id's dark
      // purple but too low-contrast against the Superego's pale ceramic
      // (Till's feedback, 2026-07-21).
      strokeColor: 0x1A1410,
      strokeWidth: 2.5,
    });
  }
}
