const BASE = "";

export type Conversation = {
  id: string;
  customerId: string;
  agentId: string | null;
  status: "OPEN" | "PENDING" | "CLOSED";
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type Agent = {
  id: string;
  name: string;
  email: string;
  status: "ONLINE" | "BUSY" | "OFFLINE";
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: "CUSTOMER" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  startConversation(customerName: string, customerEmail: string, initialMessage: string) {
    return fetch(`${BASE}/api/conversations/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName, customerEmail, initialMessage }),
    }).then(json<Conversation>);
  },
  history(conversationId: string) {
    return fetch(`${BASE}/api/conversations/${conversationId}/messages`).then(
      json<Message[]>
    );
  },
  send(conversationId: string, sender: Message["sender"], content: string) {
    return fetch(`${BASE}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, sender, content }),
    }).then(json<Message>);
  },
  agents() {
    return fetch(`${BASE}/api/agents`).then(json<Agent[]>);
  },
  createAgent(name: string, email: string) {
    return fetch(`${BASE}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    }).then(json<Agent>);
  },
  setAgentStatus(id: string, status: Agent["status"]) {
    return fetch(`${BASE}/api/agents/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(json<Agent>);
  },
  byAgent(agentId: string) {
    return fetch(`${BASE}/api/conversations/agent/${agentId}`).then(
      json<Conversation[]>
    );
  },
  closeConversation(id: string) {
    return fetch(`${BASE}/api/conversations/${id}/close`, {
      method: "PATCH",
    }).then(json<Conversation>);
  },
  reopenConversation(id: string) {
    return fetch(`${BASE}/api/conversations/${id}/reopen`, {
      method: "PATCH",
    }).then(json<Conversation>);
  },
  customerByEmail(email: string) {
    return fetch(`${BASE}/api/customers/by-email?email=${encodeURIComponent(email)}`).then(
      json<Customer>
    );
  },
  byCustomer(customerId: string) {
    return fetch(`${BASE}/api/conversations/customer/${customerId}`).then(
      json<Conversation[]>
    );
  },
  getConversation(id: string) {
    return fetch(`${BASE}/api/conversations/${id}`).then(json<Conversation>);
  },
  customer(id: string) {
    return fetch(`${BASE}/api/customers/${id}`).then(json<Customer>);
  },
};
