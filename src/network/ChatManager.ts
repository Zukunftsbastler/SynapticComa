// ChatManager: routes emoji-only chat messages on the dedicated chat channel.
// No ECS interaction — chat is purely UI. Emits to ChatUI via callback.
// Emoji validation: only allow strings that consist entirely of Unicode emoji.

import { peerManager } from '@/network/PeerJSManager';
import type { ChatMessage } from '@/network/messages';
import { GameState } from '@/state/GameState';

type ChatListener = (msg: ChatMessage) => void;
const listeners: ChatListener[] = [];

// Rough emoji validation — rejects plain text.
function isEmojiOnly(text: string): boolean {
  // Strip whitespace and check that every grapheme cluster is in the emoji range.
  const stripped = text.replace(/\s/g, '');
  if (stripped.length === 0) return false;
  // Use the Unicode emoji regex if supported by the runtime, else allow through.
  const emojiRE = /^\p{Emoji}+$/u;
  return emojiRE.test(stripped);
}

export function sendChat(emoji: string): void {
  if (!isEmojiOnly(emoji)) return;

  const msg: ChatMessage = {
    type:     'CHAT',
    senderId: GameState.localPlayerId,
    emoji,
  };

  peerManager.sendChat(msg);

  // Echo locally so the sender sees their own message.
  for (const cb of listeners) cb(msg);
}

export function onChatMessage(cb: ChatListener): void {
  listeners.push(cb);
}

// Wire incoming chat messages from PeerJSManager → ChatManager listeners.
peerManager.onChat(msg => {
  for (const cb of listeners) cb(msg);
});
