import { Hono } from 'hono';
import { readAllTexts } from '../services/ens.js';
import { env } from '../env.js';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { namehash, normalize } from 'viem/ens';

// Inlined to avoid runtime/loader friction with the workspace SDK barrel.
// Mirrors @taars/sdk -> TAARS_TEXT_KEYS.
const TAARS_TEXT_KEYS = [
  'taars.inft',
  'taars.storage',
  'taars.created',
  'taars.version',
  'taars.price',
  'taars.currency',
  'taars.network',
  'taars.voice',
  'avatar',
  'description',
  'url',
] as const;

export const resolve = new Hono();

const REGISTRY_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;

resolve.get('/:label', async (c) => {
  const label = c.req.param('label');
  const fullName = `${label}.${env.PARENT_ENS_NAME}`;
  const client = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
  const owner = (await client.readContract({
    address: ENS_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'owner',
    args: [namehash(normalize(fullName))],
  })) as `0x${string}`;
  if (owner === '0x0000000000000000000000000000000000000000') {
    return c.json({ error: 'not_found', ensFullName: fullName }, 404);
  }
  const records = await readAllTexts(fullName, TAARS_TEXT_KEYS as unknown as string[]);
  const inftRef = records['taars.inft'] ?? '';
  const tokenId = inftRef.split(':').pop() ?? '';
  return c.json({
    ensFullName: fullName,
    ensLabel: label,
    owner,
    tokenId,
    storageRoot: records['taars.storage'] ?? '',
    ratePerMinUsd: records['taars.price'] ?? '',
    currency: records['taars.currency'] ?? 'USDC',
    network: records['taars.network'] ?? 'sepolia',
    voiceId: records['taars.voice'] ?? '',
    description: records['description'] ?? '',
    avatar: records['avatar'] ?? '',
    version: records['taars.version'] ?? '',
  });
});
