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
import { namehash, normalize } from 'viem/ens';
import { randomBytes } from 'node:crypto';
import { env } from '../env.js';

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
// ENS v3 ETHRegistrarController (NameWrapper-aware) on Sepolia.
const ETH_REGISTRAR_CONTROLLER = '0xFED6a969AaA60E4961FCD3EBF1A2e8913ac65B72' as const;
// NameWrapper on Sepolia (parent .eth registrations via v3 controller are wrapped here).
const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8' as const;
// v3 Public Resolver on Sepolia (NameWrapper-aware).
const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD' as const;

const ENS_REGISTRY_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const NAME_WRAPPER_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'setSubnodeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
      { name: 'fuses', type: 'uint32' },
      { name: 'expiry', type: 'uint64' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'safeTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
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
  {
    name: 'multicall',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
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

/// Create `<sublabel>.<parent>.eth` via NameWrapper (parent is wrapped).
/// Owner of the subname = the deployer wallet (so deployer can write text records).
/// Returns the actual owner, tx hash, and node hash. Idempotent via existence check.
export async function createSubname(
  sublabel: string,
  _subOwner?: Address
): Promise<{ owner: Address; txHash?: Hash; node: `0x${string}` }> {
  void _subOwner; // hackathon: deployer owns subnames so it can write text records
  const { publicClient, walletClient, account } = makeClients();
  const fullName = `${sublabel}.${env.PARENT_ENS_NAME}`;
  const node = namehash(normalize(fullName));

  // Check existence: registry owner non-zero means it exists.
  const registryOwner = (await publicClient.readContract({
    address: ENS_REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: 'owner',
    args: [node],
  })) as Address;
  if (registryOwner !== '0x0000000000000000000000000000000000000000') {
    // already exists. If wrapped, real owner is NameWrapper.ownerOf(uint256(node))
    let realOwner: Address = registryOwner;
    if (registryOwner.toLowerCase() === NAME_WRAPPER.toLowerCase()) {
      realOwner = (await publicClient.readContract({
        address: NAME_WRAPPER,
        abi: NAME_WRAPPER_ABI,
        functionName: 'ownerOf',
        args: [BigInt(node)],
      })) as Address;
    }
    return { owner: realOwner, node };
  }

  const parentNode = namehash(normalize(env.PARENT_ENS_NAME));
  // Subname owner = deployer (account). fuses=0, expiry=max (capped at parent's expiry by the wrapper).
  const txHash = await walletClient.writeContract({
    address: NAME_WRAPPER,
    abi: NAME_WRAPPER_ABI,
    functionName: 'setSubnodeRecord',
    args: [
      parentNode,
      sublabel,
      account.address,
      PUBLIC_RESOLVER,
      0n,
      0,
      18446744073709551615n, // type(uint64).max
    ],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { owner: account.address, txHash, node };
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

/// Atomic batch via PublicResolver.multicall — all records in 1 tx.
export async function setTextsMulticall(
  fullName: string,
  records: Array<{ key: string; value: string }>
): Promise<Hash> {
  const { walletClient, account, publicClient } = makeClients();
  const node = namehash(normalize(fullName));
  const setTextSelector = '0x10f13a8c'; // keccak256("setText(bytes32,string,string)") first 4 bytes
  const { encodeAbiParameters } = await import('viem');
  const calls = records.map((r) => {
    const params = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'string' }, { type: 'string' }],
      [node, r.key, r.value]
    );
    return (setTextSelector + params.slice(2)) as `0x${string}`;
  });
  const txHash = await walletClient.writeContract({
    address: PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: 'multicall',
    args: [calls],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * Transfer a wrapped subname to its real (user) owner. NameWrapper is ERC-1155
 * so the wrapped name lives at id = uint256(node), amount = 1.
 *
 * Pattern used by createSubname → setTextsMulticall → transferSubnameOwnership:
 *  1. Deployer creates the subname owned by deployer (so deployer can write records)
 *  2. Deployer writes the full set of taars.* text records via multicall
 *  3. Deployer transfers ownership to the user — at the end of the pipeline the
 *     user is the on-chain owner of <label>.taars.eth, fulfilling the PRD
 *     contract that "whoever owns the name owns the replica".
 *
 * Idempotent: if the wrapper already reports newOwner as the wrapped owner,
 * skips the transfer.
 */
export async function transferSubnameOwnership(
  fullName: string,
  newOwner: Address
): Promise<{ txHash?: Hash; alreadyOwned: boolean }> {
  const { publicClient, walletClient, account } = makeClients();
  const node = namehash(normalize(fullName));

  const currentOwner = (await publicClient.readContract({
    address: NAME_WRAPPER,
    abi: NAME_WRAPPER_ABI,
    functionName: 'ownerOf',
    args: [BigInt(node)],
  })) as Address;

  if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
    return { alreadyOwned: true };
  }
  if (currentOwner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `cannot transfer ${fullName}: deployer ${account.address} is not the wrapped owner (got ${currentOwner})`
    );
  }

  const txHash = await walletClient.writeContract({
    address: NAME_WRAPPER,
    abi: NAME_WRAPPER_ABI,
    functionName: 'safeTransferFrom',
    args: [account.address, newOwner, BigInt(node), 1n, '0x'],
    account,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, alreadyOwned: false };
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
