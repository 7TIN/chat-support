"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleUserRound, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Agent, type Conversation, type Customer } from "@/lib/api";
import { AgentChatPopup } from "@/components/chat/AgentChatPopup";

const statusColor: Record<Agent["status"], string> = {
  ONLINE: "bg-emerald-500",
  BUSY: "bg-amber-500",
  OFFLINE: "bg-zinc-400",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const convStatusStyle: Record<Conversation["status"], string> = {
  OPEN: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  CLOSED: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
};

function StatusBadge({ status }: { status: Conversation["status"] }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${convStatusStyle[status]}`}>
      {status}
    </span>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convMeta, setConvMeta] = useState<Record<string, { name: string; preview: string }>>({});
  const [allConvs, setAllConvs] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [customerInfo, setCustomerInfo] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const refreshAgents = useCallback(async () => {
    const list = await api.agents();
    setAgents(list);
    setSelectedAgent((prev) => list.find((a) => a.id === prev?.id) ?? null);
  }, []);

  const enrichMeta = useCallback(async (list: Conversation[]) => {
    const entries = await Promise.all(
      list.map(async (c) => {
        try {
          const [cust, hist] = await Promise.all([
            api.customer(c.customerId),
            api.history(c.id),
          ]);
          const last = hist[hist.length - 1];
          return [
            c.id,
            {
              name: `${cust.name} · ${cust.email}`,
              preview: last
                ? `${last.sender === "AGENT" ? "You" : cust.name}: ${last.content}`
                : "No messages yet",
            },
          ] as const;
        } catch {
          return [c.id, { name: c.customerId.slice(0, 8), preview: "" }] as const;
        }
      })
    );
    return Object.fromEntries(entries) as Record<string, { name: string; preview: string }>;
  }, []);

  const refreshConvs = useCallback(
    async (agentId: string) => {
      const list = await api.byAgent(agentId);
      setConversations(list);
      setSelectedConv((prev) => list.find((c) => c.id === prev?.id) ?? null);
      const meta = await enrichMeta(list);
      setConvMeta((prev) => ({ ...prev, ...meta }));
    },
    [enrichMeta]
  );

  const refreshAll = useCallback(async () => {
    const list = await api.allConversations();
    setAllConvs(list);
    const meta = await enrichMeta(list);
    setConvMeta((prev) => ({ ...prev, ...meta }));
  }, [enrichMeta]);

  useEffect(() => {
    refreshAgents().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    refreshAll().catch(() => {});
  }, [refreshAgents, refreshAll]);

  // Pick up new/changed conversations without a reload.
  useEffect(() => {
    const t = setInterval(() => {
      refreshAgents().catch(() => {});
      refreshAll().catch(() => {});
      if (selectedAgent) refreshConvs(selectedAgent.id).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [selectedAgent, refreshAgents, refreshConvs, refreshAll]);

  useEffect(() => {
    if (!selectedConv) {
      setCustomerInfo(null);
      return;
    }
    let stop = false;
    api
      .customer(selectedConv.customerId)
      .then((c) => {
        if (!stop) setCustomerInfo(c);
      })
      .catch(() => {
        if (!stop) setCustomerInfo(null);
      });
    return () => {
      stop = true;
    };
  }, [selectedConv]);

  function selectAgent(agent: Agent) {
    if (selectedAgent?.id === agent.id) {
      setSelectedAgent(null);
      setConversations([]);
      setSelectedConv(null);
      return;
    }
    setSelectedAgent(agent);
    setSelectedConv(null);
    refreshConvs(agent.id).catch(() => {});
  }

  async function changeStatus(status: Agent["status"]) {
    if (!selectedAgent) return;
    const updated = await api.setAgentStatus(selectedAgent.id, status);
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAgent(updated);
    await Promise.all([refreshConvs(updated.id), refreshAll()]);
  }

  async function join(id: string) {
    if (!selectedAgent) {
      setError("Select an agent card first, then join a conversation.");
      return;
    }
    setError(null);
    await api.reassign(id, selectedAgent.id);
    await Promise.all([refreshConvs(selectedAgent.id), refreshAll()]);
  }

  async function addAgent() {
    if (!newName.trim() || !newEmail.trim()) return;
    setError(null);
    try {
      await api.createAgent(newName.trim(), newEmail.trim());
      setNewName("");
      setNewEmail("");
      setShowAddForm(false);
      await refreshAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add agent.");
    }
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

      <div className="flex flex-1 flex-col gap-6 p-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Agents</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => selectAgent(a)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center hover:bg-muted ${
                  selectedAgent?.id === a.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <span className="relative">
                  <CircleUserRound className="size-10 text-muted-foreground" strokeWidth={1} />
                  <span
                    className={`absolute bottom-1 right-1 size-3 rounded-full border-2 border-background ${statusColor[a.status]}`}
                  />
                </span>
                <span className="w-full">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{a.email}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{a.status}</span>
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex min-h-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-muted-foreground hover:bg-muted"
            >
              {showAddForm ? <X className="size-6" /> : <Plus className="size-6" />}
              <span className="text-xs font-medium">Add agent</span>
            </button>
          </div>
          {showAddForm && (
            <div className="mt-4 flex max-w-md flex-col gap-2 rounded-xl border p-4">
              <input
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                placeholder="Agent name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                placeholder="agent@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Button size="sm" onClick={addAgent}>
                Save agent
              </Button>
            </div>
          )}
        </section>

        {selectedAgent && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {selectedAgent.name}&apos;s conversations ({conversations.length})
              </h2>
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                value={selectedAgent.status}
                onChange={(e) => changeStatus(e.target.value as Agent["status"])}
                aria-label="Agent status"
              >
                <option value="ONLINE">ONLINE</option>
                <option value="BUSY">BUSY</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversations assigned.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {conversations.map((c) => {
                  const meta = convMeta[c.id];
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConv(c)}
                      className={`flex flex-col gap-1 rounded-xl border p-3 text-left hover:bg-muted ${
                        selectedConv?.id === c.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {meta?.name ?? "Loading..."}
                        </span>
                        <StatusBadge status={c.status} />
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {meta?.preview ?? "Loading..."}
                      </span>
                      <span className="text-xs text-muted-foreground">{fmt(c.updatedAt)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold">
            All conversations ({allConvs.length})
          </h2>
          {allConvs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {allConvs.map((c) => {
                const meta = convMeta[c.id];
                const owner = c.agentId ? agents.find((a) => a.id === c.agentId) : null;
                const mine = selectedConv?.id === c.id;
                const joined = selectedAgent?.id === c.agentId;
                return (
                  <div
                    key={c.id}
                    className={`flex flex-col gap-1 rounded-xl border p-3 ${
                      mine ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {meta?.name ?? "Loading..."}
                      </span>
                      <StatusBadge status={c.status} />
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {meta?.preview ?? "Loading..."}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {owner ? `With ${owner.name}` : "Unassigned"} · {fmt(c.updatedAt)}
                    </span>
                    <span className="mt-1 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedConv(c)}>
                        Open
                      </Button>
                      {!joined && c.status !== "CLOSED" && (
                        <Button size="sm" onClick={() => join(c.id)}>
                          Join
                        </Button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {selectedConv && (
          <AgentChatPopup
            key={selectedConv.id}
            conversation={selectedConv}
            customer={customerInfo}
            onClose={() => setSelectedConv(null)}
            onStatusChange={(updated) => {
              setSelectedConv(updated);
              setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
              setAllConvs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            }}
            onRefreshList={() => {
              refreshAll().catch(() => {});
              if (selectedAgent) refreshConvs(selectedAgent.id).catch(() => {});
            }}
          />
        )}
      </div>
    </div>
  );
}
