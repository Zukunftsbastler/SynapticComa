// AbilityPanel: shows currently active ability nodes from abilityFlags.
// Polls each render frame — no EventBus.
// Rendered as a small vertical strip on the right side, above ChatUI.

import { abilityFlags } from '@/systems/AbilitySystem';

const ABILITY_ROWS: { label: string; key: keyof typeof abilityFlags }[] = [
  { label: '↑↑ JUMP',    key: 'jumpActive'       },
  { label: '▶ PUSH',     key: 'pushActive'       },
  { label: '◈ PHASE',    key: 'phaseShiftActive' },
];

export class AbilityPanel {
  private el:   HTMLElement;
  private rows: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;right:8px;top:36px;display:flex;flex-direction:column;',
      'gap:4px;z-index:20;pointer-events:none;',
    ].join('');

    for (const row of ABILITY_ROWS) {
      const div = document.createElement('div');
      div.dataset['key'] = row.key;
      div.style.cssText = [
        'padding:3px 8px;font-family:monospace;font-size:0.7rem;',
        'letter-spacing:0.08em;border:1px solid transparent;',
      ].join('');
      div.textContent = row.label;
      this.el.appendChild(div);
      this.rows.push(div);
    }

    container.appendChild(this.el);
  }

  update(): void {
    for (let i = 0; i < ABILITY_ROWS.length; i++) {
      const active = abilityFlags[ABILITY_ROWS[i].key];
      const div    = this.rows[i];
      div.style.background  = active ? '#1e3010' : '#0a0808';
      div.style.color       = active ? '#50d050' : '#3a3028';
      div.style.borderColor = active ? '#2a5020' : '#1a1208';
    }
  }

  destroy(): void { this.el.remove(); }
}
