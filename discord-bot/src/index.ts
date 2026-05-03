import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { env } from './env.js';

// ----- types -----

interface DeployState {
  guildId: string;
  channelId: string;
  textChannelId: string;
  voiceId: string;
  ensLabel: string;
  sessionId: string;
  startedAt: number;
  connection: any;
  audioPlayer?: any;
  receiver: any | null;
  speaking: boolean;
}

const deploys = new Map<string, DeployState>(); // keyed by guildId

// Minimal RIFF/WAVE header for PCM s16le audio.
function wrapWav(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // PCM chunk size
  header.writeUInt16LE(1, 20);           // format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);          // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function transcribePcm(state: DeployState, pcm: Buffer): Promise<string> {
  const wav = wrapWav(pcm, 48000, 2);
  const form = new FormData();
  // Node's global File / Blob (Node ≥ 20). Discord-bot already runs on this.
  const blob = new Blob([new Uint8Array(wav)], { type: 'audio/wav' });
  form.append('audio', blob, 'turn.wav');
  const res = await fetch(`${env.TAARS_SERVER_URL}/chat/transcribe`, {
    method: 'POST',
    headers: { 'X-Taars-Session': state.sessionId },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`transcribe ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { ok: boolean; text?: string };
  return (json.text ?? '').trim();
}

async function agentReply(state: DeployState, userText: string): Promise<string> {
  const res = await fetch(`${env.TAARS_SERVER_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Taars-Session': state.sessionId,
    },
    body: JSON.stringify({ sessionId: state.sessionId, message: userText }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`chat/message ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { ok: boolean; text?: string };
  return (json.text ?? '').trim();
}

// ----- discord state -----

let discordReady = false;
let discordClient: any = null;
let voiceMod: any = null;

async function initDiscord(): Promise<void> {
  const djs: any = await import('discord.js');
  voiceMod = await import('@discordjs/voice');
  const { Client, GatewayIntentBits } = djs;
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  discordClient.on('messageCreate', async (message: any) => {
    try {
      if (message.author?.bot) return;
      if (!message.guildId) return;
      const state = deploys.get(message.guildId);
      if (!state) return; // no active deploy in this guild
      if (!message.mentions?.has?.(discordClient.user)) return;

      // Strip the bot mention token (with or without nickname `<@!id>`).
      const botId = discordClient.user.id;
      const stripped = (message.content as string)
        .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
        .trim();
      if (!stripped) return;

      const reply = await agentReply(state, stripped);
      if (!reply) return;
      const out = reply.length > 1900 ? reply.slice(0, 1900) + ' …' : reply;
      await message.reply(out);
    } catch (e) {
      console.warn('[discord-bot] mention handler failed:', (e as Error).message);
    }
  });

  await new Promise<void>((resolve, reject) => {
    discordClient.once('ready', () => {
      console.log(`[discord-bot] logged in as ${discordClient.user?.tag}`);
      discordReady = true;
      resolve();
    });
    discordClient.once('error', reject);
    discordClient.login(env.DISCORD_BOT_TOKEN).catch(reject);
  });
}

function requireReady(): void {
  if (!discordReady || !discordClient || !voiceMod) {
    const err: any = new Error('discord client not ready');
    err.status = 503;
    throw err;
  }
}

// ----- voice helpers -----

async function synthesizeOnce(voiceId: string, text: string): Promise<Buffer | { notFound: true }> {
  const res = await fetch(`${env.OPENVOICE_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_id: voiceId, text, speed: 1.0 }),
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) {
    const body = await res.text();
    // OpenVoice sometimes leaks FileNotFoundError as 500 instead of 404 when
    // the streamer's loader and the pre-flight check disagree. Treat that
    // shape as "not found" so the bot's fallback chain still kicks in.
    if (res.status === 500 && /No embedding for voice|voice profile not found/i.test(body)) {
      return { notFound: true };
    }
    throw new Error(`OpenVoice /synthesize failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Synthesize speech with intelligent voice fallback. Tries the requested
 * voiceId first, then the ENS label (matches the OpenVoice seed naming for
 * featured taars), then the configured DEFAULT_VOICE_FALLBACK. Throws only if
 * every candidate is unknown / OpenVoice is unreachable.
 */
async function synthesizeWav(state: DeployState, text: string): Promise<{ wav: Buffer; voiceUsed: string }> {
  const tried = new Set<string>();
  const candidates = [state.voiceId, state.ensLabel, env.DEFAULT_VOICE_FALLBACK].filter(
    (v): v is string => Boolean(v) && !tried.has(v) && tried.add(v) !== undefined
  );
  let lastNotFound: string | null = null;
  for (const candidate of candidates) {
    const out = await synthesizeOnce(candidate, text);
    if (out instanceof Buffer) {
      if (candidate !== state.voiceId) {
        console.warn(
          `[discord-bot] voice profile "${state.voiceId}" not found - falling back to "${candidate}"`
        );
        // Pin the fallback so subsequent /speak calls don't redo the lookup.
        state.voiceId = candidate;
      }
      return { wav: out, voiceUsed: candidate };
    }
    lastNotFound = candidate;
  }
  throw new Error(
    `OpenVoice has no profile for any of [${candidates.join(', ')}]. ` +
      `Last 404: ${lastNotFound ?? 'unknown'}.`
  );
}

async function playInGuild(guildId: string, text: string): Promise<{ durationMs: number; voiceUsed: string }> {
  const state = deploys.get(guildId);
  if (!state) throw new Error(`no active deploy for guild ${guildId}`);
  requireReady();

  const start = Date.now();
  const { wav, voiceUsed } = await synthesizeWav(state, text);

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
  return { durationMs: Date.now() - start, voiceUsed };
}

const STOPWORDS = /^(uh+|um+|hmm+|ah+|er+|\.+)$/i;
const MIN_PCM_BYTES = 48_000 * 2 * 2 * 0.3; // 300ms of 48k stereo s16le

async function attachVoiceListener(state: DeployState): Promise<void> {
  // Lazy import: prism-media is loaded only after voice deps initialize.
  const prism: any = await import('prism-media');
  const receiver = state.connection.receiver;
  state.receiver = receiver;

  receiver.speaking.on('start', (userId: string) => {
    // Claim the turn lock synchronously so two near-simultaneous speakers
    // can't both pass the gate. The lock is released in the 'end' handler,
    // including the early-exit paths (too short / empty transcript / stopword).
    if (state.speaking) return;
    state.speaking = true;
    const opusStream = receiver.subscribe(userId, {
      end: { behavior: voiceMod.EndBehaviorType.AfterSilence, duration: 1000 },
    });
    const decoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    });
    const chunks: Buffer[] = [];
    const pcmStream = opusStream.pipe(decoder);
    pcmStream.on('data', (c: Buffer) => chunks.push(c));
    pcmStream.on('error', (e: Error) => {
      console.warn(`[discord-bot] pcm stream error ${state.guildId}:`, e.message);
      state.speaking = false;
    });
    pcmStream.on('end', async () => {
      try {
        const pcm = Buffer.concat(chunks);
        if (pcm.length < MIN_PCM_BYTES) return; // too short, likely noise
        const text = await transcribePcm(state, pcm);
        if (!text || STOPWORDS.test(text)) return;
        console.log(`[discord-bot] heard ${state.guildId} <${userId}>: ${text}`);
        const reply = await agentReply(state, text);
        if (!reply) return;
        console.log(`[discord-bot] replying ${state.guildId}: ${reply.slice(0, 120)}`);
        await playInGuild(state.guildId, reply);
      } catch (e) {
        console.warn(`[discord-bot] turn failed ${state.guildId}:`, (e as Error).message);
      } finally {
        state.speaking = false;
      }
    });
  });
  console.log(`[discord-bot] voice listener attached for guild ${state.guildId}`);
}

async function joinVc(state: DeployState): Promise<void> {
  requireReady();
  const guild = await discordClient.guilds.fetch(state.guildId).catch((e: Error) => {
    const err: any = new Error(`fetch guild ${state.guildId} failed: ${e.message}`);
    err.status = 404;
    throw err;
  });
  // Pre-flight: confirm channel exists and is a joinable voice/stage channel.
  const channel = await guild.channels.fetch(state.channelId).catch((e: Error) => {
    const err: any = new Error(`fetch channel ${state.channelId} failed: ${e.message}`);
    err.status = 404;
    throw err;
  });
  if (!channel) {
    const err: any = new Error(`channel ${state.channelId} not found in guild ${state.guildId}`);
    err.status = 404;
    throw err;
  }
  // GuildVoice = 2, GuildStageVoice = 13.
  if (channel.type !== 2 && channel.type !== 13) {
    const err: any = new Error(
      `channel ${state.channelId} is type ${channel.type}, not a voice channel (expected 2 or 13).`
    );
    err.status = 400;
    throw err;
  }
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (me && typeof channel.permissionsFor === 'function') {
    const perms = channel.permissionsFor(me);
    const missing: string[] = [];
    // ViewChannel=1024, Connect=1048576, Speak=2097152.
    if (!perms?.has(1024n)) missing.push('ViewChannel');
    if (!perms?.has(1048576n)) missing.push('Connect');
    if (!perms?.has(2097152n)) missing.push('Speak');
    if (missing.length > 0) {
      const err: any = new Error(
        `bot is missing permissions on channel ${channel.name ?? state.channelId}: ${missing.join(', ')}`
      );
      err.status = 403;
      throw err;
    }
  }

  const connection = voiceMod.joinVoiceChannel({
    channelId: state.channelId,
    guildId: state.guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
    debug: true,
  });
  connection.on('debug', (msg: string) => {
    console.log(`[discord-bot] voice debug ${state.guildId}:`, msg);
  });
  connection.on('subscribe', () => {});
  // Inner networking state (UDP discovery) is the most common failure point.
  const hookedNetworking = new WeakSet<object>();
  const hookedWs = new WeakSet<object>();
  const hookNetworkingState = (nstate: any) => {
    if (!nstate || typeof nstate !== 'object') return;
    const ws = nstate.ws;
    if (ws && !hookedWs.has(ws)) {
      hookedWs.add(ws);
      ws.on?.('close', (...args: any[]) => {
        const a = args[0];
        let code: any = args[0];
        let reason: any = args[1];
        if (a && typeof a === 'object') {
          code = a.code ?? a.statusCode ?? a;
          reason = a.reason ?? a.message ?? '';
        }
        console.warn(
          `[discord-bot] voice WS closed ${state.guildId}: code=${code} reason=${
            reason?.toString?.() ?? reason ?? ''
          } raw=${JSON.stringify(a, Object.getOwnPropertyNames(a ?? {}))}`
        );
      });
      ws.on?.('error', (e: Error) =>
        console.warn(`[discord-bot] voice WS error ${state.guildId}:`, e.message)
      );
    }
  };
  connection.on('stateChange', (_o: any, n: any) => {
    if (n.networking && !hookedNetworking.has(n.networking)) {
      hookedNetworking.add(n.networking);
      n.networking.on('debug', (msg: string) =>
        console.log(`[discord-bot] networking debug ${state.guildId}:`, msg)
      );
      n.networking.on('error', (e: Error) =>
        console.warn(`[discord-bot] networking error ${state.guildId}:`, e.message)
      );
      n.networking.on('stateChange', (oo: any, nn: any) => {
        console.log(
          `[discord-bot] networking ${state.guildId}: ${oo.code}->${nn.code}`
        );
        hookNetworkingState(nn);
      });
      hookNetworkingState(n.networking.state);
    }
  });
  state.connection = connection;
  state.audioPlayer = voiceMod.createAudioPlayer();
  connection.subscribe(state.audioPlayer);

  // Capture the real reason the connection fails — entersState only throws
  // AbortError on timeout, which hides the underlying state transitions.
  const transitions: string[] = [];
  let lastError: Error | null = null as Error | null;
  connection.on('stateChange', (oldS: any, newS: any) => {
    const line = `${oldS.status}->${newS.status}${newS.reason ? `(${newS.reason})` : ''}`;
    transitions.push(line);
    console.log(`[discord-bot] voice ${state.guildId}: ${line}`);
  });
  connection.on('error', (e: Error) => {
    lastError = e;
    console.warn(`[discord-bot] voice error ${state.guildId}:`, e.message);
  });

  try {
    await voiceMod.entersState(connection, voiceMod.VoiceConnectionStatus.Ready, 15_000);
  } catch (e) {
    try {
      connection.destroy();
    } catch {
      // ignore
    }
    const err: any = new Error(
      `voice connection did not reach Ready within 15s: ${(e as Error).message}. ` +
        `Transitions: [${transitions.join(', ')}]. ` +
        (lastError ? `Last connection error: ${lastError.message}. ` : '') +
        `Channel type=${channel.type} name=${channel.name ?? '?'}. ` +
        `If transitions stop at "signalling" the gateway never replied (bot may not actually be in the guild). ` +
        `If they reach "connecting" but not "ready" it's usually a UDP/encryption issue (missing native voice deps).`
    );
    err.status = 502;
    throw err;
  }
  await attachVoiceListener(state);
}

async function leaveVc(state: DeployState): Promise<number> {
  const seconds = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
  try {
    state.audioPlayer?.stop();
    state.connection?.destroy();
  } catch (e) {
    console.warn('[discord-bot] leaveVc error:', (e as Error).message);
  }
  return seconds;
}

// ----- HTTP control plane -----

const deployBodySchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  textChannelId: z.string().min(1),
  voiceId: z.string().min(1),
  ensLabel: z.string().min(1),
  sessionId: z.string().min(1),
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
  requireReady();
  if (deploys.has(parsed.guildId)) {
    const err: any = new Error(`guild ${parsed.guildId} already has an active deploy`);
    err.status = 409;
    throw err;
  }
  const state: DeployState = {
    guildId: parsed.guildId,
    channelId: parsed.channelId,
    textChannelId: parsed.textChannelId,
    voiceId: parsed.voiceId,
    ensLabel: parsed.ensLabel,
    sessionId: parsed.sessionId,
    startedAt: Date.now(),
    connection: null,
    receiver: null,
    speaking: false,
  };
  await joinVc(state);
  deploys.set(parsed.guildId, state);

  // Greeting.
  const greeting = `Hi, I'm ${parsed.ensLabel}'s taars replica. Ask me anything - every minute is metered on-chain.`;
  let greetingMs = 0;
  let voiceUsed = state.voiceId;
  try {
    const r = await playInGuild(parsed.guildId, greeting);
    greetingMs = r.durationMs;
    voiceUsed = r.voiceUsed;
  } catch (e) {
    // Don't fail the deploy if the greeting can't synthesize - the connection
    // is up, /speak will report errors clearly.
    console.warn('[discord-bot] greeting playback failed:', (e as Error).message);
  }

  return {
    ok: true,
    guildId: parsed.guildId,
    channelId: parsed.channelId,
    voiceId: voiceUsed,
    ensLabel: parsed.ensLabel,
    startedAt: state.startedAt,
    greetingMs,
  };
}

async function handleSpeak(body: unknown) {
  const parsed = speakBodySchema.parse(body);
  requireReady();
  const state = deploys.get(parsed.guildId);
  if (!state) {
    const err: any = new Error(`no active deploy for guild ${parsed.guildId}`);
    err.status = 404;
    throw err;
  }
  const r = await playInGuild(parsed.guildId, parsed.message);
  return { ok: true, durationMs: r.durationMs, voiceUsed: r.voiceUsed };
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
  return { ok: true, deployedSeconds };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${env.DISCORD_BOT_PORT}`);
  const method = req.method ?? 'GET';
  try {
    if (method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        ok: discordReady,
        deploys: deploys.size,
        discordReady,
        botTag: discordClient?.user?.tag ?? null,
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
      `[discord-bot] HTTP control plane listening on http://localhost:${env.DISCORD_BOT_PORT}`
    );
  });
}

main().catch((e) => {
  console.error('[discord-bot] fatal:', e);
  process.exit(1);
});
