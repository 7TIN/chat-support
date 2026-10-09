"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Agent, type Conversation, type Customer } from "@/lib/api";
import { AgentChatPopup } from "@/components/chat/AgentChatPopup";

const SESSION_KEY = "support-agent";

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

function loadSession(): Agent | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Agent) : null;
  } catch {
    return null;
  }
}

export default function AgentsPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"login" | "create">("login");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convMeta, setConvMeta] = useState<Record<string, { name: string; preview: string }>>({});
  const [unassigned, setUnassigned] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [customerInfo, setCustomerInfo] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const refreshMine = useCallback(
    async (agentId: string) => {
      const list = await api.byAgent(agentId);
      setConversations(list);
      setSelectedConv((prev) => list.find((c) => c.id === prev?.id) ?? null);
      const meta = await enrichMeta(list);
      setConvMeta((prev) => ({ ...prev, ...meta }));
    },
    [enrichMeta]
  );

  const refreshUnassigned = useCallback(async () => {
    const list = await api.pending();
    setUnassigned(list);
    const meta = await enrichMeta(list);
    setConvMeta((prev) => ({ ...prev, ...meta }));
  }, [enrichMeta]);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setAgent(session);
      refreshMine(session.id).catch(() => {});
    }
    refreshUnassigned().catch(() => {});
  }, [refreshMine, refreshUnassigned]);

  useEffect(() => {
    if (!agent) return;
    const t = setInterval(() => {
      refreshMine(agent.id).catch(() => {});
      refreshUnassigned().catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [agent, refreshMine, refreshUnassigned]);

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

  async function signIn() {
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const found = await api.agentByEmail(email.trim());
      setAgent(found);
      localStorage.setItem(SESSION_KEY, JSON.stringify(found));
      setSelectedConv(null);
      await refreshMine(found.id);
    } catch {
      setError("No agent found with that email. Create an account below.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    if (!newName.trim() || !newEmail.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const created = await api.createAgent(newName.trim(), newEmail.trim());
      setAgent(created);
      localStorage.setItem(SESSION_KEY, JSON.stringify(created));
      setNewName("");
      setNewEmail("");
      setMode("login");
      setEmail(newEmail.trim());
      setSelectedConv(null);
      await refreshMine(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setAgent(null);
    setConversations([]);
    setSelectedConv(null);
    setEmail("");
    setError(null);
  }

  async function changeStatus(status: Agent["status"]) {
    if (!agent) return;
    const updated = await api.setAgentStatus(agent.id, status);
    setAgent(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    await Promise.all([refreshMine(updated.id), refreshUnassigned()]);
  }

  async function join(id: string) {
    if (!agent) return;
    setError(null);
    const joined = await api.reassign(id, agent.id);
    await Promise.all([refreshMine(agent.id), refreshUnassigned()]);
    setSelectedConv(joined);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Support Chat
        </Link>
        {agent ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">{agent.name}</span>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              value={agent.status}
              onChange={(e) => changeStatus(e.target.value as Agent["status"])}
              aria-label="Availability"
            >
              <option value="ONLINE">ONLINE</option>
              <option value="BUSY">BUSY</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>
            <Button size="sm" variant="outline" onClick={logout}>
              <LogOut /> Logout
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Agent sign in</span>
        )}
      </header>

      {error && <p className="px-6 pt-4 text-sm text-destructive">{error}</p>}

      {!agent ? (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-6">
          {mode === "login" ? (
            <>
              <h1 className="text-xl font-semibold">Agent sign in</h1>
              <label className="grid gap-1 text-sm">
                Work email
                <input
                  className="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:border-ring"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") signIn();
                  }}
                  placeholder="agent@example.com"
                />
              </label>
              <Button onClick={signIn} disabled={busy}>
                {busy ? "Signing in..." : "Continue"}
              </Button>
              <button
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setError(null);
                  setMode("create");
                }}
              >
                New here? Create agent account
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Create agent account</h1>
              <label className="grid gap-1 text-sm">
                Full name
                <input
                  className="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:border-ring"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Work email
                <input
                  className="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:border-ring"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="agent@example.com"
                />
              </label>
              <Button onClick={createAccount} disabled={busy}>
                {busy ? "Creating..." : "Create account"}
              </Button>
              <button
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setError(null);
                  setMode("login");
                }}
              >
                Already have an account? Log in
              </button>
            </>
          )}
        </main>
      ) : (
        <div className="flex flex-1 flex-col gap-6 p-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">
              My conversations ({conversations.length})
            </h2>
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

          <section>
            <h2 className="mb-3 text-sm font-semibold">
              Waiting for an agent ({unassigned.length})
            </h2>
            {unassigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unassigned conversations.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unassigned.map((c) => {
                  const meta = convMeta[c.id];
                  const mine = selectedConv?.id === c.id;
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
                      <span className="text-xs text-muted-foreground">Unassigned · {fmt(c.updatedAt)}</span>
                      <span className="mt-1 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedConv(c)}>
                          Open
                        </Button>
                        <Button size="sm" onClick={() => join(c.id)}>
                          Join
                        </Button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {selectedConv && (
        <AgentChatPopup
          key={selectedConv.id}
          conversation={selectedConv}
          customer={customerInfo}
          onClose={() => setSelectedConv(null)}
          onStatusChange={(updated) => {
            setSelectedConv(updated);
            setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setUnassigned((prev) => prev.filter((c) => c.id !== updated.id));
          }}
          onRefreshList={() => {
            refreshUnassigned().catch(() => {});
            if (agent) refreshMine(agent.id).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
