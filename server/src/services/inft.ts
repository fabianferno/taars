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
import { env } from '../env.js';

const taarsAgentNftAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'data',
        type: 'tuple[]',
        components: [
          { name: 'dataDescription', type: 'string' },
          { name: 'dataHash', type: 'bytes32' },
        ],
      },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Transfer',
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

export interface IntelligentDataInput {
  dataDescription: string;
  dataHash: `0x${string}`;
}

export interface MintResult {
  tokenId: bigint;
  txHash: Hash;
}

/**
 * Resilient receipt waiter for 0G testnet — its public RPC sometimes drops the
 * tx for a window after broadcast even though the tx ultimately lands. We poll
 * `getTransactionReceipt` directly and tolerate transient `not found` errors
 * until our own deadline.
 */
async function waitForReceiptResilient(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hash,
  opts: { label: string; timeoutMs: number; pollMs: number }
) {
  const deadline = Date.now() + opts.timeoutMs;
  let lastErr: unknown = null;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt) {
        if (receipt.status === 'reverted') {
          throw new Error(`tx ${hash} reverted on-chain`);
        }
        return receipt;
      }
    } catch (err) {
      lastErr = err;
      // viem throws TransactionReceiptNotFoundError when the receipt isn't yet available — that's fine.
      const msg = (err as Error).message || '';
      if (!/not be found|not found|could not be found/i.test(msg)) {
        // Network/RPC blip — log but keep retrying until deadline.
        if (attempt % 5 === 0) {
          console.warn(`[${opts.label}] receipt poll error (attempt ${attempt}): ${msg.slice(0, 160)}`);
        }
      }
    }
    await new Promise((r) => setTimeout(r, opts.pollMs));
  }
  const elapsedSec = Math.round(opts.timeoutMs / 1000);
  throw new Error(
    `tx ${hash} receipt not found after ${elapsedSec}s — the tx may still land later. ` +
      `Last error: ${(lastErr as Error)?.message?.slice(0, 200) ?? 'none'}`
  );
}

function getInftAddress(): Address {
  if (!env.TAARS_INFT_ADDRESS) {
    throw new Error('TAARS_INFT_ADDRESS not set in env — deploy contracts first');
  }
  return env.TAARS_INFT_ADDRESS as Address;
}

export async function mintINFT(
  to: Address,
  data: IntelligentDataInput[]
): Promise<MintResult> {
  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const transport = http(env.OG_RPC_URL);
  const publicClient = createPublicClient({ chain: ogChain, transport });
  const walletClient = createWalletClient({ chain: ogChain, transport, account });

  const txHash = await walletClient.writeContract({
    address: getInftAddress(),
    abi: taarsAgentNftAbi,
    functionName: 'mint',
    args: [data, to],
    chain: ogChain,
    account,
  });

  console.log(`[inft.mint] tx submitted: ${txHash} — waiting for receipt`);
  const receipt = await waitForReceiptResilient(publicClient, txHash, {
    label: 'inft.mint',
    timeoutMs: 8 * 60_000,
    pollMs: 4_000,
  });

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: taarsAgentNftAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'Transfer' && decoded.args.from === '0x0000000000000000000000000000000000000000') {
        return { tokenId: decoded.args.tokenId as bigint, txHash };
      }
    } catch {
      // not our event
    }
  }
  throw new Error('Mint Transfer event not found in receipt logs');
}

const ownerOfAbi = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export async function getInftOwnerOnZeroG(tokenId: bigint): Promise<Address> {
  const transport = http(env.OG_RPC_URL);
  const publicClient = createPublicClient({ chain: ogChain, transport });
  const owner = (await publicClient.readContract({
    address: getInftAddress(),
    abi: ownerOfAbi,
    functionName: 'ownerOf',
    args: [tokenId],
  })) as Address;
  return owner;
}
