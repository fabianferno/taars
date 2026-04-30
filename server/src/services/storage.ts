import { ethers } from 'ethers';
import { env } from '../env.js';
import { encryptBlob, blobToBytes, type EncryptedBlob } from './encrypt.js';

export interface StorageBlobInput {
  description: string; // e.g. "soul.md", "skills.json", "voice.json"
  content: string | Buffer;
}

export interface IntelligentDataEntry {
  dataDescription: string;
  dataHash: `0x${string}`;
  storageRoot: string;
}

export interface UploadBundleResult {
  intelligentData: IntelligentDataEntry[];
  merkleRoot: `0x${string}`;
}

let _indexerCtor: any = null;
let _memDataCtor: any = null;

async function loadSdk() {
  if (_indexerCtor && _memDataCtor) return { Indexer: _indexerCtor, MemData: _memDataCtor };
  // Note: using @0gfoundation/0g-ts-sdk (1.2.x) — the newer @0glabs/0g-ts-sdk (0.3.x)
  // reverts on Galileo testnet's Flow contract for some submissions; the foundation
  // package is the working pattern from the reference project.
  const sdk: any = await import('@0gfoundation/0g-ts-sdk');
  _indexerCtor = sdk.Indexer;
  _memDataCtor = sdk.MemData;
  return { Indexer: _indexerCtor, MemData: _memDataCtor };
}

function ensureBytes32(hash: string): `0x${string}` {
  const h = hash.startsWith('0x') ? hash : `0x${hash}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(h)) {
    throw new Error(`Expected 32-byte hex, got: ${hash}`);
  }
  return h as `0x${string}`;
}

/// Encrypts each blob, uploads to 0G Storage, returns IntelligentData[] +
/// merkle root over all hashes. Format matches the reference project.
export async function uploadEncryptedBundleToZeroG(
  blobs: StorageBlobInput[]
): Promise<UploadBundleResult> {
  const { Indexer, MemData } = await loadSdk();
  const provider = new ethers.JsonRpcProvider(env.OG_RPC_URL);
  const signer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
  const indexer = new Indexer(env.OG_INDEXER_URL);

  const intelligentData: IntelligentDataEntry[] = [];

  for (const blob of blobs) {
    const encrypted: EncryptedBlob = encryptBlob(blob.content as Buffer | string, env.ENCRYPTION_KEY);
    const bytes = blobToBytes(encrypted);
    const memData = new MemData(bytes);

    const [tx, err] = await indexer.upload(memData, env.OG_RPC_URL, signer);
    if (err) throw err;

    const rootHashRaw: string =
      (tx && (tx.rootHash || tx.root || tx.hash)) ||
      (typeof tx === 'string' ? tx : '');
    if (!rootHashRaw) {
      throw new Error(`0G upload returned no rootHash for ${blob.description}`);
    }
    const rootHash = ensureBytes32(rootHashRaw);

    intelligentData.push({
      dataDescription: blob.description,
      dataHash: rootHash,
      storageRoot: rootHash,
    });
  }

  // Merkle root = keccak256(concat all dataHash bytes32). Matches reference.
  const packed = ethers.concat(intelligentData.map((d) => d.dataHash));
  const merkleRoot = ethers.keccak256(packed) as `0x${string}`;

  return { intelligentData, merkleRoot };
}
