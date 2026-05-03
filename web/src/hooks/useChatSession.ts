'use client';
import { useCallback, useRef, useState } from 'react';
import {
  startChat,
  sendMessage as sendApiMessage,
  endChat as endApiChat,
  type ChatStartResponse,
  type ChatEndResponse,
  type ChatMessageResponse,
} from '@/lib/api';

export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  audioBase64?: string;
  audioMime?: string;
  /** Inference provider for assistant messages */
  provider?: string;
  createdAt: number;
}

export interface ActiveSession {
  sessionId: string;
  startedAt: number;
  ratePerMinUsd: string;
  voiceId: string;
  ensFullName: string;
  billingTerms: ChatStartResponse['billingTerms'];
}

let _idSeed = 0;
function nextId(prefix = 'm') {
  _idSeed += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idSeed}`;
}

export interface UseChatSessionResult {
  session: ActiveSession | null;
  messages: ChatMessage[];
  starting: boolean;
  sending: boolean;
  ending: boolean;
  error: string | null;
  receipt: ChatEndResponse | null;
  start: (callerAddress: `0x${string}`) => Promise<ActiveSession | null>;
  send: (message: string) => Promise<ChatMessageResponse | null>;
  end: () => Promise<ChatEndResponse | null>;
  clearReceipt: () => void;
}

export function useChatSession(ensLabel: string): UseChatSessionResult {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ChatEndResponse | null>(null);

  // Hold the latest sessionId in a ref so async callers can never race against
  // a stale state read between start() and the first send().
  const sessionRef = useRef<ActiveSession | null>(null);

  const start = useCallback(
    async (callerAddress: `0x${string}`): Promise<ActiveSession | null> => {
      setStarting(true);
      setError(null);
      setReceipt(null);
      try {
        const res = await startChat({ ensLabel, callerAddress });
        const next: ActiveSession = {
          sessionId: res.sessionId,
          startedAt: Date.now(),
          ratePerMinUsd: res.ratePerMinUsd,
          voiceId: res.voiceId,
          ensFullName: res.ensFullName,
          billingTerms: res.billingTerms,
        };
        sessionRef.current = next;
        setSession(next);
        setMessages([
          {
            id: nextId('sys'),
            role: 'system',
            text: `Session started with ${res.ensFullName}. Per-minute rate: $${res.ratePerMinUsd}.`,
            createdAt: Date.now(),
          },
        ]);
        return next;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'failed to start session';
        setError(msg);
        return null;
      } finally {
        setStarting(false);
      }
    },
    [ensLabel]
  );

  const send = useCallback(
    async (message: string): Promise<ChatMessageResponse | null> => {
      const active = sessionRef.current;
      if (!active) {
        setError('no active session');
        return null;
      }
      const userMsg: ChatMessage = {
        id: nextId('u'),
        role: 'user',
        text: message,
        createdAt: Date.now(),
      };
      setMessages((m) => [...m, userMsg]);
      setSending(true);
      setError(null);
      try {
        const res = await sendApiMessage(active.sessionId, message);
        const aMsg: ChatMessage = {
          id: nextId('a'),
          role: 'assistant',
          text: res.text,
          audioBase64: res.audioBase64,
          audioMime: res.audioMime,
          provider: res.provider,
          createdAt: Date.now(),
        };
        setMessages((m) => [...m, aMsg]);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'failed to send message';
        setError(msg);
        setMessages((m) => [
          ...m,
          {
            id: nextId('err'),
            role: 'system',
            text: `Error: ${msg}`,
            createdAt: Date.now(),
          },
        ]);
        return null;
      } finally {
        setSending(false);
      }
    },
    []
  );

  const end = useCallback(async (): Promise<ChatEndResponse | null> => {
    const active = sessionRef.current;
    if (!active) return null;
    setEnding(true);
    setError(null);
    try {
      const res = await endApiChat(active.sessionId);
      setReceipt(res);
      sessionRef.current = null;
      setSession(null);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'failed to end session';
      setError(msg);
      return null;
    } finally {
      setEnding(false);
    }
  }, []);

  const clearReceipt = useCallback(() => {
    setReceipt(null);
    setMessages([]);
  }, []);

  return {
    session,
    messages,
    starting,
    sending,
    ending,
    error,
    receipt,
    start,
    send,
    end,
    clearReceipt,
  };
}
