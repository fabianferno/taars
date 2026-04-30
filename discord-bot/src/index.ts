import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { env, HAS_DISCORD_TOKEN } from './env.js';

// ----- types -----

interface DeployState {
  guildId: string;
  channelId: string;
  voiceId: string;
  ensLabel: string;
  startedAt: number;
  // Lazy types: connection, audioPlayer come from @discordjs/voice when present.
  connection?: any;
  audioPlayer?: any;
  stub: boolean;
}

const deploys = new Map<string, DeployState>(); // keyed by guildId

// ----- discord state (lazy) -----

let discordReady = false;
let discordClient: any = null;
let voiceMod: any = null;

async function initDiscord(): Promise<void> {
  if (!HAS_DISCORD_TOKEN) {
    console.log(
      '[discord-bot] DISCORD_BOT_TOKEN missing - start in stub mode (HTTP endpoints respond 200 with a simulated deploy)'
    );
    return;
  }
  try {
    const djs: any = await import('discord.js');
    voiceMod = await import('@discordjs/voice');
    const { Client, GatewayIntentBits } = djs;
    discordClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });
    discordClient.once('ready', () => {
      console.log(`[discord-bot] logged in as ${discordClient.user?.tag}`);
      discordReady = true;
    });
    await discordClient.login(env.DISCORD_BOT_TOKEN);
  } catch (e) {
    console.warn(
      '[discord-bot] failed to init Discord client:',
      (e as Error).message,
      '- falling back to stub mode'
    );
    discordReady = false;
    discordClient = null;
    voiceMod = null;
  }
}

// ----- voice helpers -----

async function synthesizeWav(voiceId: string, text: string): Promise<Buffer> {
  const res = await fetch(`${env.OPENVOICE_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_id: voiceId, text, speed: 1.0 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenVoice /synthesize failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function playInGuild(guildId: string, text: string): Promise<{ durationMs: number }> {
  const state = deploys.get(guildId);
  if (!state) throw new Error(`no active deploy for guild ${guildId}`);

  const start = Date.now();
  let wav: Buffer;
  try {
    wav = await synthesizeWav(state.voiceId, text);
  } catch (e) {
    if (state.stub) {
      console.warn(
        `[discord-bot] (stub) synthesize failed: ${(e as Error).message} - simulating playback`
      );
      return { durationMs: Math.max(500, text.length * 60) };
    }
    throw e;
  }

  if (state.stub || !state.connection || !voiceMod) {
    // Stub: write to a tmp file so we can prove the bytes flowed, but skip actual VC playback.
    const tmpPath = path.join(os.tmpdir(), `taars-stub-${randomBytes(6).toString('hex')}.wav`);
    await fs.writeFile(tmpPath, wav);
    console.log(
      `[discord-bot] (stub) synthesized ${wav.length} bytes for guild=${guildId} -> ${tmpPath}`
    );
    return { durationMs: Date.now() - start };
  }

  // Real Discord playback path.
  const tmpPath = path.join(os.tmpdir(), `taars-${randomBytes(6).toString('hex')}.wav`);
  await fs.writeFile(tmpPath, wav);
  try {
    const stream = Readable.from(wav);
    const resource = voiceMod.createAudioResource(stream, {
      inputType: voiceMod.StreamType.Arbitrary,
    });
    if (!state.audioPlayer) {
      state.audioPlayer = voiceMod.createAudioPlayer();
      state.connection.subscribe(state.audioPlayer);
    }
    state.audioPlayer.play(resource);
    // Wait for playback to finish or fail (best effort, capped at 60s).
    await new Promise<void>((resolve) => {
      const done = () => {
        state.audioPlayer.removeListener(voiceMod.AudioPlayerStatus.Idle, done);
        state.audioPlayer.removeListener('error', done);
        resolve();
      };
      state.audioPlayer.once(voiceMod.AudioPlayerStatus.Idle, done);
      state.audioPlayer.once('error', done);
      setTimeout(done, 60_000);
    });
  } finally {
    fs.unlink(tmpPath).catch(() => {});
  }
  return { durationMs: Date.now() - start };
}

async function joinVc(state: DeployState): Promise<void> {
  if (state.stub || !discordReady || !discordClient || !voiceMod) {
    console.log(
      `[discord-bot] (stub) joinVc guild=${state.guildId} channel=${state.channelId} voice=${state.voiceId}`
    );
    return;
  }
  const guild = await discordClient.guilds.fetch(state.guildId);
  const connection = voiceMod.joinVoiceChannel({
    channelId: state.channelId,
    guildId: state.guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });
  state.connection = connection;
  state.audioPlayer = voiceMod.createAudioPlayer();
  connection.subscribe(state.audioPlayer);
  // Wait until ready (5s timeout fallback).
  try {
    await voiceMod.entersState(connection, voiceMod.VoiceConnectionStatus.Ready, 10_000);
  } catch (e) {
    console.warn('[discord-bot] voice connection did not reach Ready:', (e as Error).message);
  }
}

async function leaveVc(state: DeployState): Promise<number> {
  const seconds = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
  if (state.stub || !state.connection) {
    console.log(`[discord-bot] (stub) leaveVc guild=${state.guildId} seconds=${seconds}`);
    return seconds;
  }
  try {
    state.audioPlayer?.stop();
    state.connection.destroy();
  } catch (e) {
    console.warn('[discord-bot] leaveVc error:', (e as Error).message);
  }
  return seconds;
}

// ----- HTTP control plane -----

const deployBodySchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  voiceId: z.string().min(1),
  ensLabel: z.string().min(1),
  sessionId: z.string().optional(),
});

const speakBodySchema = z.object({
  guildId: z.string().min(1),
  message: z.string().min(1),
});

const undeployBodySchema = z.object({
  guildId: z.string().min(1),
});

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': buf.length,
  });
  res.end(buf);
}

async function handleDeploy(body: unknown) {
  const parsed = deployBodySchema.parse(body);
  const stub = !discordReady;
  const state: DeployState = {
    guildId: parsed.guildId,
    channelId: parsed.channelId,
    voiceId: parsed.voiceId,
    ensLabel: parsed.ensLabel,
    startedAt: Date.now(),
    stub,
  };
  await joinVc(state);
  deploys.set(parsed.guildId, state);

  // Greeting.
  const greeting = `Hi, I'm ${parsed.ensLabel}'s taars replica. Ask me anything - every minute is metered on-chain.`;
  let greetingMs = 0;
  try {
    const r = await playInGuild(parsed.guildId, greeting);
    greetingMs = r.durationMs;
  } catch (e) {
    console.warn('[discord-bot] greeting playback failed:', (e as Error).message);
  }

  return {
    ok: true,
    stub,
    guildId: parsed.guildId,
    channelId: parsed.channelId,
    voiceId: parsed.voiceId,
    ensLabel: parsed.ensLabel,
    startedAt: state.startedAt,
    greetingMs,
  };
}

async function handleSpeak(body: unknown) {
  const parsed = speakBodySchema.parse(body);
  const state = deploys.get(parsed.guildId);
  if (!state) {
    const err: any = new Error(`no active deploy for guild ${parsed.guildId}`);
    err.status = 404;
    throw err;
  }
  const r = await playInGuild(parsed.guildId, parsed.message);
  return { ok: true, stub: state.stub, durationMs: r.durationMs };
}

async function handleUndeploy(body: unknown) {
  const parsed = undeployBodySchema.parse(body);
  const state = deploys.get(parsed.guildId);
  if (!state) {
    const err: any = new Error(`no active deploy for guild ${parsed.guildId}`);
    err.status = 404;
    throw err;
  }
  const deployedSeconds = await leaveVc(state);
  deploys.delete(parsed.guildId);
  return { ok: true, stub: state.stub, deployedSeconds };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${env.DISCORD_BOT_PORT}`);
  const method = req.method ?? 'GET';
  try {
    if (method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        ok: true,
        deploys: deploys.size,
        discordReady,
        stubMode: !discordReady,
      });
    }
    if (method === 'POST' && url.pathname === '/deploy') {
      const body = await readJson(req);
      const out = await handleDeploy(body);
      return sendJson(res, 200, out);
    }
    if (method === 'POST' && url.pathname === '/speak') {
      const body = await readJson(req);
      const out = await handleSpeak(body);
      return sendJson(res, 200, out);
    }
    if (method === 'POST' && url.pathname === '/undeploy') {
      const body = await readJson(req);
      const out = await handleUndeploy(body);
      return sendJson(res, 200, out);
    }
    sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : e?.name === 'ZodError' ? 400 : 500;
    console.error('[discord-bot] http error:', e?.message ?? e);
    sendJson(res, status, { ok: false, error: e?.message ?? String(e) });
  }
});

async function main(): Promise<void> {
  await initDiscord();
  server.listen(env.DISCORD_BOT_PORT, () => {
    console.log(
      `[discord-bot] HTTP control plane listening on http://localhost:${env.DISCORD_BOT_PORT} (stubMode=${!discordReady})`
    );
  });
}

main().catch((e) => {
  console.error('[discord-bot] fatal:', e);
  process.exit(1);
});
