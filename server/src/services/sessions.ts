import { randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { readAllTexts } from './ens.js';
import { fetchAndDecrypt } from './decrypt.js';
import type { ChatMessage } from './llm.js';

export type { ChatMessage };

export interface ChatSession {
  sessionId: `0x${string}`;
  ensLabel: string;
  ensFullName: string;
  callerAddress: `0x${string}`;
  startedAt: number; // unix seconds
  endedAt?: number;
  ratePerMinUsd: string;
  messages: ChatMessage[];
  systemPrompt: string;
  voiceId: string;
}

export interface StartSessionOpts {
  ensLabel: string;
  callerAddress: string;
}

const sessions = new Map<string, ChatSession>();

// Hooks for tests: allow stubbing the ENS / storage round trip.
export interface SessionHooks {
  readEnsRecords?: (fullName: string) => Promise<Record<string, string>>;
  fetchSoulBundle?: (storageRoot: string) => Promise<{
    voice?: { voiceId?: string };
    personality?: Record<string, string>;
    createdAt?: number;
    version?: string;
  }>;
}

let hooks: SessionHooks = {};

export function _setSessionHooks(h: SessionHooks): void {
  hooks = h;
}

export function _resetSessions(): void {
  sessions.clear();
  hooks = {};
}

const ENS_KEYS = ['taars.storage', 'taars.voice', 'taars.price', 'taars.version'] as const;

async function defaultReadEnsRecords(fullName: string): Promise<Record<string, string>> {
  return readAllTexts(fullName, ENS_KEYS as unknown as string[]);
}

async function defaultFetchSoulBundle(storageRoot: string): Promise<any> {
  // Storage root from /mint is the merkle root over multiple blobs; the
  // soul.md blob's own root is the first IntelligentData entry. For chat,
  // the convention is to encode soul as the bundle's own root: in /mint we
  // store individual blobs and use the merkle root as the "taars.storage"
  // text record. So we can't directly download the merkle root.
  // Hackathon shortcut: the merkle root in the current /mint flow IS NOT
  // downloadable. So if the read returns a JSON-shaped bundle treat it
  // accordingly; if not, surface a helpful error.
  const buf = await fetchAndDecrypt(storageRoot);
  const text = buf.toString('utf8');
  // soul.md is markdown, not JSON. Wrap it in a minimal bundle shape.
  if (text.trimStart().startsWith('{')) {
    return JSON.parse(text);
  }
  return {
    soul: text,
    voice: {},
    personality: parsePersonalityFromSoul(text),
    version: 'taars-v1',
  };
}

function parsePersonalityFromSoul(soul: string): Record<string, string> {
  const grab = (heading: string): string => {
    const re = new RegExp(`##\\s+${heading}\\s*\\n([^#]*)`, 'i');
    const m = soul.match(re);
    return m ? m[1].trim() : '';
  };
  return {
    vibe: grab('vibe'),
    expertise: grab('expertise'),
    catchphrases: grab('phrases I use'),
    avoid: grab('topics I avoid'),
  };
}

function buildSystemPrompt(ensLabel: string, soulOrPersonality: any): string {
  // If the bundle gave us the raw soul text, prefer it as-is wrapped in instructions.
  if (typeof soulOrPersonality?.soul === 'string' && soulOrPersonality.soul.length > 20) {
    return `You are the taars replica known as ${ensLabel}.${env.PARENT_ENS_NAME}. Stay in character. Keep replies under 120 words. The persona is defined below.\n\n${soulOrPersonality.soul}`;
  }
  const p = soulOrPersonality?.personality ?? {};
  const lines = [
    `You are ${ensLabel}.${env.PARENT_ENS_NAME}, a taars AI replica. Stay in character.`,
    `Vibe: ${p.vibe ?? 'warm and grounded'}.`,
    `Expertise: ${p.expertise ?? 'general topics'}.`,
    p.catchphrases ? `Use these phrases naturally: ${p.catchphrases}.` : '',
    p.avoid ? `Avoid these topics: ${p.avoid}.` : '',
    'Always identify as an AI replica created on taars, not the real person.',
    'Do not give financial, legal, or medical advice. Keep replies under 120 words.',
  ].filter(Boolean);
  return lines.join('\n');
}

export async function startSession(opts: StartSessionOpts): Promise<ChatSession> {
  const ensLabel = opts.ensLabel;
  const ensFullName = `${ensLabel}.${env.PARENT_ENS_NAME}`;
  const reader = hooks.readEnsRecords ?? defaultReadEnsRecords;
  const fetcher = hooks.fetchSoulBundle ?? defaultFetchSoulBundle;

  const records = await reader(ensFullName);
  const storageRoot = records['taars.storage'] || '';
  const voiceId = records['taars.voice'] || ensLabel;
  const ratePerMinUsd = records['taars.price'] || '0';

  let bundle: any = { personality: {}, voice: { voiceId } };
  if (storageRoot) {
    try {
      bundle = await fetcher(storageRoot);
    } catch (e) {
      console.warn(`[sessions] could not fetch soul bundle for ${ensFullName}: ${(e as Error).message}`);
      bundle = { personality: {}, voice: { voiceId } };
    }
  } else {
    console.warn(`[sessions] ${ensFullName} has no taars.storage record; using empty persona`);
  }

  const systemPrompt = buildSystemPrompt(ensLabel, bundle);
  const sessionId = (`0x${randomBytes(32).toString('hex')}`) as `0x${string}`;

  const session: ChatSession = {
    sessionId,
    ensLabel,
    ensFullName,
    callerAddress: opts.callerAddress as `0x${string}`,
    startedAt: Math.floor(Date.now() / 1000),
    ratePerMinUsd,
    messages: [],
    systemPrompt,
    voiceId: bundle?.voice?.voiceId || voiceId,
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): ChatSession | null {
  return sessions.get(sessionId) ?? null;
}

export function endSession(sessionId: string): ChatSession | null {
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (!s.endedAt) s.endedAt = Math.floor(Date.now() / 1000);
  return s;
}

export function appendMessage(sessionId: string, msg: ChatMessage): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.messages.push(msg);
}

export function _allSessions(): ChatSession[] {
  return Array.from(sessions.values());
}
