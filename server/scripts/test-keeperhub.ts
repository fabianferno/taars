#!/usr/bin/env tsx
/**
 * KeeperHub webhook discovery + smoke test.
 *
 * If KEEPERHUB_WEBHOOK_BASE is set, fires all three workflows once with a
 * dummy payload (you should see executions appear in the KeeperHub UI).
 *
 * If KEEPERHUB_WEBHOOK_BASE is NOT set, probes the most common URL shapes
 * against one workflow id and tells you which one responded — paste the
 * winner into your .env as KEEPERHUB_WEBHOOK_BASE.
 *
 * Usage:
 *   pnpm --filter @taars/server exec tsx scripts/test-keeperhub.ts
 */
import { fireKeeperhubWorkflow, KH_WORKFLOWS } from '../src/services/keeperhub.js';

const ANY_WORKFLOW_ID = KH_WORKFLOWS.billingSettle;

/// Candidate base URLs in priority order. The script appends the workflow id.
const CANDIDATE_BASES = [
  'https://app.keeperhub.com/api/webhook',
  'https://app.keeperhub.com/api/webhooks',
  'https://app.keeperhub.com/api/workflows/{id}/trigger',
  'https://app.keeperhub.com/api/workflows/{id}/webhook',
  'https://app.keeperhub.com/api/workflows/{id}/run',
  'https://app.keeperhub.com/api/v1/webhook',
  'https://app.keeperhub.com/api/v1/workflows/{id}/trigger',
  'https://app.keeperhub.com/webhook',
];

function resolveUrl(base: string, id: string): string {
  return base.includes('{id}')
    ? base.replace('{id}', id)
    : `${base.replace(/\/$/, '')}/${id}`;
}

async function probe(base: string): Promise<{ url: string; status: number; ok: boolean; body: string }> {
  const url = resolveUrl(base, ANY_WORKFLOW_ID);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.KEEPERHUB_API_KEY
          ? { Authorization: `Bearer ${process.env.KEEPERHUB_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ probe: true, source: 'taars-test-script' }),
    });
    const text = await res.text().catch(() => '');
    return { url, status: res.status, ok: res.ok, body: text.slice(0, 200) };
  } catch (e) {
    return { url, status: 0, ok: false, body: (e as Error).message };
  }
}

async function discover(): Promise<void> {
  console.log('🔎 KEEPERHUB_WEBHOOK_BASE is unset — probing common URL shapes…\n');
  console.log(`Probing against workflow id: ${ANY_WORKFLOW_ID}`);
  if (!process.env.KEEPERHUB_API_KEY) {
    console.log('⚠️  KEEPERHUB_API_KEY also unset — probes go unauthenticated.\n');
  } else {
    console.log('🔑 Using KEEPERHUB_API_KEY for auth.\n');
  }

  const results = await Promise.all(CANDIDATE_BASES.map(probe));
  let bestBase: string | null = null;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const base = CANDIDATE_BASES[i];
    const verdict = r.ok
      ? '✅ 200'
      : r.status === 401 || r.status === 403
      ? '🔒 auth required (URL likely correct)'
      : r.status === 404
      ? '❌ 404'
      : r.status === 0
      ? '🚫 network error'
      : `⚠️  ${r.status}`;
    console.log(`${verdict.padEnd(40)} ${r.url}`);
    if (!bestBase && (r.ok || r.status === 401 || r.status === 403)) {
      bestBase = base;
    }
  }

  console.log('');
  if (bestBase) {
    console.log(`👉 Likely working base: ${bestBase}`);
    console.log(`   Add to .env:\n   KEEPERHUB_WEBHOOK_BASE=${bestBase}`);
    if (!process.env.KEEPERHUB_API_KEY) {
      console.log(
        '\n   If 401/403, you also need KEEPERHUB_API_KEY in .env (find it under your KeeperHub account → API keys).'
      );
    }
  } else {
    console.log('❌ No candidate URL responded successfully.');
    console.log('   Steps to find it manually:');
    console.log('   1. Open https://app.keeperhub.com');
    console.log('   2. Open one of the three workflows below');
    console.log('   3. Look at the Webhook trigger node — it usually shows the trigger URL');
    console.log(`   Workflow ids: ${JSON.stringify(KH_WORKFLOWS, null, 2)}`);
  }
}

async function smokeFire(): Promise<void> {
  const base = process.env.KEEPERHUB_WEBHOOK_BASE!;
  console.log(`🔥 Firing all 3 workflows against base: ${base}\n`);

  const cases = [
    {
      key: 'billingSettle' as const,
      payload: {
        sessionId: '0x' + '00'.repeat(32),
        tokenId: '0',
        txHash: '0x' + '11'.repeat(32),
        expectedUsd: '0.05',
        durationSeconds: 60,
        ensFullName: 'smoketest.taars.eth',
      },
    },
    {
      key: 'inftTransfer' as const,
      payload: {
        tokenId: '0',
        newOwner: '0x0000000000000000000000000000000000000001',
        txHash: '0x' + '22'.repeat(32),
        newStorageRoot: '0x' + '33'.repeat(32),
        ensLabel: 'smoketest',
      },
    },
    {
      key: 'discordDeploy' as const,
      payload: {
        event: 'start',
        deployId: 'smoke_' + Date.now(),
        ensFullName: 'smoketest.taars.eth',
        sessionId: '0x' + '44'.repeat(32),
        guildId: '000000000000000000',
        channelId: '000000000000000000',
        voiceId: 'smoketest',
        ratePerMinUsd: '0.05',
        ownerAddress: '0x0000000000000000000000000000000000000001',
      },
    },
  ];

  let pass = 0;
  for (const c of cases) {
    process.stdout.write(`▶ ${c.key.padEnd(16)} `);
    const r = await fireKeeperhubWorkflow(c.key, c.payload);
    if (r.ok) {
      pass++;
      console.log(`✅ executionId=${r.executionId ?? '(none)'} status=${r.status ?? '?'}`);
    } else {
      console.log(`❌ ${r.error}`);
    }
  }
  console.log(`\n${pass}/${cases.length} workflows fired successfully.`);
  if (pass < cases.length) process.exit(1);
}

async function main() {
  if (process.env.KEEPERHUB_WEBHOOK_BASE) {
    await smokeFire();
  } else {
    await discover();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
