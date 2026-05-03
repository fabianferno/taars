import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createPublicClient, createWalletClient, http, type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { env } from '../env.js';
import { fireKeeperhubWorkflow, KH_WORKFLOWS } from './keeperhub.js';
import { getInftOwnerOnZeroG } from './inft.js';

const billingAbi = [
  {
    type: 'function',
    name: 'startSession',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionId', type: 'bytes32' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getSession',
    stateMutability: 'view',
    inputs: [{ name: 'sessionId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'caller', type: 'address' },
          { name: 'startedAt', type: 'uint64' },
          { name: 'endedAt', type: 'uint64' },
          { name: 'ratePerMinute', type: 'uint128' },
          { name: 'paid', type: 'uint256' },
          { name: 'settled', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'settleSession',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionId', type: 'bytes32' },
      { name: 'endedAt', type: 'uint64' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getRevenue',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerBalance',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setRate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'ratePerMinute_', type: 'uint128' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimRevenueFor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenOwner', type: 'address' },
    ],
    outputs: [],
  },
] as const;

const AUDIT_DIR = path.resolve(process.cwd(), 'server', '.audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'sessions.jsonl');

async function appendAudit(record: Record<string, unknown>): Promise<void> {
  try {
    // Resolve relative to server dir whether cwd is repo root or server/.
    const tryPaths = [
      path.resolve(process.cwd(), '.audit'),
      path.resolve(process.cwd(), 'server', '.audit'),
    ];
    const cwdName = path.basename(process.cwd());
    const dir = cwdName === 'server' ? tryPaths[0] : tryPaths[1];
    const file = path.join(dir, 'sessions.jsonl');
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(file, JSON.stringify({ ts: Date.now(), ...record }) + '\n', 'utf8');
  } catch (e) {
    console.warn('[billing] audit write failed:', (e as Error).message);
  }
}

export interface SettleSkipped {
  skipped: true;
  reason: string;
}

export interface SettleResult {
  skipped?: false;
  txHash: string;
  expectedUsd: string;
}

function expectedUsdFromRate(ratePerMinUsd: string, durationSeconds: number): string {
  const rate = Number(ratePerMinUsd || '0');
  if (!Number.isFinite(rate) || rate <= 0) return '0';
  const minutes = durationSeconds / 60;
  return (rate * minutes).toFixed(4);
}

function billingClients() {
  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const transport = http(env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ chain: sepolia, transport, account });
  return { account, publicClient, walletClient };
}

/// Open a billing session on chain. The oracle wallet calls this so it becomes
/// the contract-side `caller` (the account that would owe USDC at settle time).
/// At tokenId=0 the contract's snapshot rate is 0, so settlement transfers
/// nothing — fine for free/server-funded flows like Discord deploys.
/// Idempotent: if the contract already has the session, this is a no-op.
export async function startSessionOnChain(
  sessionId: `0x${string}`,
  tokenId: string | bigint = 0n
): Promise<{ skipped: true; reason: string } | { txHash: Hash } | { existing: true }> {
  if (!env.TAARS_BILLING_ADDRESS) {
    const out = { skipped: true as const, reason: 'TAARS_BILLING_ADDRESS not set' };
    await appendAudit({ event: 'start.skipped', sessionId, ...out });
    return out;
  }
  const { account, publicClient, walletClient } = billingClients();
  try {
    const existing = (await publicClient.readContract({
      address: env.TAARS_BILLING_ADDRESS as Address,
      abi: billingAbi,
      functionName: 'getSession',
      args: [sessionId],
    })) as { caller: Address };
    if (existing.caller && existing.caller !== '0x0000000000000000000000000000000000000000') {
      await appendAudit({ event: 'start.existing', sessionId });
      return { existing: true };
    }
  } catch {
    // fall through to write
  }
  const tokenIdBig = typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId || '0');
  const txHash: Hash = await walletClient.writeContract({
    address: env.TAARS_BILLING_ADDRESS as Address,
    abi: billingAbi,
    functionName: 'startSession',
    args: [sessionId, tokenIdBig],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  await appendAudit({ event: 'start.success', sessionId, tokenId: tokenIdBig.toString(), txHash });
  return { txHash };
}

async function settleOnce(
  sessionId: `0x${string}`,
  endedAt: number,
  ratePerMinUsd: string,
  durationSeconds: number,
  tokenId: string
): Promise<SettleResult> {
  const { account, publicClient, walletClient } = billingClients();

  // Make settle resilient: if startSession was never recorded (e.g. an older
  // deploy that only minted a sessionId locally), open it now so the oracle
  // can settle. If we can't open it, abort — settle would revert with
  // "unknown session" anyway, and a guaranteed-revert tx burns gas + pollutes
  // the audit log.
  const existing = (await publicClient.readContract({
    address: env.TAARS_BILLING_ADDRESS as Address,
    abi: billingAbi,
    functionName: 'getSession',
    args: [sessionId],
  })) as { caller: Address };
  if (!existing.caller || existing.caller === '0x0000000000000000000000000000000000000000') {
    await appendAudit({ event: 'settle.precheck.opening', sessionId });
    await startSessionOnChain(sessionId, tokenId); // throws if it fails
  }

  const txHash: Hash = await walletClient.writeContract({
    address: env.TAARS_BILLING_ADDRESS as Address,
    abi: billingAbi,
    functionName: 'settleSession',
    args: [sessionId, BigInt(endedAt)],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return {
    txHash,
    expectedUsd: expectedUsdFromRate(ratePerMinUsd, durationSeconds),
  };
}

const BACKOFF_MS = [1000, 3000, 9000];

/// Settle a chat session on the billing contract. Retries up to 3 times with
/// exponential backoff. Logs each attempt to .audit/sessions.jsonl. If
/// TAARS_BILLING_ADDRESS is unset, returns a skipped marker without throwing.
export async function settleSessionOnChain(
  sessionId: `0x${string}`,
  endedAt: number,
  ratePerMinUsd = '0',
  durationSeconds = 0,
  tokenId = '0',
  ensFullName = ''
): Promise<SettleResult | SettleSkipped> {
  if (!env.TAARS_BILLING_ADDRESS) {
    const out: SettleSkipped = {
      skipped: true,
      reason: 'TAARS_BILLING_ADDRESS not set; on-chain settlement disabled',
    };
    await appendAudit({ event: 'settle.skipped', sessionId, ...out });
    return out;
  }

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await appendAudit({ event: 'settle.attempt', attempt, sessionId, endedAt });
      const r = await settleOnce(sessionId, endedAt, ratePerMinUsd, durationSeconds, tokenId);
      // Trigger KeeperHub billing-settle verifier workflow (real org workflow).
      // It reads getRevenue on Sepolia to attest that revenue actually accrued.
      const kh = await fireKeeperhubWorkflow('billingSettle', {
        sessionId,
        tokenId,
        txHash: r.txHash,
        expectedUsd: r.expectedUsd,
        durationSeconds,
        ensFullName,
      });
      await appendAudit({
        event: 'settle.success',
        attempt,
        sessionId,
        ...r,
        keeperhub: kh,
      });
      return r;
    } catch (e) {
      lastErr = e as Error;
      await appendAudit({
        event: 'settle.error',
        attempt,
        sessionId,
        error: lastErr.message?.slice(0, 400),
      });
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
      }
    }
  }
  const skipped: SettleSkipped = {
    skipped: true,
    reason: `settle failed after 3 attempts: ${lastErr?.message ?? 'unknown'}`,
  };
  await appendAudit({ event: 'settle.give_up', sessionId, ...skipped });
  return skipped;
}

export async function getOnChainRevenue(tokenId: bigint): Promise<bigint> {
  if (!env.TAARS_BILLING_ADDRESS) return 0n;
  const transport = http(env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  return (await publicClient.readContract({
    address: env.TAARS_BILLING_ADDRESS as Address,
    abi: billingAbi,
    functionName: 'getRevenue',
    args: [tokenId],
  })) as bigint;
}

export async function getOwnerBalance(tokenId: bigint): Promise<bigint> {
  if (!env.TAARS_BILLING_ADDRESS) return 0n;
  const transport = http(env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  return (await publicClient.readContract({
    address: env.TAARS_BILLING_ADDRESS as Address,
    abi: billingAbi,
    functionName: 'ownerBalance',
    args: [tokenId],
  })) as bigint;
}

/// Pays out accrued revenue for `tokenId` to the verified 0G INFT owner.
/// Reads ownership from the canonical 0G INFT, then calls `claimRevenueFor`
/// on the Sepolia billing contract from the oracle key.
export async function claimRevenueOnChain(tokenId: bigint): Promise<{ txHash: Hash; tokenOwner: Address }> {
  if (!env.TAARS_BILLING_ADDRESS) {
    throw new Error('TAARS_BILLING_ADDRESS not set');
  }
  const tokenOwner = await getInftOwnerOnZeroG(tokenId);
  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const transport = http(env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ chain: sepolia, transport, account });

  const txHash: Hash = await walletClient.writeContract({
    address: env.TAARS_BILLING_ADDRESS as Address,
    abi: billingAbi,
    functionName: 'claimRevenueFor',
    args: [tokenId, tokenOwner],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  await appendAudit({ event: 'claim.success', tokenId: tokenId.toString(), tokenOwner, txHash });
  return { txHash, tokenOwner };
}

/// Sets the per-minute rate (USDC atomic units) for `tokenId` on Sepolia, after
/// verifying that `requestedOwner` matches the canonical 0G INFT owner.
export async function setRateOnChain(
  tokenId: bigint,
  ratePerMinuteAtomic: bigint,
  requestedOwner: Address
): Promise<{ txHash: Hash }> {
  if (!env.TAARS_BILLING_ADDRESS) {
    throw new Error('TAARS_BILLING_ADDRESS not set');
  }
  const realOwner = await getInftOwnerOnZeroG(tokenId);
  if (realOwner.toLowerCase() !== requestedOwner.toLowerCase()) {
    throw new Error(`ownership mismatch: 0G says ${realOwner}, request claims ${requestedOwner}`);
  }
  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const transport = http(env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ chain: sepolia, transport, account });

  const txHash: Hash = await walletClient.writeContract({
    address: env.TAARS_BILLING_ADDRESS as Address,
    abi: billingAbi,
    functionName: 'setRate',
    args: [tokenId, ratePerMinuteAtomic],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  await appendAudit({
    event: 'setRate.success',
    tokenId: tokenId.toString(),
    ratePerMinuteAtomic: ratePerMinuteAtomic.toString(),
    requestedOwner,
    txHash,
  });
  return { txHash };
}

export const _internal = { expectedUsdFromRate, AUDIT_FILE, AUDIT_DIR };
