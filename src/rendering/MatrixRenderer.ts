// MatrixRenderer: draws the 5×5 DNA Matrix panel using RenderCommandBuffer commands.
// Called by RenderSystem once per frame.
//
// Art direction (docs/art_and_ui.md §4 — The Specimen Tray):
//   Housing: deep recessed wooden / rusted-metal tray with faded velvet lining.
//   Conduit plates: heavy Bakelite / clouded glass squares with etched pipe grooves.
//   Powered path: grooves fill with glowing viscous nerve-fluid (green→yellow glow).
//   Unpowered conduit: dark amber / clouded glass.
//   Source nodes (col 1): always-on deep amber glow.
//   Ability nodes (col 3/5): dim until powered; snap to warm brass glow when active.

import type { IWorld } from 'bitecs';
import { Conduit, MatrixNode } from '@/components';
import { conduitQuery, matrixNodeQuery } from '@/queries';
import { uiState } from '@/ui/uiState';
import { scrapPool } from '@/state/ScrapPoolState';
import { inventory } from '@/state/InventoryState';
import { GameState } from '@/state/GameState';
import type { RenderCommandBuffer } from './RenderCommandBuffer';
import { MATRIX_ROWS, MATRIX_COLS } from '@/constants';

// Column layout (1-indexed):
//   1 = source nodes        (left edge — always powered)
//   2 = conduit slots       (insertable)
//   3 = tier-1 ability nodes
//   4 = conduit slots       (insertable)
//   5 = tier-2 ability nodes

const CELL  = 48;  // px per matrix cell
const GAP   = 3;   // px gap between cells

// Palette — Medical Macabre Diorama
const C_TRAY_BG       = 0x120D08; // deep walnut / rusted steel tray
const C_CELL_EMPTY    = 0x1E1710; // dark velvet cell (empty conduit slot)
const C_SOURCE_OFF    = 0x5A3A0A; // source node — dim amber
const C_SOURCE_ON     = 0xD4820A; // source node — warm amber glow (always on)
const C_ABILITY_OFF   = 0x1A2A1A; // ability node — dead
const C_ABILITY_ON    = 0x50D050; // ability node — nerve-fluid green (powered)
const C_CONDUIT_BODY  = 0x3D2E12; // Bakelite plate body
const C_PIPE_UNLIT    = 0x2A1E08; // etched groove — unlit
const C_PIPE_LIT      = 0x8FFF70; // etched groove — flowing nerve fluid

// Column type classification (1-indexed).
function colType(col: number): 'source' | 'conduit' | 'ability' {
  if (col === 1)           return 'source';
  if (col === 2 || col === 4) return 'conduit';
  return 'ability'; // col 3 or 5
}

// Scrap Pool pile geometry — single source of truth shared with MatrixUI's
// click hit zone (an invisible affordance is no affordance; a drifting hit
// zone is worse). Centered below the tray, clear of the bottom insert arrows.
export function scrapPileRect(
  originX: number, originY: number,
): { x: number; y: number; w: number; h: number } {
  const totalW = MATRIX_COLS * CELL + (MATRIX_COLS - 1) * GAP;
  return {
    x: originX + totalW / 2 - 34,
    y: originY + MATRIX_ROWS * (CELL + GAP) + 30,
    w: 68,
    h: 44,
  };
}

export function renderMatrix(
  world: IWorld,
  buf: RenderCommandBuffer,
  originX: number,
  originY: number,
): void {
  const totalW = MATRIX_COLS * CELL + (MATRIX_COLS - 1) * GAP;
  const totalH = MATRIX_ROWS * CELL + (MATRIX_ROWS - 1) * GAP;

  // ── Tray background ────────────────────────────────────────────────────────
  buf.push({
    cmd: 'drawRect',
    x: originX - 6, y: originY - 6,
    width: totalW + 12, height: totalH + 12,
    fillColor: C_TRAY_BG,
    alpha: 1,
  });

  // ── Build lookup: (col, row) → (conduit eid | null) ───────────────────────
  const conduitMap = new Map<string, number>();
  const conduits = conduitQuery(world);
  for (let i = 0; i < conduits.length; i++) {
    const eid = conduits[i];
    const key = `${MatrixNode.column[eid]}_${MatrixNode.row[eid]}`;
    conduitMap.set(key, eid);
  }

  // Build lookup: (col, row) → MatrixNode eid (for non-conduit nodes)
  const nodeMap = new Map<string, number>();
  const nodes = matrixNodeQuery(world);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    // Only source and ability nodes (no Conduit component)
    if (!conduitMap.has(`${MatrixNode.column[eid]}_${MatrixNode.row[eid]}`)) {
      nodeMap.set(`${MatrixNode.column[eid]}_${MatrixNode.row[eid]}`, eid);
    }
  }

  // ── Draw each cell ─────────────────────────────────────────────────────────
  for (let row = 0; row < MATRIX_ROWS; row++) {
    for (let colIdx = 0; colIdx < MATRIX_COLS; colIdx++) {
      const col1 = colIdx + 1; // 1-indexed
      const cx = originX + colIdx * (CELL + GAP);
      const cy = originY + row * (CELL + GAP);
      const type = colType(col1);
      const conduitEid = conduitMap.get(`${col1}_${row}`);
      const nodeEid    = nodeMap.get(`${col1}_${row}`);

      if (type === 'conduit') {
        if (conduitEid !== undefined) {
          // Bakelite plate body
          buf.push({ cmd: 'drawRect', x: cx, y: cy, width: CELL, height: CELL, fillColor: C_CONDUIT_BODY, alpha: 1 });
          // Draw pipe segments as thin rectangles over the plate.
          drawPipe(buf, cx, cy, CELL, Conduit.faceMask[conduitEid], MatrixNode.active[conduitEid] === 1);
        } else {
          // Empty conduit slot
          buf.push({ cmd: 'drawRect', x: cx, y: cy, width: CELL, height: CELL, fillColor: C_CELL_EMPTY, alpha: 1 });
        }
      } else if (type === 'source') {
        const active = nodeEid !== undefined ? MatrixNode.active[nodeEid] === 1 : true;
        const color = active ? C_SOURCE_ON : C_SOURCE_OFF;
        buf.push({ cmd: 'drawRect', x: cx, y: cy, width: CELL, height: CELL, fillColor: color, alpha: 1 });
        // Small inner circle as visual indicator
        buf.push({ cmd: 'drawCircle', x: cx + CELL / 2, y: cy + CELL / 2, radius: CELL * 0.25, fillColor: active ? 0xFFCC44 : 0x3A2406, alpha: 1 });
      } else {
        // Ability node
        const active = nodeEid !== undefined ? MatrixNode.active[nodeEid] === 1 : false;
        const color = active ? C_ABILITY_ON : C_ABILITY_OFF;
        buf.push({ cmd: 'drawRect', x: cx, y: cy, width: CELL, height: CELL, fillColor: color, alpha: 1 });
        buf.push({ cmd: 'drawCircle', x: cx + CELL / 2, y: cy + CELL / 2, radius: CELL * 0.3, fillColor: active ? C_PIPE_LIT : 0x0D1A0D, alpha: 1 });
        // Ability glyph so nodes are identifiable (legend explains the codes).
        if (nodeEid !== undefined) {
          const glyph = ABILITY_GLYPHS[MatrixNode.abilityType[nodeEid]];
          if (glyph) {
            buf.push({
              cmd: 'drawText', x: cx + CELL / 2, y: cy + CELL / 2,
              text: glyph.text, color: active ? 0x0A200A : glyph.color, size: 15, alpha: 1,
            });
          }
        }
      }
    }
  }

  // ── Insert arrows (top/bottom of conduit columns 2 & 4) ────────────────────
  // These match MatrixUI's click hit zones exactly — an invisible affordance
  // is no affordance. While a plate is armed (clicked in the inventory), the
  // arrows pulse gold so the player sees exactly where to click next.
  const armed = uiState.insertArmed;
  const pulse = armed ? 0.65 + 0.35 * Math.sin(performance.now() / 150) : 0.9;
  const arrowSize  = armed ? 20 : 15;
  const arrowColor = armed ? 0xFFD84A : 0xC9A227;
  for (const colIdx of [1, 3]) {
    const cx = originX + colIdx * (CELL + GAP) + CELL / 2;
    const topY    = originY - 12;
    const bottomY = originY + MATRIX_ROWS * (CELL + GAP) + 9;
    if (armed) {
      buf.push({ cmd: 'drawCircle', x: cx, y: topY, radius: 13, fillColor: 0xC9A227, alpha: pulse * 0.25 });
      buf.push({ cmd: 'drawCircle', x: cx, y: bottomY, radius: 13, fillColor: 0xC9A227, alpha: pulse * 0.25 });
    }
    buf.push({ cmd: 'drawText', x: cx, y: topY, text: '▼', color: arrowColor, size: arrowSize, alpha: pulse });
    buf.push({ cmd: 'drawText', x: cx, y: bottomY, text: '▲', color: arrowColor, size: arrowSize, alpha: pulse });
  }

  // ── Scrap Pool pile (click → blind draw, 1 AP) ─────────────────────────────
  // Face-down stack below the tray. Count is public knowledge; contents never
  // shown (mechanics.md §4.3). Pulses when the viewing player holds no plates
  // and the pool could supply one — the Level-3 teaching moment.
  const pile  = scrapPileRect(originX, originY);
  const count = scrapPool.plates.length;
  const viewerInv = GameState.viewPlayerId === 0 ? inventory.player0 : inventory.player1;
  const hint  = count > 0 && viewerInv.length === 0;
  const hintPulse = hint ? 0.55 + 0.45 * Math.sin(performance.now() / 150) : 1;

  if (count === 0) {
    // Empty pool: dim recess only.
    buf.push({ cmd: 'drawRect', x: pile.x, y: pile.y, width: pile.w, height: pile.h, fillColor: C_CELL_EMPTY, alpha: 0.5 });
  } else {
    if (hint) {
      buf.push({ cmd: 'drawCircle', x: pile.x + pile.w / 2, y: pile.y + pile.h / 2, radius: 34, fillColor: 0xC9A227, alpha: hintPulse * 0.22 });
    }
    // Stack effect: up to three offset face-down plates.
    const layers = Math.min(count, 3);
    for (let i = layers - 1; i >= 0; i--) {
      buf.push({
        cmd: 'drawRect',
        x: pile.x + 4 - i * 2, y: pile.y + 4 - i * 2,
        width: pile.w - 8, height: pile.h - 8,
        fillColor: C_CONDUIT_BODY, alpha: 1,
      });
    }
    // Face-down marker + public count.
    buf.push({ cmd: 'drawText', x: pile.x + pile.w / 2 - 12, y: pile.y + pile.h / 2, text: '?', color: 0x8a6a30, size: 18, alpha: hintPulse });
    buf.push({ cmd: 'drawText', x: pile.x + pile.w / 2 + 14, y: pile.y + pile.h / 2, text: `×${count}`, color: 0xC9A227, size: 13, alpha: 1 });
    // Draw affordance: the same gold arrow language as the insert arrows.
    buf.push({ cmd: 'drawText', x: pile.x + pile.w / 2, y: pile.y - 12, text: '⤒', color: hint ? 0xFFD84A : 0xC9A227, size: hint ? 18 : 14, alpha: hintPulse });
  }
}

// Glyph per AbilityType (1=JUMP, 2=PUSH, 3=UNLOCK_RED, 4=UNLOCK_BLUE,
// 5=PHASE_SHIFT, 6=FIRE_IMMUNITY).
const ABILITY_GLYPHS: Record<number, { text: string; color: number }> = {
  1: { text: '⇈', color: 0x9AD0FF },
  2: { text: '▶', color: 0xC8C8C8 },
  3: { text: 'R', color: 0xFF5A6A },
  4: { text: 'B', color: 0x5A9AFF },
  5: { text: '◈', color: 0xB090FF },
  6: { text: '♨', color: 0xFF9A40 },
};

// Draws the etched pipe grooves over a conduit plate cell.
// faceMask bits: 0=E, 1=S, 2=W, 3=N.
function drawPipe(
  buf: RenderCommandBuffer,
  cx: number,
  cy: number,
  size: number,
  faceMask: number,
  powered: boolean,
): void {
  const color = powered ? C_PIPE_LIT : C_PIPE_UNLIT;
  const half  = size / 2;
  const thick = size * 0.14; // pipe width
  const ht    = thick / 2;

  // Center hub
  buf.push({ cmd: 'drawRect', x: cx + half - ht, y: cy + half - ht, width: thick, height: thick, fillColor: color, alpha: 1 });

  // East segment
  if ((faceMask >> 0) & 1) {
    buf.push({ cmd: 'drawRect', x: cx + half, y: cy + half - ht, width: half, height: thick, fillColor: color, alpha: 1 });
  }
  // South segment
  if ((faceMask >> 1) & 1) {
    buf.push({ cmd: 'drawRect', x: cx + half - ht, y: cy + half, width: thick, height: half, fillColor: color, alpha: 1 });
  }
  // West segment
  if ((faceMask >> 2) & 1) {
    buf.push({ cmd: 'drawRect', x: cx, y: cy + half - ht, width: half, height: thick, fillColor: color, alpha: 1 });
  }
  // North segment
  if ((faceMask >> 3) & 1) {
    buf.push({ cmd: 'drawRect', x: cx + half - ht, y: cy, width: thick, height: half, fillColor: color, alpha: 1 });
  }
}
