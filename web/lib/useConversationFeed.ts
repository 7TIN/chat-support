"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Conversation, type Message } from "@/lib/api";
import { connectChat, type ChatSocket } from "@/lib/chatSocket";

/**
 * Live feed for one conversation: initial REST history, then
 * real-time messages + status changes over WebSocket.
 * Falls back to REST when the socket isn't connected.
 */
export function useConversationFeed(
  conversationId: string | null,
  active: boolean,
  onStatus?: (conversation: Conversation) => void
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sockRef = useRef<ChatSocket | null>(null);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  useEffect(() => {
    if (!active || !conversationId) {
      setMessages([]);
      return;
    }
    let stop = false;
    api
      .history(conversationId)
      .then((m) => {
        if (!stop) setMessages(m);
      })
      .catch((e) => {
        if (!stop) setError(e instanceof Error ? e.message : "Could not load messages.");
      });

    const sock = connectChat(conversationId, (ev) => {
      if (stop) return;
      if (ev.type === "message") {
        setMessages((prev) =>
          prev.some((m) => m.id === ev.message.id) ? prev : [...prev, ev.message]
        );
      } else if (ev.type === "status") {
        statusRef.current?.(ev.conversation);
      } else if (ev.type === "error") {
        setError(ev.message);
      }
    });
    sockRef.current = sock;
    return () => {
      stop = true;
      sock.close();
      sockRef.current = null;
    };
  }, [active, conversationId]);

  async function send(sender: Message["sender"], content: string) {
    const text = content.trim();
    if (!conversationId || !text) return;
    setError(null);
    const sock = sockRef.current;
    // Small delay so the socket has a chance to open right after connecting.
    for (let i = 0; i < 10 && (!sock || !sock.isOpen()); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (sock && sock.isOpen()) {
      sock.send(sender, text);
    } else {
      await api.send(conversationId, sender, text);
      setMessages(await api.history(conversationId));
    }
  }

  return { messages, send, error, setError };
}
