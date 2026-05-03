import { readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentRecord } from '@taars/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '..', 'data', 'agents.json');

let _cache: { mtimeMs: number; data: AgentRecord[] } | null = null;

export async function listAgents(): Promise<AgentRecord[]> {
  const s = await stat(DATA_PATH);
  if (_cache && _cache.mtimeMs === s.mtimeMs) return _cache.data;
  const raw = await readFile(DATA_PATH, 'utf8');
  const data = JSON.parse(raw) as AgentRecord[];
  _cache = { mtimeMs: s.mtimeMs, data };
  return data;
}

export async function getAgentByEnsLabel(label: string): Promise<AgentRecord | null> {
  const all = await listAgents();
  return all.find((a) => a.ens.replace('.taars.eth', '') === label) ?? null;
}
