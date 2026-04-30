/**
 * On-chain billing addresses + ABIs.
 *
 * The contract is deployed in parallel by another worker. Until
 * NEXT_PUBLIC_TAARS_BILLING_ADDRESS / NEXT_PUBLIC_MOCK_USDC_ADDRESS are
 * populated in `web/.env.local`, the dashboard renders a placeholder.
 */

export const TAARS_BILLING_ADDRESS = (process.env.NEXT_PUBLIC_TAARS_BILLING_ADDRESS ?? '') as
  | `0x${string}`
  | '';

export const MOCK_USDC_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ?? '') as
  | `0x${string}`
  | '';

export const TAARS_BILLING_ABI = [
  // --- views ---
  {
    type: 'function',
    name: 'ratePerMinute',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint128' }],
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
    name: 'getRevenue',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // --- writes ---
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
    name: 'settleSession',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionId', type: 'bytes32' },
      { name: 'endedAt', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimRevenue',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
] as const;

export const MOCK_USDC_ABI = [
  // --- views ---
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // --- writes ---
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export const USDC_DECIMALS = 6;

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);

/** Convert a user-facing USD string (e.g. "0.05") to atomic units (uint256). */
export function usdToAtomic(usd: string | number, decimals = USDC_DECIMALS): bigint {
  const s = typeof usd === 'number' ? usd.toString() : usd;
  if (!s) return ZERO;
  const [whole = '0', fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  const sign = whole.startsWith('-') ? -ONE : ONE;
  const wholeAbs = whole.replace('-', '');
  return sign * (BigInt(wholeAbs) * TEN ** BigInt(decimals) + BigInt(frac || '0'));
}

/** Format atomic uint256 USDC into a human-readable string (e.g. "0.123456"). */
export function atomicToUsd(atomic: bigint, decimals = USDC_DECIMALS): string {
  if (atomic === ZERO) return '0';
  const neg = atomic < ZERO ? true : false;
  const abs = neg ? -atomic : atomic;
  const base = TEN ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const out = fracStr ? `${whole}.${fracStr}` : `${whole}`;
  return neg ? `-${out}` : out;
}
