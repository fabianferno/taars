import type {
  MintRequest,
  MintResponse,
  MintErrorResponse,
  PersonalityAnswers,
} from '@taars/sdk';

export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:8080';

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
// Streaming /mint
// ---------------------------------------------------------------------------

export type MintStepKey =
  | 'voice'
  | 'encrypt'
  | 'storage'
  | 'inft'
  | 'ens.subname'
  | 'ens.records'
  | 'ens.transfer';

export type MintStreamEvent =
  | {
      type: 'step';
      step: MintStepKey;
      status: 'running' | 'done';
      label?: string;
      detail?: Record<string, unknown>;
    }
  | { type: 'done'; result: MintResponse }
  | { type: 'error'; step: MintStepKey | 'unknown'; error: string };

export async function mintReplicaStream(
  req: MintRequest,
  onEvent: (e: MintStreamEvent) => void,
  signal?: AbortSignal,
  opts?: { fresh?: boolean }
): Promise<MintResponse> {
  const url = `${SERVER_URL}/mint/stream${opts?.fresh ? '?fresh=1' : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`mint/stream failed: ${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: MintResponse | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let evt: MintStreamEvent;
      try {
        evt = JSON.parse(line) as MintStreamEvent;
      } catch {
        console.warn('[mintStream] bad JSON line', line);
        continue;
      }
      onEvent(evt);
      if (evt.type === 'done') final = evt.result;
      if (evt.type === 'error') throw new Error(`${evt.step}: ${evt.error}`);
    }
  }
  if (!final) throw new Error('mint/stream ended without a result');
  return final;
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
  /** Inference provider that produced this reply: 'zerog' | 'openai' | 'mock' */
  provider?: string;
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

export async function transcribeAudio(
  sessionId: string,
  audio: Blob,
  filename = 'audio.webm'
): Promise<string> {
  const form = new FormData();
  form.append('audio', audio, filename);
  const res = await fetch(`${SERVER_URL}/chat/transcribe`, {
    method: 'POST',
    headers: { 'X-Taars-Session': sessionId },
    body: form,
  });
  const j = (await jsonOrThrow<{ text: string }>(res, 'chat/transcribe'));
  return j.text ?? '';
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

// ---------------------------------------------------------------------------
// Discord deploy lifecycle
// ---------------------------------------------------------------------------

export interface DiscordDeployStartRequest {
  ensLabel: string;
  guildId: string;
  channelId: string;
  textChannelId: string;
  ownerAddress: `0x${string}`;
}

export interface DiscordDeployStartResponse {
  ok: boolean;
  deployId: string;
  txAuditId: string;
  status: 'pending' | 'active' | 'ended' | 'failed';
  ensLabel: string;
  ensFullName: string;
  voiceId: string;
  ratePerMinUsd: string;
  startedAt: number;
  sessionId: string;
}

export interface DiscordDeploySpeakResponse {
  ok: boolean;
  durationMs: number;
  voiceUsed?: string;
}

export interface DiscordDeployEndResponse {
  ok: boolean;
  deployId: string;
  deployedSeconds: number;
  ratePerMinUsd: string;
  expectedUsd: string;
  settlement: {
    settled: boolean;
    txHash?: string;
    expectedUsd?: string;
    reason?: string;
  };
}

export async function startDiscordDeploy(
  req: DiscordDeployStartRequest
): Promise<DiscordDeployStartResponse> {
  const res = await fetch(`${SERVER_URL}/deploy/discord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return jsonOrThrow<DiscordDeployStartResponse>(res, 'deploy/discord');
}

export async function speakDiscordDeploy(
  deployId: string,
  message: string
): Promise<DiscordDeploySpeakResponse> {
  const res = await fetch(`${SERVER_URL}/deploy/discord/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deployId, message }),
  });
  return jsonOrThrow<DiscordDeploySpeakResponse>(res, 'deploy/discord/speak');
}

export async function clearMintCheckpoint(
  owner: `0x${string}`,
  ensLabel: string
): Promise<void> {
  const url = new URL(`${SERVER_URL}/mint/checkpoint`);
  url.searchParams.set('owner', owner);
  url.searchParams.set('ensLabel', ensLabel);
  await fetch(url.toString(), { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Personality import (auto-fill from URL or pasted text)
// ---------------------------------------------------------------------------

export interface PersonalityImportRequest {
  source: 'url' | 'text';
  value: string;
}

export interface PersonalityImportResponse {
  ok: true;
  personality: PersonalityAnswers;
  provider?: string;
}

export async function importPersonality(
  req: PersonalityImportRequest
): Promise<PersonalityImportResponse> {
  const res = await fetch(`${SERVER_URL}/personality/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let err: { error?: string } = {};
    try {
      err = await res.json();
    } catch {
      // not JSON
    }
    throw new Error(err.error ?? `personality/import failed: ${res.status}`);
  }
  return res.json();
}

export async function endDiscordDeploy(
  deployId: string
): Promise<DiscordDeployEndResponse> {
  const res = await fetch(`${SERVER_URL}/deploy/discord/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deployId }),
  });
  return jsonOrThrow<DiscordDeployEndResponse>(res, 'deploy/discord/end');
}

export interface LlmStatus {
  zerog: { configured: boolean };
  openai: { configured: boolean };
  lastUsed: string | null;
  lastError: string | null;
}

export async function getLlmStatus(): Promise<LlmStatus> {
  const r = await fetch(`${SERVER_URL}/chat/llm-status`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'failed');
  return j.status as LlmStatus;
}
