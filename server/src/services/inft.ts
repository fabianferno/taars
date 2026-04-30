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

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

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
