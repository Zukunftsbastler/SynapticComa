// LevelCompleteScreen: DOM overlay shown when LevelCompleteEvent is consumed.
// "Next Level" button triggers loadLevel on both peers simultaneously.
// "Neural Collapse" screen is shown instead when failureCount >= 2 on a retry.
//
// No PixiJS — this is a full-screen DOM overlay.
// Art direction: medical macabre, clinical green accents on failure prompt.

import { GameState } from '@/state/GameState';
import { markLevelComplete, advanceToNextLevel, ProgressionState } from '@/state/ProgressionState';
import { LEVEL_ORDER } from '@/levels/levelIndex';

type OnNextLevel = (levelId: string) => void;
type OnNeuralCollapse = () => void;

export class LevelCompleteScreen {
  private el: HTMLElement;

  constructor(
    container: HTMLElement,
    onNextLevel: OnNextLevel,
    onNeuralCollapse: OnNeuralCollapse,
  ) {
    markLevelComplete(GameState.currentLevel, GameState.failureCount);

    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;',
      'background:#08050acc;z-index:200;font-family:monospace;color:#c8a87c;gap:20px;',
    ].join('');

    const heading = document.createElement('h2');
    heading.textContent = 'NEXUS CLEARED';
    heading.style.cssText = 'margin:0;font-size:2rem;letter-spacing:0.3em;color:#50d050;';

    const levelLabel = document.createElement('div');
    levelLabel.style.cssText = 'color:#7a6040;font-size:0.9rem;letter-spacing:0.15em;';
    levelLabel.textContent = GameState.currentLevel.replace('_', ' ').toUpperCase();

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;';

    const nextId = advanceToNextLevel(LEVEL_ORDER);
    if (nextId) {
      const btnNext = this.makeButton('NEXT LEVEL', '#1e3010', '#50d050', '#2a5020');
      btnNext.addEventListener('click', () => {
        this.destroy();
        onNextLevel(nextId);
      });
      btnRow.appendChild(btnNext);
    } else {
      const done = document.createElement('div');
      done.textContent = 'ALL LEVELS COMPLETE';
      done.style.cssText = 'color:#50d050;letter-spacing:0.2em;';
      btnRow.appendChild(done);
    }

    const btnMenu = this.makeButton('LEVEL SELECT', '#1a0808', '#c8a87c', '#5a3010');
    btnMenu.addEventListener('click', () => {
      this.destroy();
      onNeuralCollapse(); // Reuse callback to return to menu
    });
    btnRow.appendChild(btnMenu);

    this.el.appendChild(heading);
    this.el.appendChild(levelLabel);
    this.el.appendChild(btnRow);
    container.appendChild(this.el);
  }

  private makeButton(label: string, bg: string, color: string, border: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = [
      `background:${bg};color:${color};border:1px solid ${border};`,
      'padding:10px 24px;font-family:monospace;font-size:0.9rem;cursor:pointer;',
      'letter-spacing:0.1em;',
    ].join('');
    return btn;
  }

  destroy(): void { this.el.remove(); }
}

export class NeuralCollapseScreen {
  private el: HTMLElement;

  constructor(container: HTMLElement, onReturnToMenu: () => void) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;',
      'background:#080508;z-index:200;font-family:monospace;color:#c8a87c;gap:24px;',
    ].join('');

    const heading = document.createElement('h2');
    heading.textContent = 'NEURAL COLLAPSE';
    heading.style.cssText = 'margin:0;font-size:2.2rem;letter-spacing:0.3em;color:#8b2020;';

    const sub = document.createElement('div');
    sub.textContent = 'The synaptic matrix is overloaded. Connection severed.';
    sub.style.cssText = 'color:#5a3030;font-size:0.85rem;max-width:400px;text-align:center;';

    const btnReturn = document.createElement('button');
    btnReturn.textContent = 'RECONNECT';
    btnReturn.style.cssText = [
      'background:#1e0808;color:#c8a87c;border:1px solid #8b2020;',
      'padding:10px 24px;font-family:monospace;font-size:0.9rem;cursor:pointer;',
      'letter-spacing:0.1em;margin-top:8px;',
    ].join('');
    btnReturn.addEventListener('click', () => {
      this.destroy();
      onReturnToMenu();
    });

    this.el.appendChild(heading);
    this.el.appendChild(sub);
    this.el.appendChild(btnReturn);
    container.appendChild(this.el);
  }

  destroy(): void { this.el.remove(); }
}
