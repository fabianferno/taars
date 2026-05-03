import { Hono } from 'hono';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { readAllTexts } from '../services/ens.js';
import { settleSessionOnChain, startSessionOnChain } from '../services/billing.js';
import { fireKeeperhubWorkflow, KH_WORKFLOWS } from '../services/keeperhub.js';

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
  sessionId: `0x${string}`; // for billing parity with /chat sessions
  tokenId: string; // INFT tokenId from taars.inft ENS record; '0' when missing
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
  'taars.inft',
] as const;

function parseTokenId(inftRef: string | undefined): string {
  if (!inftRef) return '0';
  const tail = inftRef.split(':').pop() ?? '';
  return /^\d+$/.test(tail) ? tail : '0';
}

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

deploy.get('/health', async (c) => {
  // Probe the bot's /health. Fails fast (1.5s) so the UI badge stays snappy.
  const url = `${env.DISCORD_BOT_URL}/health`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    let bot: any = null;
    try {
      bot = await res.json();
    } catch {
      // ignore
    }
    return c.json({
      ok: res.ok && Boolean(bot?.discordReady),
      bot: bot ?? { discordReady: false, error: `bot returned ${res.status}` },
    });
  } catch (e) {
    return c.json({
      ok: false,
      bot: { discordReady: false, error: (e as Error).message },
    });
  }
});

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
  let tokenId = '0';
  try {
    const records = await readAllTexts(ensFullName, ENS_KEYS as unknown as string[]);
    voiceId = records['taars.voice'] || voiceId;
    ratePerMinUsd = rateForDiscord(records);
    tokenId = parseTokenId(records['taars.inft']);
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
    sessionId,
    tokenId,
  };
  deploys.set(deployId, record);

  // Open the billing session on chain so /discord/end can settle it. The oracle
  // wallet is the on-chain `caller`; at tokenId=0 the snapshot rate is 0 so no
  // USDC moves at settle time. Don't fail the deploy if this errors.
  try {
    const startRes = await startSessionOnChain(sessionId, tokenId);
    await appendAudit({ event: 'deploy.session_started', deployId, sessionId, tokenId, startRes });
  } catch (e) {
    await appendAudit({
      event: 'deploy.session_start_failed',
      deployId,
      sessionId,
      tokenId,
      error: (e as Error).message?.slice(0, 200),
    });
  }

  // Fire KeeperHub Discord deploy lifecycle workflow (start event).
  const khStart = await fireKeeperhubWorkflow('discordDeploy', {
    event: 'start',
    deployId,
    ensFullName,
    sessionId,
    guildId: parsed.data.guildId,
    channelId: parsed.data.channelId,
    voiceId,
    ratePerMinUsd,
    ownerAddress: parsed.data.ownerAddress,
  });

  await appendAudit({
    event: 'deploy.active',
    deployId,
    txAuditId,
    botGreetingMs: botResp.data?.greetingMs ?? null,
    keeperhub: khStart,
  });

  return c.json({
    ok: true,
    deployId,
    txAuditId,
    status: 'active' as DeployStatus,
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
    voiceUsed: botResp.data?.voiceUsed ?? record.voiceId,
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
      deployedSeconds,
      record.tokenId,
      record.ensFullName
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

  // Fire KeeperHub Discord deploy lifecycle workflow (end event).
  const khEnd = await fireKeeperhubWorkflow('discordDeploy', {
    event: 'end',
    deployId: record.deployId,
    ensFullName: record.ensFullName,
    sessionId: record.sessionId,
    guildId: record.guildId,
    channelId: record.channelId,
    voiceId: record.voiceId,
    ratePerMinUsd: record.ratePerMinUsd,
    ownerAddress: record.ownerAddress,
    deployedSeconds,
    expectedUsd: expected,
  });

  await appendAudit({
    event: 'deploy.settle',
    deployId: record.deployId,
    sessionId: record.sessionId,
    settlement,
    keeperhub: khEnd,
  });

  return c.json({
    ok: true,
    deployId: record.deployId,
    deployedSeconds,
    ratePerMinUsd: record.ratePerMinUsd,
    expectedUsd: expected,
    settlement,
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
