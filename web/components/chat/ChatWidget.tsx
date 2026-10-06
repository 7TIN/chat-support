"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Message } from "@/lib/api";

type Phase = "identify" | "chat";

export function ChatWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("identify");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !conversationId) return;
    let stop = false;
    const load = () =>
      api
        .history(conversationId)
        .then((m) => {
          if (!stop) setMessages(m);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [open, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (!open) return null;

  async function start() {
    setError(null);
    if (!name.trim() || !email.trim() || !draft.trim()) {
      setError("Name, email and first message are required.");
      return;
    }
    setStarting(true);
    try {
      const conv = await api.startConversation(name.trim(), email.trim(), draft.trim());
      setConversationId(conv.id);
      setMessages(await api.history(conv.id));
      setDraft("");
      setPhase("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start chat.");
    } finally {
      setStarting(false);
    }
  }

  async function send() {
    if (!conversationId || !draft.trim()) return;
    setError(null);
    const text = draft.trim();
    setDraft("");
    try {
      await api.send(conversationId, "CUSTOMER", text);
      setMessages(await api.history(conversationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message.");
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="size-4" />
          Support chat
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chat">
          <X />
        </Button>
      </div>

      {phase === "identify" ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <label className="grid gap-1 text-sm">
            Name
            <input
              className="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:border-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Email
            <input
              className="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:border-ring"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </label>
          <label className="grid flex-1 gap-1 text-sm">
            First message
            <textarea
              className="min-h-24 flex-1 rounded-md border border-input bg-transparent p-3 outline-none focus-visible:border-ring"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Hi, I need help with..."
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={start} disabled={starting}>
            {starting ? "Starting..." : "Start chat"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.sender === "CUSTOMER"
                    ? "self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "self-start rounded-lg bg-muted px-3 py-2 text-sm"
                }
              >
                {m.content}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {error && <p className="px-4 text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 border-t p-3">
            <input
              className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Type a message..."
            />
            <Button size="icon" onClick={send} aria-label="Send message">
              <Send />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
