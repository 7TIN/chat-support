"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Conversation } from "@/lib/api";
import { useConversationFeed } from "@/lib/useConversationFeed";

type Customer = { id: string; name: string; email: string };
type View = "identify" | "chat" | "history" | "newChat";

const STORE_KEY = "support-chat-customer";

function loadStored(): Customer | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  } catch {
    return null;
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<View>("identify");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    send: feedSend,
    error: feedError,
  } = useConversationFeed(conv?.id ?? null, open && view === "chat", (updated) => {
    setConv(updated);
    setConvs((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  });
  const shownError = error ?? feedError;

  const activeConv = convs.find((c) => c.status === "OPEN" || c.status === "PENDING") ?? null;

  // Restore returning customer when the popup opens.
  useEffect(() => {
    if (!open) return;
    const stored = loadStored();
    if (!stored) {
      setView("identify");
      return;
    }
    setCustomer(stored);
    setName(stored.name);
    setEmail(stored.email);
    api
      .byCustomer(stored.id)
      .then((list) => {
        setConvs(list);
        const active = list.find((c) => c.status === "OPEN" || c.status === "PENDING") ?? null;
        if (active) {
          setConv(active);
          setView("chat");
        } else {
          setConv(null);
          setView("history");
        }
      })
      .catch(() => {
        localStorage.removeItem(STORE_KEY);
        setCustomer(null);
        setView("identify");
      });
  }, [open ]);

  // Live messages + status arrive via useConversationFeed above.

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (!open) return null;

  function remember(c: Customer) {
    setCustomer(c);
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  }

  async function refreshList(customerId: string) {
    const list = await api.byCustomer(customerId);
    setConvs(list);
    return list;
  }

  async function start(firstMessage: string) {
    setError(null);
    if (!name.trim() || !email.trim() || !firstMessage.trim()) {
      setError("Name, email and message are required.");
      return;
    }
    setBusy(true);
    try {
      const created = await api.startConversation(name.trim(), email.trim(), firstMessage.trim());
      const c: Customer = { id: created.customerId, name: name.trim(), email: email.trim() };
      remember(c);
      const list = await refreshList(c.id);
      setConv(list.find((x) => x.id === created.id) ?? created);
      setDraft("");
      setView("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start chat.");
    } finally {
      setBusy(false);
    }
  }

  async function openHistory(id: string) {
    setError(null);
    try {
      const c = await api.getConversation(id);
      setConv(c);
      setView("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open conversation.");
    }
  }

  async function send() {
    if (!conv || conv.status === "CLOSED" || !draft.trim()) return;
    setError(null);
    const text = draft.trim();
    setDraft("");
    try {
      await feedSend("CUSTOMER", text);
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
        <div className="flex items-center gap-1">
          {customer && view !== "history" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView("history")}
              aria-label="Conversation history"
            >
              <History />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chat">
            <X />
          </Button>
        </div>
      </div>

      {view === "identify" && (
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
          {shownError && <p className="text-sm text-destructive">{shownError}</p>}
          <Button onClick={() => start(draft)} disabled={busy}>
            {busy ? "Starting..." : "Start chat"}
          </Button>
        </div>
      )}

      {view === "history" && (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground">
            {customer ? `Signed in as ${customer.email}` : "Previous conversations"}
          </p>
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => openHistory(c.id)}
              className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="flex items-center justify-between">
                <span className="font-mono text-xs">{c.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">{c.status}</span>
              </span>
              <span className="text-xs text-muted-foreground">{fmt(c.updatedAt)}</span>
            </button>
          ))}
          {convs.length === 0 && (
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
          )}
          <div className="mt-auto flex gap-2">
            {activeConv ? (
              <Button className="flex-1" onClick={() => openHistory(activeConv.id)}>
                Go to active chat
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => setView("newChat")}>
                <Plus /> Start new conversation
              </Button>
            )}
          </div>
          {shownError && <p className="text-sm text-destructive">{shownError}</p>}
        </div>
      )}

      {view === "newChat" && (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">Start a new conversation as {email}.</p>
          <textarea
            className="min-h-24 flex-1 rounded-md border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Describe your issue..."
          />
          {shownError && <p className="text-sm text-destructive">{shownError}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setView("history")}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => start(draft)} disabled={busy}>
              {busy ? "Starting..." : "Send"}
            </Button>
          </div>
        </div>
      )}

      {view === "chat" && conv && (
        <>
          <div className="border-b px-4 py-2 text-xs text-muted-foreground">
            {conv.status === "PENDING" && "Waiting for an available agent..."}
            {conv.status === "OPEN" && (conv.agentId ? "Connected to an agent" : "Open conversation")}
            {conv.status === "CLOSED" && "This conversation is closed."}
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.sender === "CUSTOMER" ? "flex flex-col items-end" : "flex flex-col items-start"}
              >
                <div
                  className={
                    m.sender === "CUSTOMER"
                      ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  {m.content}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {m.sender === "CUSTOMER" ? "You" : "Agent"} · {fmt(m.createdAt)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {shownError && <p className="px-4 text-sm text-destructive">{shownError}</p>}
          {conv.status === "CLOSED" ? (
            <div className="border-t p-3">
              <Button className="w-full" onClick={() => setView("newChat")}>
                <Plus /> Start new conversation
              </Button>
            </div>
          ) : (
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
          )}
        </>
      )}
    </div>
  );
}
