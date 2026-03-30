// LobbyUI: pre-game screen for establishing a WebRTC connection via PeerJS.
// Host generates a 6-character room code; Guest enters it to connect.
// On successful connection, calls the provided onConnected callback.
//
// Art direction (docs/art_and_ui.md): medical macabre typography. The lobby
// is an overlay on the black canvas — no PixiJS sprites, just DOM.

import { peerManager } from '@/network/PeerJSManager';
import type { HandshakeMessage } from '@/network/messages';
import { initNetworkSystem } from '@/network/NetworkSystem';
import { GameState } from '@/state/GameState';

export class LobbyUI {
  private el: HTMLElement;
  private onConnected: (role: 0 | 1, levelId: string) => void;

  constructor(container: HTMLElement, onConnected: (role: 0 | 1, levelId: string) => void) {
    this.onConnected = onConnected;
    this.el = document.createElement('div');
    this.el.id = 'lobby';
    this.el.style.cssText = [
      'position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;background:#080508;',
      'color:#c8a87c;font-family:monospace;gap:16px;z-index:100;',
    ].join('');
    container.appendChild(this.el);
    this.render();
  }

  private render(): void {
    this.el.innerHTML = `
      <h1 style="font-size:2rem;letter-spacing:0.2em;margin:0">SYNAPTIC COMA</h1>
      <div style="display:flex;gap:12px;margin-top:8px">
        <button id="btn-host" style="${btnStyle()}">HOST</button>
        <button id="btn-join" style="${btnStyle()}">JOIN</button>
      </div>
      <div id="lobby-status" style="font-size:0.9rem;color:#7a6040;min-height:1.5em"></div>
      <div id="lobby-join-row" style="display:none;gap:8px;align-items:center">
        <input id="lobby-code" maxlength="6" placeholder="ROOM CODE"
          style="background:#120d08;color:#c8a87c;border:1px solid #5a3a10;
                 padding:6px 10px;font-family:monospace;font-size:1rem;
                 text-transform:uppercase;width:120px;text-align:center" />
        <button id="btn-connect" style="${btnStyle()}">CONNECT</button>
      </div>
    `;

    this.el.querySelector('#btn-host')!.addEventListener('click', () => this.startHost());
    this.el.querySelector('#btn-join')!.addEventListener('click', () => {
      const row = this.el.querySelector('#lobby-join-row') as HTMLElement;
      row.style.display = 'flex';
    });
    this.el.querySelector('#btn-connect')!.addEventListener('click', () => {
      const code = (this.el.querySelector('#lobby-code') as HTMLInputElement).value.trim();
      if (code.length === 6) this.startJoin(code);
    });
  }

  private setStatus(msg: string): void {
    (this.el.querySelector('#lobby-status') as HTMLElement).textContent = msg;
  }

  private async startHost(): Promise<void> {
    this.setStatus('Opening connection…');
    try {
      const code = await peerManager.hostGame();
      this.setStatus(`Room code: ${code} — waiting for guest…`);

      initNetworkSystem((handshake: HandshakeMessage) => {
        // Guest connected — send handshake back.
        GameState.localPlayerId = 0;
        peerManager.send({
          type: 'HANDSHAKE', nonce: handshake.nonce, levelId: 'level_01', role: 0,
        } as unknown as HandshakeMessage);
        this.destroy();
        this.onConnected(0, 'level_01');
      });
    } catch {
      this.setStatus('Connection failed. Reload to retry.');
    }
  }

  private async startJoin(code: string): Promise<void> {
    this.setStatus('Connecting…');
    try {
      await peerManager.joinGame(code);
      const nonce = Math.random();
      // Send handshake to host.
      peerManager.send({
        type: 'HANDSHAKE', nonce, levelId: '', role: 1,
      } as unknown as HandshakeMessage);

      initNetworkSystem((handshake: HandshakeMessage) => {
        GameState.localPlayerId = 1;
        this.destroy();
        this.onConnected(1, handshake.levelId);
      });
    } catch {
      this.setStatus('Could not connect. Check the code and retry.');
    }
  }

  destroy(): void {
    this.el.remove();
  }
}

function btnStyle(): string {
  return [
    'background:#1e1008;color:#c8a87c;border:1px solid #5a3a10;',
    'padding:8px 20px;font-family:monospace;font-size:0.9rem;cursor:pointer;',
    'letter-spacing:0.1em',
  ].join('');
}
