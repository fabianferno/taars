import { Hono } from 'hono';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { readAllTexts } from '../services/ens.js';
import { settleSessionOnChain } from '../services/billing.js';

// ----- types -----

type DeployStatus = 'pending' | 'active' | 'ended' | 'failed';

interface DiscordDeploy {
  deployId: string;
  ensLabel: string;
  ensFullName: string;
  guildId: string;
  channelId: string;
  ownerAddress: string;
  voiceId: string;
  ratePerMinUsd: string;
  startedAt: number; // unix seconds
  endedAt?: number;
  status: DeployStatus;
  stub: boolean;
  sessionId: `0x${string}`; // for billing parity with /chat sessions
}

const deploys = new Map<string, DiscordDeploy>();

// ----- audit -----

function resolveAuditDir(): string {
  const cwdName = path.basename(process.cwd());
  return cwdName === 'server'
    ? path.resolve(process.cwd(), '.audit')
    : path.resolve(process.cwd(), 'server', '.audit');
}

async function appendAudit(record: Record<string, unknown>): Promise<void> {
  try {
    const dir = resolveAuditDir();
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'deploys.jsonl');
    await fs.appendFile(file, JSON.stringify({ ts: Date.now(), ...record }) + '\n', 'utf8');
  } catch (e) {
    console.warn('[deploy] audit write failed:', (e as Error).message);
  }
}

// ----- helpers -----

const ENS_KEYS = [
  'taars.voice',
  'taars.price',
  'taars.deploy.discord',
  'taars.storage',
  'taars.version',
] as const;

function rateForDiscord(records: Record<string, string>): string {
  const explicit = records['taars.deploy.discord'];
  if (explicit && Number(explicit) > 0) return explicit;
  const base = Number(records['taars.price'] || '0');
  if (!Number.isFinite(base) || base <= 0) return '0';
  return (base * 2.5).toFixed(4);
}

async function callBot(
  pathname: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const url = `${env.DISCORD_BOT_URL}${pathname}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: (e as Error).message,
    };
  }
}

function expectedUsd(ratePerMinUsd: string, durationSeconds: number): string {
  const rate = Number(ratePerMinUsd || '0');
  if (!Number.isFinite(rate) || rate <= 0) return '0';
  return (rate * (durationSeconds / 60)).toFixed(4);
}

// ----- route -----

export const deploy = new Hono();

const startSchema = z.object({
  ensLabel: z.string().regex(/^[a-z0-9-]{2,32}$/),
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const speakSchema = z.object({
  deployId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

const endSchema = z.object({
  deployId: z.string().min(1),
});

deploy.post('/discord', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.message }, 400);
  }
  const ensFullName = `${parsed.data.ensLabel}.${env.PARENT_ENS_NAME}`;
  const deployId = `dpy_${randomBytes(8).toString('hex')}`;
  const sessionId = (`0x${randomBytes(32).toString('hex')}`) as `0x${string}`;
  const txAuditId = `aud_${randomBytes(6).toString('hex')}`;

  let voiceId = parsed.data.ensLabel;
  let ratePerMinUsd = '0';
  try {
    const records = await readAllTexts(ensFullName, ENS_KEYS as unknown as string[]);
    voiceId = records['taars.voice'] || voiceId;
    ratePerMinUsd = rateForDiscord(records);
  } catch (e) {
    console.warn(
      `[deploy/discord] ENS lookup failed for ${ensFullName}: ${(e as Error).message.slice(0, 120)}`
    );
  }

  await appendAudit({
    event: 'deploy.start',
    deployId,
    txAuditId,
    sessionId,
    ensFullName,
    guildId: parsed.data.guildId,
    channelId: parsed.data.channelId,
    ownerAddress: parsed.data.ownerAddress,
    voiceId,
    ratePerMinUsd,
  });

  const botResp = await callBot('/deploy', {
    guildId: parsed.data.guildId,
    channelId: parsed.data.channelId,
    voiceId,
    ensLabel: parsed.data.ensLabel,
    sessionId,
  });

  if (!botResp.ok) {
    await appendAudit({
      event: 'deploy.bot_unreachable',
      deployId,
      txAuditId,
      status: botResp.status,
      error: botResp.error ?? botResp.data?.error,
    });
    return c.json(
      {
        ok: false,
        deployId,
        txAuditId,
        status: 'failed' as DeployStatus,
        error: botResp.error ?? botResp.data?.error ?? `bot returned ${botResp.status}`,
      },
      502
    );
  }

  const stub = Boolean(botResp.data?.stub);
  const record: DiscordDeploy = {
    deployId,
    ensLabel: parsed.data.ensLabel,
    ensFullName,
    guildId: parsed.data.guildId,
    channelId: parsed.data.channelId,
    ownerAddress: parsed.data.ownerAddress,
    voiceId,
    ratePerMinUsd,
    startedAt: Math.floor(Date.now() / 1000),
    status: 'active',
    stub,
    sessionId,
  };
  deploys.set(deployId, record);

  await appendAudit({
    event: 'deploy.active',
    deployId,
    txAuditId,
    stub,
    botGreetingMs: botResp.data?.greetingMs ?? null,
  });

  return c.json({
    ok: true,
    deployId,
    txAuditId,
    status: 'active' as DeployStatus,
    stub,
    ensLabel: record.ensLabel,
    ensFullName: record.ensFullName,
    voiceId: record.voiceId,
    ratePerMinUsd: record.ratePerMinUsd,
    startedAt: record.startedAt,
    sessionId: record.sessionId,
  });
});

deploy.post('/discord/speak', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }
  const parsed = speakSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.message }, 400);
  }
  const record = deploys.get(parsed.data.deployId);
  if (!record) return c.json({ ok: false, error: 'deploy_not_found' }, 404);
  if (record.status !== 'active') {
    return c.json({ ok: false, error: `deploy_${record.status}` }, 410);
  }

  const botResp = await callBot('/speak', {
    guildId: record.guildId,
    message: parsed.data.message,
  });
  await appendAudit({
    event: 'deploy.speak',
    deployId: record.deployId,
    ok: botResp.ok,
    durationMs: botResp.data?.durationMs ?? null,
    error: botResp.error ?? botResp.data?.error ?? null,
  });
  if (!botResp.ok) {
    return c.json(
      { ok: false, error: botResp.error ?? botResp.data?.error ?? 'bot_speak_failed' },
      502
    );
  }
  return c.json({
    ok: true,
    durationMs: botResp.data?.durationMs ?? 0,
    stub: record.stub,
  });
});

deploy.post('/discord/end', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.message }, 400);
  }
  const record = deploys.get(parsed.data.deployId);
  if (!record) return c.json({ ok: false, error: 'deploy_not_found' }, 404);
  if (record.status !== 'active') {
    return c.json({ ok: false, error: `deploy_${record.status}` }, 410);
  }

  const botResp = await callBot('/undeploy', { guildId: record.guildId });
  const botSeconds: number = Number.isFinite(botResp.data?.deployedSeconds)
    ? Number(botResp.data.deployedSeconds)
    : 0;
  const localSeconds = Math.max(0, Math.floor(Date.now() / 1000) - record.startedAt);
  const deployedSeconds = Math.max(botSeconds, localSeconds);

  record.endedAt = Math.floor(Date.now() / 1000);
  record.status = 'ended';

  const expected = expectedUsd(record.ratePerMinUsd, deployedSeconds);
  await appendAudit({
    event: 'deploy.end',
    deployId: record.deployId,
    sessionId: record.sessionId,
    deployedSeconds,
    ratePerMinUsd: record.ratePerMinUsd,
    expectedUsd: expected,
    botUnreachable: !botResp.ok,
  });

  // Settlement: reuse the chat billing path for parity. If the billing contract
  // address is not configured the helper returns { skipped: true, reason }.
  let settlement: any = { settled: false, reason: 'pending' };
  try {
    const r = await settleSessionOnChain(
      record.sessionId,
      record.endedAt,
      record.ratePerMinUsd,
      deployedSeconds
    );
    if ('skipped' in r && r.skipped) {
      settlement = { settled: false, reason: r.reason };
    } else {
      settlement = {
        settled: true,
        txHash: r.txHash,
        expectedUsd: r.expectedUsd,
      };
    }
  } catch (e) {
    settlement = { settled: false, reason: (e as Error).message };
  }

  await appendAudit({
    event: 'deploy.settle',
    deployId: record.deployId,
    sessionId: record.sessionId,
    settlement,
  });

  return c.json({
    ok: true,
    deployId: record.deployId,
    deployedSeconds,
    ratePerMinUsd: record.ratePerMinUsd,
    expectedUsd: expected,
    settlement,
    stub: record.stub,
  });
});

deploy.get('/:deployId', (c) => {
  const deployId = c.req.param('deployId');
  const record = deploys.get(deployId);
  if (!record) return c.json({ ok: false, error: 'deploy_not_found' }, 404);
  const now = Math.floor(Date.now() / 1000);
  const durationSeconds = (record.endedAt ?? now) - record.startedAt;
  return c.json({
    ok: true,
    deployId: record.deployId,
    status: record.status,
    stub: record.stub,
    ensLabel: record.ensLabel,
    ensFullName: record.ensFullName,
    guildId: record.guildId,
    channelId: record.channelId,
    ownerAddress: record.ownerAddress,
    voiceId: record.voiceId,
    ratePerMinUsd: record.ratePerMinUsd,
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
    durationSeconds,
    expectedUsd: expectedUsd(record.ratePerMinUsd, durationSeconds),
    sessionId: record.sessionId,
  });
});

// for tests / introspection
export function _allDeploys(): DiscordDeploy[] {
  return Array.from(deploys.values());
}

export function _resetDeploys(): void {
  deploys.clear();
}
