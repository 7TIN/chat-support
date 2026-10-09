"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Agent, type Conversation, type Customer, type Message } from "@/lib/api";

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.agents(), api.customers(), api.allConversations()])
      .then(([a, c, v]) => {
        setAgents(a);
        setCustomers(c);
        setConvs(v);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    api.history(selectedId).then(setMessages).catch(() => {});
  }, [selectedId]);

  const agentById = (id: string | null) => agents.find((a) => a.id === id);
  const customerById = (id: string) => customers.find((c) => c.id === id);
  const selected = convs.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Support Chat
        </Link>
        <span className="text-sm text-muted-foreground">Admin (hidden)</span>
      </header>

      {error && <p className="px-6 pt-4 text-sm text-destructive">{error}</p>}

      <div className="flex flex-1 flex-col gap-6 p-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Agents ({agents.length}) — sign in on /agents with the email</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Since</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.email}</td>
                    <td className="px-3 py-2">{a.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmt(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Customers ({customers.length}) — chat sign-in uses the email</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Since</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmt(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">All conversations ({convs.length})</h2>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              {convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`rounded-xl border p-3 text-left text-sm hover:bg-muted ${
                    selectedId === c.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {customerById(c.customerId)?.name ?? c.customerId.slice(0, 8)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.status}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {customerById(c.customerId)?.email ?? ""} ·{" "}
                    {c.agentId ? `with ${agentById(c.agentId)?.name ?? c.agentId.slice(0, 8)}` : "unassigned"}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmt(c.updatedAt)}</span>
                </button>
              ))}
              {convs.length === 0 && (
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              )}
            </div>
            <div className="flex min-h-[300px] flex-col rounded-xl border">
              <div className="border-b px-4 py-3 text-sm font-semibold">
                {selected
                  ? `${customerById(selected.customerId)?.name ?? "Chat"} · ${selected.status}`
                  : "Select a conversation to read"}
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
                      {m.sender} · {fmt(m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
