'use client';
import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '@/hooks/useChatSession';

export function MessageList({
  messages,
  sending,
}: {
  messages: ChatMessage[];
  sending?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  return (
    <div
      ref={ref}
      className="flex h-[420px] flex-col gap-3 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950/40 p-3"
    >
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-neutral-500">
          Send a message to begin.
        </div>
      ) : (
        messages.map((m) => <MessageBubble key={m.id} message={m} />)
      )}
      {sending && (
        <div className="px-1 text-xs text-neutral-500">replica is thinking…</div>
      )}
    </div>
  );
}
