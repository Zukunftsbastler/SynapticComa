// PeerJSManager: wraps PeerJS WebRTC data-channel connectivity.
// Exposes two channels:
//   main   — GameMessage (ECS state updates, inputs)
//   chat   — ChatMessage (emoji-only, separate DataConnection)
//
// Usage:
//   Host: const code = await peerManager.hostGame();
//   Guest: await peerManager.joinGame(code);
//
// PeerJS public signaling is used for development. For production, pass a
// PeerJSOptions object to override host/port/path with a self-hosted server.

import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { GameMessage, HandshakeMessage, ChatMessage } from '@/network/messages';

export type AnyMessage = GameMessage | HandshakeMessage | ChatMessage;

// Room codes use an unambiguous alphabet (no 0/O, 1/I) and map onto a
// deterministic PeerJS id: the Host claims `sycoma-<code>` at the broker, and
// the Guest connects to exactly that id. (The previous implementation showed
// the first 6 chars of a *random* broker id as the "code" — a Guest connecting
// to that fragment could never find the real peer.)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PREFIX   = 'sycoma-';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export class PeerJSManager {
  private peer: Peer | null = null;
  private mainConn:   DataConnection | null = null;
  private chatConn:   DataConnection | null = null;

  private onMessageCallback: (msg: GameMessage | HandshakeMessage) => void = () => {};
  private onChatCallback:    (msg: ChatMessage) => void = () => {};
  private onDisconnectCallback: () => void = () => {};

  /** Host: claim a deterministic room id at the broker, return the code. */
  hostGame(): Promise<string> {
    const code = generateRoomCode();
    this.peer = new Peer(CODE_PREFIX + code.toLowerCase());
    const peer = this.peer;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Signaling server timeout')), 15000);
      peer.on('open', () => { clearTimeout(timer); resolve(code); });
      peer.on('error', err => { clearTimeout(timer); reject(err); });
      peer.on('connection', conn => {
        if (conn.label === 'chat') {
          this.chatConn = conn;
          this.setupChatConnection(conn);
        } else {
          this.mainConn = conn;
          this.setupMainConnection(conn);
        }
      });
    });
  }

  /** Guest: connect to the Host's deterministic room id. */
  joinGame(code: string): Promise<void> {
    const hostId = CODE_PREFIX + code.trim().toLowerCase();
    this.peer = new Peer();
    const peer = this.peer;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection timeout')), 15000);
      peer.on('error', err => { clearTimeout(timer); reject(err); });
      peer.on('open', () => {
        this.mainConn = peer.connect(hostId, { label: 'main', reliable: true });
        this.chatConn = peer.connect(hostId, { label: 'chat', reliable: true });

        let mainOpen = false;
        let chatOpen = false;
        const tryResolve = () => {
          if (mainOpen && chatOpen) { clearTimeout(timer); resolve(); }
        };

        this.mainConn.on('open', () => {
          mainOpen = true;
          this.setupMainConnection(this.mainConn!);
          tryResolve();
        });
        this.chatConn.on('open', () => {
          chatOpen = true;
          this.setupChatConnection(this.chatConn!);
          tryResolve();
        });
        this.mainConn.on('error', err => { clearTimeout(timer); reject(err); });
      });
    });
  }

  /** Send a game or handshake message on the main channel. */
  send(msg: GameMessage | HandshakeMessage): void {
    this.mainConn?.send(msg);
  }

  /** Send a chat message on the separate chat channel. */
  sendChat(msg: ChatMessage): void {
    this.chatConn?.send(msg);
  }

  /** Register callback for incoming game/handshake messages. */
  onMessage(cb: (msg: GameMessage | HandshakeMessage) => void): void {
    this.onMessageCallback = cb;
  }

  /** Register callback for incoming chat messages. */
  onChat(cb: (msg: ChatMessage) => void): void {
    this.onChatCallback = cb;
  }

  /** Register callback for disconnect events. */
  onDisconnect(cb: () => void): void {
    this.onDisconnectCallback = cb;
  }

  isConnected(): boolean {
    return this.mainConn?.open ?? false;
  }

  private setupMainConnection(conn: DataConnection): void {
    conn.on('data', raw => this.onMessageCallback(raw as GameMessage | HandshakeMessage));
    conn.on('close', () => this.onDisconnectCallback());
    conn.on('error', () => this.onDisconnectCallback());
  }

  private setupChatConnection(conn: DataConnection): void {
    conn.on('data', raw => this.onChatCallback(raw as ChatMessage));
  }
}

export const peerManager = new PeerJSManager();
