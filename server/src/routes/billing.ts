import { Hono } from 'hono';
import { z } from 'zod';
import type { Address } from 'viem';
import { claimRevenueOnChain, setRateOnChain, getOwnerBalance } from '../services/billing.js';

export const billing = new Hono();

const claimSchema = z.object({
  tokenId: z.string().regex(/^\d+$/),
});

billing.post('/claim', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) return c.json({ ok: false, error: parsed.error.message }, 400);
  const tokenId = BigInt(parsed.data.tokenId);
  try {
    const balance = await getOwnerBalance(tokenId);
    if (balance === 0n) return c.json({ ok: false, error: 'nothing_to_claim' }, 400);
    const r = await claimRevenueOnChain(tokenId);
    return c.json({ ok: true, tokenId: tokenId.toString(), tokenOwner: r.tokenOwner, txHash: r.txHash });
  } catch (e) {
    console.error('[billing/claim] failed:', e);
    return c.json({ ok: false, error: (e as Error).message.slice(0, 200) }, 500);
  }
});

const setRateSchema = z.object({
  tokenId: z.string().regex(/^\d+$/),
  // USD per minute as a decimal string, e.g. "0.15"
  pricePerMinUsd: z.string().regex(/^\d+(\.\d+)?$/),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

billing.post('/set-rate', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = setRateSchema.safeParse(body);
  if (!parsed.success) return c.json({ ok: false, error: parsed.error.message }, 400);
  const tokenId = BigInt(parsed.data.tokenId);
  // USDC has 6 decimals; convert "0.15" → 150000n
  const [whole, frac = ''] = parsed.data.pricePerMinUsd.split('.');
  const fracPadded = (frac + '000000').slice(0, 6);
  const ratePerMinuteAtomic = BigInt(whole) * 1_000_000n + BigInt(fracPadded || '0');
  try {
    const r = await setRateOnChain(tokenId, ratePerMinuteAtomic, parsed.data.ownerAddress as Address);
    return c.json({
      ok: true,
      tokenId: tokenId.toString(),
      ratePerMinuteAtomic: ratePerMinuteAtomic.toString(),
      txHash: r.txHash,
    });
  } catch (e) {
    console.error('[billing/set-rate] failed:', e);
    return c.json({ ok: false, error: (e as Error).message.slice(0, 200) }, 500);
  }
});
