const BASE = "";

export type Conversation = {
  id: string;
  customerId: string;
  agentId: string | null;
  status: "OPEN" | "PENDING" | "CLOSED";
  createdAt: string;
  updatedAt: string;
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
};
