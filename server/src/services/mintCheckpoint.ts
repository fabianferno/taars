import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Tiny per-mint checkpoint store on disk. Used by /mint/stream so that if a
 * pipeline fails partway (e.g. INFT broadcast but receipt poll timed out),
 * a retry with the same (ownerAddress, ensLabel) skips already-completed
 * steps and resumes where it left off.
 *
 * State is keyed by `${ownerLower}-${ensLabel}` and stored as JSON in
 * `process.env.TAARS_CHECKPOINT_DIR` (default `<server>/.mint-state`).
 */

export interface IntelligentDataRow {
  dataDescription: string;
  dataHash: `0x${string}`;
  storageRoot: string;
}

export interface MintCheckpoint {
  /** Stored for sanity-checking that the same request is being resumed. */
  ensLabel: string;
  ownerAddress: string;
  createdAt: number;
  updatedAt: number;
  voice?: {
    voiceId: string;
    provider: string;
    sampleRate: number;
  };
  storage?: {
    intelligentData: IntelligentDataRow[];
    storageRoot: string;
  };
  inft?: {
    tokenId: string;
    txHash: string;
  };
  ensSubname?: {
    txHash?: string;
  };
  ensRecords?: {
    txHash: string;
    recordCount: number;
  };
  ensTransfer?: {
    txHash?: string;
    alreadyOwned?: boolean;
  };
  /** Set to true once we emit the final 'done' event so we know a mint completed. */
  completed?: boolean;
}

function dir(): string {
  return process.env.TAARS_CHECKPOINT_DIR ?? path.resolve(process.cwd(), '.mint-state');
}

export function checkpointKey(ownerAddress: string, ensLabel: string): string {
  return `${ownerAddress.toLowerCase()}-${ensLabel.toLowerCase()}`;
}

function fileFor(key: string): string {
  // Key is already lowercase + hex/letters/digits/hyphens — safe as a filename.
  return path.join(dir(), `${key}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dir(), { recursive: true });
}

export async function loadCheckpoint(key: string): Promise<MintCheckpoint | null> {
  try {
    const raw = await fs.readFile(fileFor(key), 'utf8');
    return JSON.parse(raw) as MintCheckpoint;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveCheckpoint(
  key: string,
  patch: Partial<MintCheckpoint> & { ensLabel: string; ownerAddress: string }
): Promise<MintCheckpoint> {
  await ensureDir();
  const existing = (await loadCheckpoint(key)) ?? {
    ensLabel: patch.ensLabel,
    ownerAddress: patch.ownerAddress,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const merged: MintCheckpoint = {
    ...existing,
    ...patch,
    ensLabel: existing.ensLabel,
    ownerAddress: existing.ownerAddress,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  const tmp = `${fileFor(key)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(merged, null, 2));
  await fs.rename(tmp, fileFor(key));
  return merged;
}

export async function clearCheckpoint(key: string): Promise<void> {
  try {
    await fs.unlink(fileFor(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
