import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { namehash, normalize, labelhash } from 'viem/ens';
import { randomBytes } from 'node:crypto';
import { env } from '../env.js';

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
const ETH_REGISTRAR_CONTROLLER = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968' as const;
const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const;

const ENS_REGISTRY_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'setSubnodeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'label', type: 'bytes32' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
    ],
    outputs: [],
  },
] as const;

const REGISTRAR_CONTROLLER_ABI = [
  {
    name: 'available',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'rentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'base', type: 'uint256' },
          { name: 'premium', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'minCommitmentAge',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'makeCommitment',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'duration', type: 'uint256' },
      { name: 'secret', type: 'bytes32' },
      { name: 'resolver', type: 'address' },
      { name: 'data', type: 'bytes[]' },
      { name: 'reverseRecord', type: 'bool' },
      { name: 'ownerControlledFuses', type: 'uint16' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'commit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'duration', type: 'uint256' },
      { name: 'secret', type: 'bytes32' },
      { name: 'resolver', type: 'address' },
      { name: 'data', type: 'bytes[]' },
      { name: 'reverseRecord', type: 'bool' },
      { name: 'ownerControlledFuses', type: 'uint16' },
    ],
    outputs: [],
  },
] as const;

const RESOLVER_ABI = [
  {
    name: 'setText',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'text',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

interface Clients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: ReturnType<typeof privateKeyToAccount>;
}

function makeClients(): Clients {
  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const transport = http(env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });
  return { publicClient, walletClient, account };
}

function parentLabel(): string {
  // PARENT_ENS_NAME like "taars.eth" -> "taars"
  return env.PARENT_ENS_NAME.split('.')[0];
}

export async function isParentRegistered(): Promise<{ owner: Address }> {
  const { publicClient } = makeClients();
  const owner = (await publicClient.readContract({
    address: ENS_REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: 'owner',
    args: [namehash(normalize(env.PARENT_ENS_NAME))],
  })) as Address;
  return { owner };
}

/// Register `<parent>.eth` via ETHRegistrarController commit-reveal.
/// Idempotent: if already owned by deployer, returns immediately.
export async function ensureParentEns(): Promise<{ owner: Address; txHash?: Hash }> {
  const { publicClient, walletClient, account } = makeClients();

  const { owner } = await isParentRegistered();
  if (owner !== '0x0000000000000000000000000000000000000000') {
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      console.warn(
        `[ens] parent ${env.PARENT_ENS_NAME} owned by ${owner}, not deployer ${account.address}`
      );
    }
    return { owner };
  }

  const label = parentLabel();
  const duration = 31536000n; // 1 year
  const secret = `0x${randomBytes(32).toString('hex')}` as `0x${string}`;

  const commitment = (await publicClient.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'makeCommitment',
    args: [label, account.address, duration, secret, PUBLIC_RESOLVER, [], false, 0],
  })) as `0x${string}`;

  const commitTx = await walletClient.writeContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'commit',
    args: [commitment],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: commitTx });

  const minAge = (await publicClient.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'minCommitmentAge',
  })) as bigint;
  const waitMs = Number(minAge) * 1000 + 5000;
  console.log(`[ens] waiting ${waitMs}ms for commitment to ripen`);
  await new Promise((r) => setTimeout(r, waitMs));

  const price = (await publicClient.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'rentPrice',
    args: [label, duration],
  })) as { base: bigint; premium: bigint };
  const value = price.base + price.premium;

  const registerTx = await walletClient.writeContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'register',
    args: [label, account.address, duration, secret, PUBLIC_RESOLVER, [], false, 0],
    value,
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: registerTx });

  return { owner: account.address, txHash: registerTx };
}

/// Create `<sublabel>.<parent>.eth` and assign ownership to `subOwner`.
/// Idempotent: if already exists, returns existing owner.
export async function createSubname(
  sublabel: string,
  subOwner: Address
): Promise<{ owner: Address; txHash?: Hash; node: `0x${string}` }> {
  const { publicClient, walletClient, account } = makeClients();
  const fullName = `${sublabel}.${env.PARENT_ENS_NAME}`;
  const node = namehash(normalize(fullName));

  const existingOwner = (await publicClient.readContract({
    address: ENS_REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: 'owner',
    args: [node],
  })) as Address;
  if (existingOwner !== '0x0000000000000000000000000000000000000000') {
    return { owner: existingOwner, node };
  }

  const parentNode = namehash(normalize(env.PARENT_ENS_NAME));
  const txHash = await walletClient.writeContract({
    address: ENS_REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: 'setSubnodeRecord',
    args: [parentNode, labelhash(sublabel), subOwner, PUBLIC_RESOLVER, 0n],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { owner: subOwner, txHash, node };
}

/// Write a single text record on the public resolver.
/// Caller must own the name (i.e. operator must be the deployer when called from server).
export async function setText(
  fullName: string,
  key: string,
  value: string
): Promise<Hash> {
  const { walletClient, account, publicClient } = makeClients();
  const node = namehash(normalize(fullName));
  const txHash = await walletClient.writeContract({
    address: PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: 'setText',
    args: [node, key, value],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function setTexts(
  fullName: string,
  records: Array<{ key: string; value: string }>
): Promise<Hash[]> {
  const out: Hash[] = [];
  for (const r of records) {
    out.push(await setText(fullName, r.key, r.value));
  }
  return out;
}

export async function readText(fullName: string, key: string): Promise<string> {
  const { publicClient } = makeClients();
  return (await publicClient.readContract({
    address: PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: 'text',
    args: [namehash(normalize(fullName)), key],
  })) as string;
}

export async function readAllTexts(
  fullName: string,
  keys: readonly string[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    keys.map(async (k) => [k, await readText(fullName, k)] as const)
  );
  return Object.fromEntries(entries);
}

// Re-export for convenience.
export { parentLabel as _parentLabel };
export const ENS_CONSTANTS = {
  ENS_REGISTRY,
  ETH_REGISTRAR_CONTROLLER,
  PUBLIC_RESOLVER,
} as const;
