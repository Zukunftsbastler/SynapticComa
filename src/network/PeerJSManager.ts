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

export class PeerJSManager {
  private peer: Peer;
  private mainConn:   DataConnection | null = null;
  private chatConn:   DataConnection | null = null;

  private onMessageCallback: (msg: GameMessage | HandshakeMessage) => void = () => {};
  private onChatCallback:    (msg: ChatMessage) => void = () => {};
  private onDisconnectCallback: () => void = () => {};

  constructor(options?: ConstructorParameters<typeof Peer>[1]) {
    this.peer = new Peer(options ?? {});
  }

  /** Host: open peer, return 6-char uppercase room code. */
  hostGame(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.peer.on('open', id => resolve(id.slice(0, 6).toUpperCase()));
      this.peer.on('error', reject);
      this.peer.on('connection', conn => {
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

  /** Guest: connect to host's room code. */
  joinGame(code: string): Promise<void> {
    const peerId = code.toLowerCase();
    return new Promise((resolve, reject) => {
      this.mainConn = this.peer.connect(peerId, { label: 'main', reliable: true });
      this.chatConn = this.peer.connect(peerId, { label: 'chat', reliable: true });

      let mainOpen = false;
      let chatOpen = false;
      const tryResolve = () => { if (mainOpen && chatOpen) resolve(); };

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
      this.mainConn.on('error', reject);
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
