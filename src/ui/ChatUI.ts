// ChatUI: emoji-only chat strip.
// Shows last N received emoji messages as a vertical strip on the right edge.
// No text input — player taps one of the emoji buttons to send.
// Separate from all ECS systems; communicates only through ChatManager.

import { sendChat, onChatMessage } from '@/network/ChatManager';
import type { ChatMessage } from '@/network/messages';

const MAX_MESSAGES = 6;
const EMOJI_PALETTE = ['👍', '👎', '❓', '⚡', '🔥', '💀', '🎯', '🤝'];

export class ChatUI {
  private el: HTMLElement;
  private strip: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;',
      'align-items:flex-end;gap:4px;z-index:50;pointer-events:none;',
    ].join('');

    // Message strip (top portion).
    this.strip = document.createElement('div');
    this.strip.style.cssText = [
      'display:flex;flex-direction:column-reverse;gap:2px;min-height:120px;',
      'justify-content:flex-start;',
    ].join('');
    this.el.appendChild(this.strip);

    // Emoji palette (bottom portion).
    const palette = document.createElement('div');
    palette.style.cssText = [
      'display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;',
      'pointer-events:all;',
    ].join('');
    for (const emoji of EMOJI_PALETTE) {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = [
        'background:#120d08;border:1px solid #3a2508;',
        'font-size:1.2rem;padding:4px 6px;cursor:pointer;line-height:1;',
        'border-radius:4px;',
      ].join('');
      btn.addEventListener('click', () => sendChat(emoji));
      palette.appendChild(btn);
    }
    this.el.appendChild(palette);
    container.appendChild(this.el);

    onChatMessage(msg => this.receive(msg));
  }

  private receive(msg: ChatMessage): void {
    const div = document.createElement('div');
    div.style.cssText = [
      'background:#120d08cc;padding:2px 6px;border-radius:4px;',
      'font-size:1.3rem;border:1px solid #3a2508;',
    ].join('');
    div.textContent = `P${msg.senderId + 1}: ${msg.emoji}`;
    this.strip.prepend(div);

    // Cap message count.
    while (this.strip.children.length > MAX_MESSAGES) {
      this.strip.lastChild?.remove();
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
