import type { MintRequest, MintResponse, MintErrorResponse } from '@taars/sdk';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:8080';

export async function mintReplica(req: MintRequest): Promise<MintResponse> {
  const res = await fetch(`${SERVER_URL}/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let err: MintErrorResponse | { error?: string } = {};
    try {
      err = await res.json();
    } catch {
      // not JSON
    }
    const msg =
      'step' in err && 'error' in err
        ? `mint failed at ${err.step}: ${err.error}`
        : `mint failed: ${res.status} ${(err as { error?: string }).error ?? res.statusText}`;
    throw new Error(msg);
  }
  return res.json();
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Chat APIs
// ---------------------------------------------------------------------------

export interface ChatStartRequest {
  ensLabel: string;
  callerAddress: `0x${string}`;
}

export interface BillingTerms {
  billingContract?: `0x${string}` | '';
  usdcAddress?: `0x${string}` | '';
  tokenId?: string;
  ratePerMinAtomic?: string;
  decimals?: number;
  mock?: boolean;
}

export interface ChatStartResponse {
  sessionId: string;
  ratePerMinUsd: string;
  voiceId: string;
  ensFullName: string;
  billingTerms: BillingTerms;
  mockLLM?: boolean;
}

export interface ChatMessageRequest {
  sessionId: string;
  message: string;
}

export interface ChatMessageResponse {
  text: string;
  audioBase64?: string;
  audioMime?: string;
  sessionId: string;
  mockLLM?: boolean;
}

export interface ChatEndResponse {
  durationSeconds: number;
  ratePerMinUsd: string;
  expectedUsd: string;
  sessionId: string;
  settled: boolean;
  txHash?: string;
}

export interface ChatSessionInfo {
  sessionId: string;
  ensLabel: string;
  ensFullName: string;
  callerAddress: `0x${string}`;
  ratePerMinUsd: string;
  startedAt: number;
  endedAt?: number;
  settled?: boolean;
  voiceId?: string;
}

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let err: { error?: string } = {};
    try {
      err = await res.json();
    } catch {
      // not JSON
    }
    throw new Error(`${label} failed: ${res.status} ${err.error ?? res.statusText}`);
  }
  return res.json();
}

export async function startChat(req: ChatStartRequest): Promise<ChatStartResponse> {
  const res = await fetch(`${SERVER_URL}/chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return jsonOrThrow<ChatStartResponse>(res, 'chat/start');
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<ChatMessageResponse> {
  const res = await fetch(`${SERVER_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Taars-Session': sessionId,
    },
    body: JSON.stringify({ sessionId, message }),
  });
  return jsonOrThrow<ChatMessageResponse>(res, 'chat/message');
}

export async function endChat(sessionId: string): Promise<ChatEndResponse> {
  const res = await fetch(`${SERVER_URL}/chat/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Taars-Session': sessionId,
    },
    body: JSON.stringify({ sessionId }),
  });
  return jsonOrThrow<ChatEndResponse>(res, 'chat/end');
}

export async function getSession(sessionId: string): Promise<ChatSessionInfo> {
  const res = await fetch(`${SERVER_URL}/chat/session/${encodeURIComponent(sessionId)}`);
  return jsonOrThrow<ChatSessionInfo>(res, 'chat/session');
}
