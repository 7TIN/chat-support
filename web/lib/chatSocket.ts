import type { Conversation, Message } from "@/lib/api";

export type ChatEvent =
  | { type: "message"; message: Message }
  | { type: "status"; conversation: Conversation }
  | { type: "error"; message: string };

export type ChatSocket = {
  send: (sender: Message["sender"], content: string) => void;
  isOpen: () => boolean;
  close: () => void;
};

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";

export function connectChat(
  conversationId: string,
  onEvent: (event: ChatEvent) => void
): ChatSocket {
  const ws = new WebSocket(
    `${WS_BASE}/ws/chat?conversationId=${encodeURIComponent(conversationId)}`
  );

  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data as string) as ChatEvent);
    } catch {
      /* ignore malformed frames */
    }
  };

  return {
    send: (sender, content) =>
      ws.send(JSON.stringify({ conversationId, sender, content })),
    isOpen: () => ws.readyState === WebSocket.OPEN,
    close: () => ws.close(),
  };
}
