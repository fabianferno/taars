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
  {
    name: 'resolver',
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

  const [owner, resolverFromRegistry] = await Promise.all([
    client.readContract({
      address: ENS_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'owner',
      args: [node],
    }) as Promise<`0x${string}`>,
    client.readContract({
      address: ENS_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    }) as Promise<`0x${string}`>,
  ]);

  if (owner === '0x0000000000000000000000000000000000000000') return null;

  // Prefer the resolver the registry has configured for this node — wrapped
  // subnames sometimes point at a different resolver than the parent's
  // PublicResolver. Fall back to the well-known PublicResolver if unset.
  const resolverAddress: `0x${string}` =
    resolverFromRegistry &&
    resolverFromRegistry !== '0x0000000000000000000000000000000000000000'
      ? resolverFromRegistry
      : PUBLIC_RESOLVER;

  const entries = await Promise.all(
    TAARS_TEXT_KEYS.map(async (key) => {
      try {
        const v = (await client.readContract({
          address: resolverAddress,
          abi: RESOLVER_ABI,
          functionName: 'text',
          args: [node, key],
        })) as string;
        return [key, v] as const;
      } catch {
        return [key, ''] as const;
      }
    })
  );

  const records: ReplicaProfile['records'] = {};
  for (const [k, v] of entries) {
    if (v) records[k] = v;
  }

  if (process.env.NODE_ENV !== 'production') {
    // Helpful in the demo console when records come back blank.
    // eslint-disable-next-line no-console
    console.debug('[ens.resolve]', {
      fullName,
      owner,
      resolver: resolverAddress,
      recordCount: Object.keys(records).length,
    });
  }

  return { ensFullName: fullName, ensLabel: label, owner, records };
}
