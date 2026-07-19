// LevelSelectScreen: pick any already-cleared level (or the next locked one
// in sequence). Includes progress reset. Opened from the lobby (host/local),
// the level-complete screen, Neural Collapse, and [ESC] in-game.
//
// Unlock rule: a level is playable if it was completed before OR it is the
// first not-yet-completed level of the campaign.

import { LEVEL_ORDER, LEVEL_NAMES } from '@/levels/levelIndex';
import { ProgressionState, resetProgress } from '@/state/ProgressionState';
import { resetTutorial } from '@/tutorial/TutorialState';

export class LevelSelectScreen {
  private el: HTMLElement;

  constructor(
    container: HTMLElement,
    onPick: (levelId: string) => void,
    onClose?: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;background:#080508ee;',
      'z-index:180;font-family:monospace;color:#c8a87c;gap:14px;',
    ].join('');

    const heading = document.createElement('h2');
    heading.textContent = 'SELECT DESCENT';
    heading.style.cssText = 'margin:0;font-size:1.6rem;letter-spacing:0.3em;color:#c8a87c;';

    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:760px;';

    const completed = ProgressionState.completedLevels;
    const firstOpenIdx = LEVEL_ORDER.findIndex(id => !completed.has(id));

    LEVEL_ORDER.forEach((id, idx) => {
      const done     = completed.has(id);
      const unlocked = done || idx === firstOpenIdx || firstOpenIdx === -1;

      const btn = document.createElement('button');
      btn.style.cssText = [
        `background:${done ? '#0e1e0e' : unlocked ? '#1e1008' : '#0a0808'};`,
        `color:${done ? '#50d050' : unlocked ? '#c8a87c' : '#3a3028'};`,
        `border:1px solid ${done ? '#2a5020' : unlocked ? '#5a3a10' : '#1a1208'};`,
        `padding:10px 6px;font-family:monospace;font-size:0.7rem;`,
        `letter-spacing:0.05em;cursor:${unlocked ? 'pointer' : 'default'};`,
        'display:flex;flex-direction:column;gap:4px;align-items:center;width:140px;',
      ].join('');
      btn.innerHTML =
        `<span style="font-size:0.9rem;">${done ? '✓ ' : unlocked ? '' : '🔒 '}${String(idx + 1).padStart(2, '0')}</span>` +
        `<span>${(LEVEL_NAMES[id] ?? id).toUpperCase()}</span>`;
      if (unlocked) {
        btn.addEventListener('click', () => { this.destroy(); onPick(id); });
      }
      grid.appendChild(btn);
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:12px;margin-top:6px;';

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'RESET PROGRESS';
    resetBtn.style.cssText =
      'background:#1e0808;color:#8a5050;border:1px solid #4a1010;padding:6px 14px;' +
      'font-family:monospace;font-size:0.7rem;letter-spacing:0.1em;cursor:pointer;';
    resetBtn.addEventListener('click', () => {
      if (!window.confirm('Delete ALL campaign progress and replay tutorials?')) return;
      resetProgress();
      resetTutorial();
      // Rebuild the grid with fresh state.
      this.destroy();
      new LevelSelectScreen(container, onPick, onClose);
    });
    footer.appendChild(resetBtn);

    if (onClose) {
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'BACK [ESC]';
      closeBtn.style.cssText =
        'background:#120d08;color:#7a6040;border:1px solid #3a2508;padding:6px 14px;' +
        'font-family:monospace;font-size:0.7rem;letter-spacing:0.1em;cursor:pointer;';
      closeBtn.addEventListener('click', () => { this.destroy(); onClose(); });
      footer.appendChild(closeBtn);
    }

    this.el.appendChild(heading);
    this.el.appendChild(grid);
    this.el.appendChild(footer);
    container.appendChild(this.el);
  }

  destroy(): void { this.el.remove(); }
}
