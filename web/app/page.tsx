"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChatWidget } from "@/components/chat/ChatWidget";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex w-full items-center justify-between border-b bg-white px-6 py-4 dark:bg-black">
        <div className="text-lg font-semibold">Acme Support</div>
        <div className="flex items-center gap-2">
          <Link href="/agents" className={buttonVariants({ variant: "outline" })}>
            Agent dashboard
          </Link>
          <Button onClick={() => setChatOpen(true)}>
            <MessageCircle />
            Chat with us
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-6 py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          How can we help?
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Start a chat and we will connect you to an available agent.
          Returning customers continue where they left off.
        </p>
        <Button size="lg" onClick={() => setChatOpen(true)}>
          <MessageCircle />
          Open support chat
        </Button>
      </main>

      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
