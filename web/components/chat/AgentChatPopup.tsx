"use client";

import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Conversation, type Customer } from "@/lib/api";
import { useConversationFeed } from "@/lib/useConversationFeed";

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentChatPopup({
  conversation,
  customer,
  onClose,
  onStatusChange,
  onRefreshList,
}: {
  conversation: Conversation;
  customer: Customer | null;
  onClose: () => void;
  onStatusChange: (conversation: Conversation) => void;
  onRefreshList: () => void;
}) {
  const [conv, setConv] = useState(conversation);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { messages, send: feedSend, error: feedError } = useConversationFeed(
    conversation.id,
    true,
    (updated) => {
      setConv(updated);
      onStatusChange(updated);
    }
  );
  const shownError = error ?? feedError;

  async function reply() {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    try {
      await feedSend("AGENT", text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reply.");
    }
  }

  async function closeConv() {
    await api.closeConversation(conv.id);
    onRefreshList();
  }

  async function reopenConv() {
    const reopened = await api.reopenConversation(conv.id);
    setConv(reopened);
    onStatusChange(reopened);
    onRefreshList();
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <MessageCircle className="size-4 shrink-0" />
          <span className="truncate">
            {customer ? `${customer.name} (${customer.email})` : `Chat ${conv.id.slice(0, 8)}`}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chat">
          <X />
        </Button>
      </div>

      <div className="border-b px-4 py-2 text-xs text-muted-foreground">
        {conv.status === "PENDING" && "Waiting for an available agent..."}
        {conv.status === "OPEN" && "Connected · reply as agent"}
        {conv.status === "CLOSED" && "This conversation is closed."}
        <span className="float-right">{conv.status}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.sender === "AGENT" ? "flex flex-col items-end" : "flex flex-col items-start"}
          >
            <div
              className={
                m.sender === "AGENT"
                  ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              {m.content}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {m.sender === "AGENT" ? `You · ${fmt(m.createdAt)}` : `${customer?.name ?? "Customer"} · ${fmt(m.createdAt)}`}
            </div>
          </div>
        ))}
      </div>

      {shownError && <p className="px-4 text-sm text-destructive">{shownError}</p>}

      {conv.status === "CLOSED" ? (
        <div className="border-t p-3">
          <Button className="w-full" variant="outline" onClick={reopenConv}>
            Reopen conversation
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 border-t p-3">
            <input
              className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") reply();
              }}
              placeholder="Reply as agent..."
            />
            <Button size="icon" onClick={reply} aria-label="Send reply">
              <Send />
            </Button>
          </div>
          <div className="px-3 pb-3">
            <Button size="sm" variant="ghost" className="w-full" onClick={closeConv}>
              Close conversation
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
