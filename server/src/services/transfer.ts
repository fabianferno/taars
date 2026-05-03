import * as fs from 'node:fs';
import * as path from 'node:path';
import { ethers } from 'ethers';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { encryptBlob, blobToBytes } from './encrypt.js';
import { fetchAndDecrypt } from './decrypt.js';
import { setText, readText } from './ens.js';
import { env } from '../env.js';
import { fireKeeperhubWorkflow, KH_WORKFLOWS } from './keeperhub.js';

/**
 * INFT transfer orchestration. Multi-step ERC-7857 flow with retry + audit.
 *
 * In production this is what KeeperHub MCP guarantees: every step is reliable, the
 * whole sequence is atomic-or-rolled-back, and the audit trail is on-chain.
 *
 * Hackathon scope:
 *  - The platform owns the INFT (deployer minted to its own wallet then ENS records
 *    point at the user's wallet via taars.* fields). For a transfer we re-encrypt
 *    with the same platform key (placeholder for the TEE oracle re-encrypt for new
 *    owner key), upload a new merkle root, then call TaarsAgentNFT.iTransfer.
 *  - Steps that succeed are recorded; on partial failure the upstream caller can
 *    inspect the audit log to decide on retry / rollback.
 */

const taarsAgentNftAbi = [
  {
    type: 'function',
    name: 'iTransfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      {
        name: 'proofs',
        type: 'tuple[]',
        components: [
          {
            name: 'accessProof',
            type: 'tuple',
            components: [{ name: 'data', type: 'bytes' }],
          },
          {
            name: 'ownershipProof',
            type: 'tuple',
            components: [{ name: 'data', type: 'bytes' }],
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'Transferred',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const;

const ogChain = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc-testnet.0g.ai'] } },
  blockExplorers: { default: { name: '0G Chainscan', url: 'https://chainscan-galileo.0g.ai' } },
});

export interface TransferRequest {
  tokenId: bigint;
  ensLabel: string;
  newOwner: Address;
}

export interface TransferStepLog {
  step: string;
  ok: boolean;
  detail?: unknown;
  ts: number;
  attempt?: number;
}

export interface TransferResult {
  ok: boolean;
  tokenId: string;
  ensLabel: string;
  newOwner: Address;
  newStorageRoot?: string;
  txTransfer?: Hash;
  txEnsUpdate?: Hash;
  log: TransferStepLog[];
  error?: string;
}

function auditDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '.audit'),
    path.resolve(process.cwd(), 'server/.audit'),
  ];
  for (const c of candidates) {
    try {
      fs.mkdirSync(c, { recursive: true });
      return c;
    } catch {
      // try next
    }
  }
  return candidates[0];
}

function appendAudit(file: string, entry: object) {
  try {
    fs.appendFileSync(path.join(auditDir(), file), JSON.stringify(entry) + '\n');
  } catch {
    // best-effort
  }
}

async function withRetry<T>(
  step: string,
  log: TransferStepLog[],
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const v = await fn();
      log.push({ step, ok: true, attempt, ts: Date.now() });
      return v;
    } catch (e) {
      lastErr = e;
      log.push({
        step,
        ok: false,
        attempt,
        detail: e instanceof Error ? e.message : String(e),
        ts: Date.now(),
      });
      if (attempt < attempts) {
        const backoffMs = [1000, 3000, 9000][attempt - 1] ?? 5000;
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${step} failed: ${String(lastErr)}`);
}

async function uploadToZeroG(payload: Buffer): Promise<string> {
  const sdk: any = await import('@0gfoundation/0g-ts-sdk');
  const provider = new ethers.JsonRpcProvider(env.OG_RPC_URL);
  const signer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
  const indexer = new sdk.Indexer(env.OG_INDEXER_URL);
  const memData = new sdk.MemData(payload);
  const [tx, err] = await indexer.upload(memData, env.OG_RPC_URL, signer);
  if (err) throw err;
  const root: string = (tx && (tx.rootHash || tx.root || tx.hash)) || '';
  if (!root) throw new Error('upload returned no root hash');
  return root.startsWith('0x') ? root : `0x${root}`;
}

export async function orchestrateTransfer(req: TransferRequest): Promise<TransferResult> {
  const { tokenId, ensLabel, newOwner } = req;
  const log: TransferStepLog[] = [];
  const fullName = `${ensLabel}.${env.PARENT_ENS_NAME}`;
  const auditId = `transfer-${tokenId.toString()}-${Date.now()}`;
  appendAudit('transfers.jsonl', { auditId, ts: Date.now(), step: 'begin', tokenId: tokenId.toString(), ensLabel, newOwner });

  let newStorageRoot: string | undefined;
  let txTransfer: Hash | undefined;
  let txEnsUpdate: Hash | undefined;

  try {
    if (!env.TAARS_INFT_ADDRESS) throw new Error('TAARS_INFT_ADDRESS not configured');

    // 1. Pull current storage root from ENS, decrypt the artifact bundle.
    const currentStorage = await withRetry('ens.read.storage', log, () =>
      readText(fullName, 'taars.storage')
    );

    let plain: Buffer | null = null;
    if (currentStorage) {
      plain = await withRetry('storage.fetch+decrypt', log, () => fetchAndDecrypt(currentStorage));
    } else {
      // Fresh transfers without prior storage: synthesize a minimal placeholder.
      plain = Buffer.from(JSON.stringify({ note: 'transfer placeholder' }), 'utf8');
      log.push({ step: 'storage.no-prior-root', ok: true, ts: Date.now() });
    }

    // 2. Re-encrypt (in production, TEE oracle re-encrypts with newOwner's key).
    //    Hackathon: same platform key; we still rotate the IV so the new merkle root differs.
    const reEncrypted = blobToBytes(encryptBlob(plain, env.ENCRYPTION_KEY));

    // 3. Upload the re-encrypted blob to 0G Storage.
    newStorageRoot = await withRetry('storage.upload', log, () => uploadToZeroG(reEncrypted));

    // 4. Call TaarsAgentNFT.iTransfer on 0G Chain. Caller (deployer) must be the
    //    current INFT owner. (Hackathon: deployer is owner of all minted INFTs.)
    const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
    const transport = http(env.OG_RPC_URL);
    const publicClient = createPublicClient({ chain: ogChain, transport });
    const walletClient = createWalletClient({ chain: ogChain, transport, account });

    txTransfer = await withRetry('inft.iTransfer', log, async () => {
      const hash = await walletClient.writeContract({
        address: env.TAARS_INFT_ADDRESS as Address,
        abi: taarsAgentNftAbi,
        functionName: 'iTransfer',
        args: [newOwner, tokenId, []],
        chain: ogChain,
        account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      // sanity-check the Transferred event
      let confirmed = false;
      for (const lg of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: taarsAgentNftAbi, data: lg.data, topics: lg.topics });
          if (decoded.eventName === 'Transferred') {
            confirmed = true;
            break;
          }
        } catch {
          // not our event
        }
      }
      if (!confirmed) throw new Error('iTransfer receipt missing Transferred event');
      return hash;
    });

    // 5. Update ENS text records with the new storage root.
    txEnsUpdate = await withRetry('ens.update.storage', log, () =>
      setText(fullName, 'taars.storage', newStorageRoot!)
    );

    // Fire KeeperHub INFT transfer verifier workflow. Reads ownerOf on 0G to
    // attest the new owner is set; closes the multi-step ERC-7857 flow with a
    // KeeperHub-guaranteed audit step.
    const kh = await fireKeeperhubWorkflow('inftTransfer', {
      tokenId: tokenId.toString(),
      newOwner,
      txHash: txTransfer,
      newStorageRoot,
      ensLabel,
    });
    log.push({ step: 'keeperhub.fire', ok: kh.ok, detail: kh, ts: Date.now() });

    appendAudit('transfers.jsonl', {
      auditId,
      ts: Date.now(),
      step: 'success',
      tokenId: tokenId.toString(),
      ensLabel,
      newOwner,
      newStorageRoot,
      txTransfer,
      txEnsUpdate,
      keeperhub: kh,
    });

    return {
      ok: true,
      tokenId: tokenId.toString(),
      ensLabel,
      newOwner,
      newStorageRoot,
      txTransfer,
      txEnsUpdate,
      log,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    appendAudit('transfers.jsonl', {
      auditId,
      ts: Date.now(),
      step: 'failed',
      error,
      tokenId: tokenId.toString(),
      ensLabel,
      newOwner,
    });
    return {
      ok: false,
      tokenId: tokenId.toString(),
      ensLabel,
      newOwner,
      newStorageRoot,
      txTransfer,
      txEnsUpdate,
      log,
      error,
    };
  }
}
