"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Agent, type Conversation, type Message } from "@/lib/api";

const statusColor: Record<Agent["status"], string> = {
  ONLINE: "bg-emerald-500",
  BUSY: "bg-amber-500",
  OFFLINE: "bg-zinc-400",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const refreshAgents = useCallback(async () => {
    const list = await api.agents();
    setAgents(list);
    setSelectedAgent((prev) => list.find((a) => a.id === prev?.id) ?? list[0] ?? null);
  }, []);

  const refreshConvs = useCallback(async (agentId: string) => {
    const list = await api.byAgent(agentId);
    setConversations(list);
    setSelectedConv((prev) => list.find((c) => c.id === prev?.id) ?? null);
  }, []);

  useEffect(() => {
    refreshAgents().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [refreshAgents]);

  useEffect(() => {
    if (selectedAgent) refreshConvs(selectedAgent.id).catch(() => {});
  }, [selectedAgent, refreshConvs]);

  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }
    let stop = false;
    const load = () =>
      api
        .history(selectedConv.id)
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
  }, [selectedConv]);

  async function changeStatus(status: Agent["status"]) {
    if (!selectedAgent) return;
    const updated = await api.setAgentStatus(selectedAgent.id, status);
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAgent(updated);
  }

  async function reply() {
    if (!selectedConv || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    await api.send(selectedConv.id, "AGENT", text);
    setMessages(await api.history(selectedConv.id));
  }

  async function closeConv() {
    if (!selectedConv || !selectedAgent) return;
    await api.closeConversation(selectedConv.id);
    await refreshConvs(selectedAgent.id);
  }

  async function reopenConv() {
    if (!selectedConv || !selectedAgent) return;
    const reopened = await api.reopenConversation(selectedConv.id);
    setSelectedConv(reopened);
    await refreshConvs(selectedAgent.id);
  }

  async function addAgent() {
    if (!newName.trim() || !newEmail.trim()) return;
    await api.createAgent(newName.trim(), newEmail.trim());
    setNewName("");
    setNewEmail("");
    await refreshAgents();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Acme Support
        </Link>
        <span className="text-sm text-muted-foreground">Agent dashboard</span>
      </header>

      {error && <p className="px-6 pt-4 text-sm text-destructive">{error}</p>}

      <div className="grid flex-1 gap-4 p-6 md:grid-cols-[240px_300px_1fr]">
        <section className="flex flex-col gap-2 rounded-xl border p-3">
          <h2 className="px-1 text-sm font-semibold">Agents</h2>
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a)}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted ${
                selectedAgent?.id === a.id ? "bg-muted" : ""
              }`}
            >
              <span className={`size-2 shrink-0 rounded-full ${statusColor[a.status]}`} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{a.status}</span>
              </span>
            </button>
          ))}
          <div className="mt-2 grid gap-2 border-t pt-3">
            <input
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none"
              placeholder="New agent name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none"
              placeholder="agent@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Button size="sm" onClick={addAgent}>
              Add agent
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Conversations</h2>
            {selectedAgent && (
              <select
                className="h-7 rounded-md border border-input bg-transparent text-xs"
                value={selectedAgent.status}
                onChange={(e) => changeStatus(e.target.value as Agent["status"])}
                aria-label="Agent status"
              >
                <option value="ONLINE">ONLINE</option>
                <option value="BUSY">BUSY</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            )}
          </div>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedConv(c)}
              className={`rounded-lg px-2 py-2 text-left text-sm hover:bg-muted ${
                selectedConv?.id === c.id ? "bg-muted" : ""
              }`}
            >
              <span className="block truncate font-mono text-xs">{c.id.slice(0, 8)}</span>
              <span className="text-xs text-muted-foreground">{c.status}</span>
            </button>
          ))}
          {selectedAgent && conversations.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">No conversations assigned.</p>
          )}
        </section>

        <section className="flex min-h-[400px] flex-col overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">
              {selectedConv ? `Chat ${selectedConv.id.slice(0, 8)} (${selectedConv.status})` : "Select a conversation"}
            </span>
            {selectedConv && selectedConv.status !== "CLOSED" && (
              <Button size="sm" variant="outline" onClick={closeConv}>
                Close
              </Button>
            )}
            {selectedConv && selectedConv.status === "CLOSED" && (
              <Button size="sm" variant="outline" onClick={reopenConv}>
                Reopen
              </Button>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.sender === "AGENT"
                    ? "self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "self-start rounded-lg bg-muted px-3 py-2 text-sm"
                }
              >
                {m.content}
              </div>
            ))}
          </div>
          {selectedConv && selectedConv.status !== "CLOSED" && (
            <div className="flex gap-2 border-t p-3">
              <input
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
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
          )}
        </section>
      </div>
    </div>
  );
}
