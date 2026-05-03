import { createHash } from 'node:crypto';
import { env } from '../env.js';
import type { AgentRecord } from '@taars/sdk';
import { readIndex } from './agentsIndex.js';
import { tryGetInftOwnerOnZeroG } from './inft.js';
import { readAllTexts } from './ens.js';

const ENS_TEXT_KEYS = [
  'taars.inft',
  'taars.storage',
  'taars.price',
  'taars.voice',
  'taars.owner',
  'description',
  'avatar',
] as const;

const GRADIENTS = [
  'from-orange-700 to-orange-950',
  'from-indigo-500 to-purple-800',
  'from-emerald-500 to-teal-800',
  'from-violet-500 to-fuchsia-800',
  'from-sky-500 to-blue-800',
  'from-yellow-600 to-amber-900',
  'from-red-500 to-red-800',
  'from-teal-500 to-cyan-800',
];

function pickGradient(seed: string): string {
  const h = createHash('sha256').update(seed).digest();
  return GRADIENTS[h[0] % GRADIENTS.length];
}

function titleCase(label: string): string {
  return label
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

let _cache: { ts: number; data: AgentRecord[] } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadFromChain(): Promise<AgentRecord[]> {
  const entries = await readIndex();
  const settled = await Promise.all(
    entries.map(async (entry, i): Promise<AgentRecord | null> => {
      const tokenIdBig = BigInt(entry.tokenId);
      const owner = await tryGetInftOwnerOnZeroG(tokenIdBig);
      if (!owner) return null; // burned / nonexistent

      const fullName = `${entry.ensLabel}.${env.PARENT_ENS_NAME}`;
      let records: Record<string, string> = {};
      try {
        records = await readAllTexts(fullName, ENS_TEXT_KEYS as unknown as string[]);
      } catch (e) {
        console.warn(`[agents] readAllTexts failed for ${fullName}:`, (e as Error).message.slice(0, 100));
      }

      const name = titleCase(entry.ensLabel);
      const initials = name
        .split(' ')
        .map((w) => w.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        tokenId: entry.tokenId,
        ens: fullName,
        ensLabel: entry.ensLabel,
        mintedAt: entry.mintedAt,
        owner,
        pricePerMinUsd: records['taars.price'] || '0',
        description: records['description'] || '',
        avatar: records['avatar'] || '',
        voiceId: records['taars.voice'] || '',
        storageRoot: records['taars.storage'] || '',
        name,
        initials: initials || name.slice(0, 2).toUpperCase(),
        gradient: pickGradient(entry.ensLabel),
        verification: 'self',
        featured: i < 4, // first 4 mints by index order
      };
    })
  );
  return settled.filter((a): a is AgentRecord => a !== null);
}

export async function listAgents(): Promise<AgentRecord[]> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) return _cache.data;
  const data = await loadFromChain();
  _cache = { ts: Date.now(), data };
  return data;
}

export async function getAgentByEnsLabel(label: string): Promise<AgentRecord | null> {
  const all = await listAgents();
  return all.find((a) => a.ensLabel === label) ?? null;
}

export function _invalidateAgentsCache(): void {
  _cache = null;
}
