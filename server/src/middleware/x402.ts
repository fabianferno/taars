import type { Context, MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { getSession } from '../services/sessions.js';

const SESSION_HEADER = 'X-Taars-Session';

function atomicUsdcFromRate(ratePerMinUsd: string): string {
  // USDC has 6 decimals on Sepolia mocks.
  const rate = Number(ratePerMinUsd || '0');
  if (!Number.isFinite(rate) || rate <= 0) return '0';
  return BigInt(Math.round(rate * 1_000_000)).toString();
}

function buildChallenge(c: Context, opts: { ensLabel?: string; ratePerMinUsd?: string }) {
  return {
    error: 'payment_required',
    x402: {
      scheme: 'exact',
      asset: env.MOCK_USDC_ADDRESS ?? '',
      network: 'sepolia',
      payTo: env.TAARS_BILLING_ADDRESS ?? '',
      resource: c.req.path,
      maxAmountRequired: atomicUsdcFromRate(opts.ratePerMinUsd ?? '0'),
      description: opts.ensLabel
        ? `Per-minute chat with ${opts.ensLabel}`
        : 'Per-minute chat with a taars replica',
    },
  };
}

/// Lightweight x402 paywall: requires `X-Taars-Session` header. Real signature
/// verification happens against the billing contract on settlement; this just
/// gates traffic on session existence.
export const x402Required: MiddlewareHandler = async (c, next) => {
  const sessionId = c.req.header(SESSION_HEADER) || c.req.header(SESSION_HEADER.toLowerCase());
  if (!sessionId) {
    return c.json(buildChallenge(c, {}), 402);
  }
  const session = getSession(sessionId);
  if (!session) {
    return c.json(buildChallenge(c, {}), 402);
  }
  if (session.endedAt) {
    return c.json(
      {
        ...buildChallenge(c, { ensLabel: session.ensLabel, ratePerMinUsd: session.ratePerMinUsd }),
        error: 'session_ended',
      },
      402
    );
  }
  // attach session for downstream handlers
  c.set('taarsSession', session);
  await next();
};

export const _internal = { atomicUsdcFromRate, SESSION_HEADER };
