import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const INDEX_DIR = path.resolve(process.cwd(), 'server', '.audit');
const INDEX_FILE = path.join(INDEX_DIR, 'agents-index.jsonl');

function resolveFile(): string {
  // Resolve relative to server dir whether cwd is repo root or server/.
  const cwdName = path.basename(process.cwd());
  const dir = cwdName === 'server' ? path.resolve(process.cwd(), '.audit') : INDEX_DIR;
  return path.join(dir, 'agents-index.jsonl');
}

void INDEX_FILE;

export interface AgentIndexEntry {
  tokenId: string;
  ensLabel: string;
  ownerAddress: string;
  mintedAt: number;
}

export async function appendAgent(entry: AgentIndexEntry): Promise<void> {
  const file = resolveFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(entry) + '\n', 'utf8');
}

export async function readIndex(): Promise<AgentIndexEntry[]> {
  const file = resolveFile();
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return [];
  }
  const out: AgentIndexEntry[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as AgentIndexEntry);
    } catch {
      // skip malformed lines
    }
  }
  // dedupe by tokenId, last write wins
  const map = new Map<string, AgentIndexEntry>();
  for (const e of out) map.set(e.tokenId, e);
  return [...map.values()];
}
