import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomBytes } from 'node:crypto';
import { decryptBlob, type EncryptedBlob } from './encrypt.js';
import { env } from '../env.js';

let _indexerCtor: any = null;

async function loadIndexer() {
  if (_indexerCtor) return _indexerCtor;
  const sdk: any = await import('@0gfoundation/0g-ts-sdk');
  _indexerCtor = sdk.Indexer;
  return _indexerCtor;
}

/// Fetches an encrypted blob (JSON {iv, ciphertext, authTag}) from 0G Storage
/// by rootHash, decrypts it with the server's ENCRYPTION_KEY, and returns
/// the plaintext as a Buffer.
export async function fetchAndDecrypt(rootHash: string): Promise<Buffer> {
  const Indexer = await loadIndexer();
  const indexer = new Indexer(env.OG_INDEXER_URL);

  const tmpDir = os.tmpdir();
  const tmpName = `taars-${randomBytes(8).toString('hex')}`;
  const tmpPath = path.join(tmpDir, tmpName);

  try {
    const root = rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`;
    const err = await indexer.download(root, tmpPath, false);
    if (err) {
      // download() returns an error object on failure (per SDK convention).
      throw new Error(
        `0G download failed for ${rootHash}: ${typeof err === 'string' ? err : (err.message ?? JSON.stringify(err))}`
      );
    }

    const raw = await fs.readFile(tmpPath, 'utf8');
    let blob: EncryptedBlob;
    try {
      blob = JSON.parse(raw) as EncryptedBlob;
    } catch (e) {
      throw new Error(`fetchAndDecrypt: downloaded file is not valid JSON: ${(e as Error).message}`);
    }
    if (!blob.iv || !blob.ciphertext || !blob.authTag) {
      throw new Error('fetchAndDecrypt: downloaded JSON missing iv/ciphertext/authTag');
    }
    return decryptBlob(blob, env.ENCRYPTION_KEY);
  } finally {
    // best-effort cleanup
    try {
      await fs.unlink(tmpPath);
    } catch {
      // ignore
    }
  }
}
