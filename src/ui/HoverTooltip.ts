// HoverTooltip: explanatory mouseover for whatever occupies the hex under
// the cursor — the other half of Till's ACHTUNG (2026-07-22) alongside
// LegendPanel's real-art thumbnails. Reuses uiState.hoveredHex (already
// populated by MouseInput.ts to drive RenderSystem's hex hover-highlight
// border) and ENTITY_LABELS (shared with LegendPanel.ts) so this tooltip and
// the legend can never disagree on what a symbol means.

import { world } from '@/gameLoop';
import { hasComponent } from 'bitecs';
import { Position, Renderable, Dimension, Static } from '@/components';
import { renderableQuery } from '@/queries';
import { GameState } from '@/state/GameState';
import { uiState } from '@/ui/uiState';
import { SpriteId } from '@/registry/SpriteRegistry';
import { ENTITY_LABELS } from '@/ui/legendLabels';

function labelAt(q: number, r: number, z: 0 | 1, viewId: 0 | 1): string | null {
  const rs = renderableQuery(world);
  for (let i = 0; i < rs.length; i++) {
    const eid = rs[i];
    if (Dimension.layer[eid] !== z) continue;
    if (Position.q[eid] !== q || Position.r[eid] !== r) continue;
    const sid = Renderable.spriteId[eid] as SpriteId;

    if (sid === SpriteId.AVATAR_P1) return z === viewId ? 'You (controlled)' : 'Player 1';
    if (sid === SpriteId.AVATAR_P2) return z === viewId ? 'You (controlled)' : 'Player 2';
    if (sid === SpriteId.EXIT_NEXUS_A || sid === SpriteId.EXIT_NEXUS_B) {
      return hasComponent(world, Static, eid)
        ? 'Exit — opens after P1 exits'
        : 'Exit — the goal';
    }
    const known = ENTITY_LABELS[sid];
    if (known) return known;
  }
  return null;
}

export class HoverTooltip {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;pointer-events:none;z-index:40;display:none;',
      'background:#0c0a08ee;border:1px solid #3a2508;color:#c8a87c;',
      'font-family:monospace;font-size:0.68rem;padding:4px 8px;',
      'max-width:220px;line-height:1.35;',
    ].join('');
    container.appendChild(this.el);
  }

  /** Call each render frame — cheap no-op unless a hex is actually hovered. */
  update(): void {
    const hex   = uiState.hoveredHex;
    const mouse = uiState.mouseClient;
    if (!hex || !mouse || GameState.phase !== 'PLAYING') {
      this.el.style.display = 'none';
      return;
    }

    const label = labelAt(hex.q, hex.r, hex.z, GameState.viewPlayerId);
    if (!label) {
      this.el.style.display = 'none';
      return;
    }

    this.el.textContent   = label;
    this.el.style.left    = `${mouse.x + 14}px`;
    this.el.style.top     = `${mouse.y + 14}px`;
    this.el.style.display = 'block';
  }

  destroy(): void { this.el.remove(); }
}
