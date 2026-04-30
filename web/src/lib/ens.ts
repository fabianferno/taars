import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { namehash, normalize } from 'viem/ens';
import { TAARS_TEXT_KEYS } from '@taars/sdk';

const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const;
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;

const RESOLVER_ABI = [
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

const REGISTRY_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org'),
});

const PARENT = process.env.NEXT_PUBLIC_PARENT_ENS_NAME ?? 'taars.eth';

export type ReplicaProfile = {
  ensFullName: string;
  ensLabel: string;
  owner: `0x${string}`;
  records: Partial<Record<(typeof TAARS_TEXT_KEYS)[number], string>>;
};

export async function resolveTaarsLabel(label: string): Promise<ReplicaProfile | null> {
  const fullName = `${label}.${PARENT}`;
  const node = namehash(normalize(fullName));

  const owner = (await client.readContract({
    address: ENS_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'owner',
    args: [node],
  })) as `0x${string}`;

  if (owner === '0x0000000000000000000000000000000000000000') return null;

  const entries = await Promise.all(
    TAARS_TEXT_KEYS.map(async (key) => {
      const v = (await client.readContract({
        address: PUBLIC_RESOLVER,
        abi: RESOLVER_ABI,
        functionName: 'text',
        args: [node, key],
      })) as string;
      return [key, v] as const;
    })
  );

  const records: ReplicaProfile['records'] = {};
  for (const [k, v] of entries) {
    if (v) records[k] = v;
  }

  return { ensFullName: fullName, ensLabel: label, owner, records };
}
