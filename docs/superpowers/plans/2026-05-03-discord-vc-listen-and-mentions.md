# Discord VC Two-Way Voice + Text Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a deployed Discord taars conversational on two surfaces — open-mic voice in the VC (Whisper STT → agent reply → OpenVoice TTS) and `@mention` replies in text channels.

**Architecture:** The `discord-bot` process gains a voice receive loop and a `messageCreate` handler. Both call the existing `server` HTTP endpoints (`/chat/transcribe`, `/chat/message`) using a session-id created at deploy time, so auth + billing + LLM stay centralized. No new server endpoints.

**Tech Stack:** TypeScript, `discord.js` v14, `@discordjs/voice` (already installed), `prism-media` (transitively installed; used for Opus→PCM), Hono server, OpenAI Whisper.

**Spec:** `docs/superpowers/specs/2026-05-03-discord-vc-listen-and-mentions-design.md`

**Manual-verification iteration:** the bot's voice loop is hard to unit-test without significant mock infra. Each task ends with a manual smoke test instead of a unit test. Type-check (`pnpm -C discord-bot tsc --noEmit`) gates each commit.

---

## File Map

| File | Change |
|---|---|
| `server/src/routes/deploy.ts` | Extend `startSchema` with required `textChannelId`. In `/discord` handler, call `startSession()` to register a real chat session and pass that real `sessionId` (plus `textChannelId`) to the bot. |
| `server/src/services/sessions.ts` | None (already exposes `startSession`, `getSession`). |
| `discord-bot/src/index.ts` | Add `textChannelId`, `sessionId`, `speaking`, `receiver` to `DeployState`. Update `deployBodySchema` to require both. Add `MessageContent` + `GuildMessages` intents. Add `attachVoiceListener()` called from `joinVc`. Add `client.on('messageCreate', ...)` handler. Add helper `agentReply(state, userText)` that POSTs to `/chat/message`. Add helper `transcribePcm(state, pcm)` that wraps PCM as WAV and POSTs to `/chat/transcribe`. |
| `discord-bot/src/env.ts` | None — `TAARS_SERVER_URL` already exists. |
| `discord-bot/package.json` | Add explicit `prism-media` dep (it's transitive today; pinning makes the import safe). |
| `web/src/lib/api.ts` | Add `textChannelId: string` to `DiscordDeployStartRequest`. |
| `web/src/components/Deploy/DiscordDeployPanel.tsx` | Add "Text Channel ID" input; pass `textChannelId` in `startDiscordDeploy()`. |

---

## Task 1: Server-side — register a real session at deploy time

**Files:**
- Modify: `server/src/routes/deploy.ts` (around lines 134, 150-200)

- [ ] **Step 1: Extend `startSchema`**

In `server/src/routes/deploy.ts`, replace the existing `startSchema` (around line 134) with:

```ts
const startSchema = z.object({
  ensLabel: z.string().regex(/^[a-z0-9-]{2,32}$/),
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  textChannelId: z.string().min(1),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});
```

- [ ] **Step 2: Replace the random-bytes session id with a real session**

In the `/discord` handler (around lines 161-197), after `const ensFullName = ...` and BEFORE `const deployId = ...`, replace the existing `const sessionId = ...` line with a real `startSession` call. The handler should look like this for the relevant block:

```ts
const ensFullName = `${parsed.data.ensLabel}.${env.PARENT_ENS_NAME}`;
const deployId = `dpy_${randomBytes(8).toString('hex')}`;
const txAuditId = `aud_${randomBytes(6).toString('hex')}`;

// Register a real chat session so the bot can call /chat/message and
// /chat/transcribe with the same x402 session header the web client uses.
let session;
try {
  session = await startSession({
    ensLabel: parsed.data.ensLabel,
    callerAddress: parsed.data.ownerAddress,
  });
} catch (e) {
  console.error(`[deploy/discord] startSession failed: ${(e as Error).message}`);
  return c.json({ ok: false, error: 'session_init_failed' }, 500);
}
const sessionId = session.sessionId;
const voiceId = session.voiceId;
const ratePerMinUsd = session.ratePerMinUsd;
```

Then DELETE the now-redundant `voiceId` / `ratePerMinUsd` block that does ENS lookups (lines roughly 166-176 in the original) — `startSession` already resolves these.

Also add `import { startSession } from '../services/sessions.js';` to the imports at the top.

- [ ] **Step 3: Pass `textChannelId` to the bot**

In the same handler, update the `callBot('/deploy', ...)` call to include `textChannelId`:

```ts
const botResp = await callBot('/deploy', {
  guildId: parsed.data.guildId,
  channelId: parsed.data.channelId,
  textChannelId: parsed.data.textChannelId,
  voiceId,
  ensLabel: parsed.data.ensLabel,
  sessionId,
});
```

- [ ] **Step 4: Type-check**

Run: `pnpm -C server tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke test the server endpoint**

Start the server: `pnpm -C server dev` (in another terminal).
Run:
```bash
curl -s -X POST http://localhost:8080/deploy/discord \
  -H 'Content-Type: application/json' \
  -d '{"ensLabel":"skywalker","guildId":"0","channelId":"0","textChannelId":"0","ownerAddress":"0x0000000000000000000000000000000000000000"}'
```
Expected: a JSON response. It will fail at `callBot` because the bot may not be up — that's fine; the goal is to confirm the schema accepts `textChannelId` and `startSession` runs. Look for `"error":"session_init_failed"` only if startSession blew up; otherwise the error should reference the bot connection.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/deploy.ts
git commit -m "feat(deploy): register real chat session and accept textChannelId"
```

---

## Task 2: Discord bot — wire the new deploy fields and intents

**Files:**
- Modify: `discord-bot/src/index.ts`
- Modify: `discord-bot/package.json`

- [ ] **Step 1: Pin `prism-media`**

In `discord-bot/package.json`, add `"prism-media": "^1.3.5"` to `dependencies` (alphabetically). Run `pnpm install` from the repo root.

- [ ] **Step 2: Extend `DeployState` and `deployBodySchema`**

In `discord-bot/src/index.ts`, replace the `DeployState` interface (lines ~12-21) with:

```ts
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
```

Replace `deployBodySchema` (lines ~300-306) with:

```ts
const deployBodySchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  textChannelId: z.string().min(1),
  voiceId: z.string().min(1),
  ensLabel: z.string().min(1),
  sessionId: z.string().min(1),
});
```

- [ ] **Step 3: Initialize the new fields in `handleDeploy`**

In `handleDeploy` (lines ~343-385), update the `state` object literal to include the new fields:

```ts
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
```

- [ ] **Step 4: Add `MessageContent` and `GuildMessages` intents**

In `initDiscord` (lines ~31-47), update the `Client` constructor:

```ts
const { Client, GatewayIntentBits } = djs;
discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
```

- [ ] **Step 5: Type-check**

Run: `pnpm -C discord-bot tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Smoke test deploy still works**

With server + bot running and a real Discord guild handy, trigger a deploy from the web UI. Expected: bot still joins the VC and speaks the greeting. (No new behavior yet — voice listening + mentions come next.)

- [ ] **Step 7: Commit**

```bash
git add discord-bot/src/index.ts discord-bot/package.json pnpm-lock.yaml
git commit -m "feat(discord-bot): accept textChannelId+sessionId, add message intents"
```

> **NOTE — Discord developer portal:** the `MessageContent` intent is *privileged*. Before the next task's smoke test, the user must enable "Message Content Intent" under the bot's settings in the Discord developer portal. The plan assumes this is done.

---

## Task 3: Discord bot — server-call helpers (`transcribePcm`, `agentReply`)

**Files:**
- Modify: `discord-bot/src/index.ts`

- [ ] **Step 1: Add a tiny WAV header helper**

Add this near the top of the file, right after the `interface DeployState { ... }` block:

```ts
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
```

- [ ] **Step 2: Add `transcribePcm` helper**

Add right below `wrapWav`:

```ts
async function transcribePcm(state: DeployState, pcm: Buffer): Promise<string> {
  const wav = wrapWav(pcm, 48000, 2);
  const form = new FormData();
  // Node's global File / Blob (Node ≥ 20). Discord-bot already runs on this.
  const blob = new Blob([wav], { type: 'audio/wav' });
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
```

- [ ] **Step 3: Add `agentReply` helper**

Add right below `transcribePcm`:

```ts
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
```

- [ ] **Step 4: Type-check**

Run: `pnpm -C discord-bot tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/index.ts
git commit -m "feat(discord-bot): add transcribePcm + agentReply server helpers"
```

---

## Task 4: Discord bot — voice receive loop

**Files:**
- Modify: `discord-bot/src/index.ts`

- [ ] **Step 1: Add the `attachVoiceListener` function**

Add this function just above `async function joinVc`:

```ts
const STOPWORDS = /^(uh+|um+|hmm+|ah+|er+|\.+)$/i;
const MIN_PCM_BYTES = 48_000 * 2 * 2 * 0.3; // 300ms of 48k stereo s16le

async function attachVoiceListener(state: DeployState): Promise<void> {
  // Lazy import: prism-media is loaded only after voice deps initialize.
  const prism: any = await import('prism-media');
  const receiver = state.connection.receiver;
  state.receiver = receiver;

  receiver.speaking.on('start', (userId: string) => {
    if (state.speaking) return; // bot is already replying; ignore new turns
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
    pcmStream.on('error', (e: Error) =>
      console.warn(`[discord-bot] pcm stream error ${state.guildId}:`, e.message)
    );
    pcmStream.on('end', async () => {
      const pcm = Buffer.concat(chunks);
      if (pcm.length < MIN_PCM_BYTES) return; // too short, likely noise
      if (state.speaking) return; // raced with another turn
      state.speaking = true;
      try {
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
```

- [ ] **Step 2: Call `attachVoiceListener` from `joinVc`**

In `joinVc`, immediately after the `await voiceMod.entersState(...)` succeeds (right before the function returns, around line 285), add:

```ts
  await attachVoiceListener(state);
}
```

(So the line goes inside the existing `try` success path, just before the closing brace of `joinVc`.)

- [ ] **Step 3: Type-check**

Run: `pnpm -C discord-bot tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test — single-speaker voice loop**

1. Restart the bot: `pnpm -C discord-bot dev`.
2. Deploy via the web UI to a real VC + text channel.
3. Join the VC and say "Hello, what's your name?"
4. Watch the bot logs for `[discord-bot] heard ...` and `[discord-bot] replying ...`.
5. Expected: bot speaks a reply through OpenVoice within ~3-5s of you finishing your sentence.

If transcription fails with `403`, the session header isn't being accepted — check that the bot's `state.sessionId` matches what `startSession` returned. If you hear nothing back, check OpenVoice logs.

- [ ] **Step 5: Manual smoke test — turn lock**

1. Ask the bot a question that yields a long reply (e.g. "Tell me your life story").
2. While it's speaking, try to interrupt with another sentence.
3. Expected: your interruption is ignored (no `[discord-bot] heard ...` log line); only after the bot finishes speaking does a fresh utterance get picked up.

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/index.ts
git commit -m "feat(discord-bot): listen to VC speech, transcribe, and reply with TTS"
```

---

## Task 5: Discord bot — text mention handler

**Files:**
- Modify: `discord-bot/src/index.ts`

- [ ] **Step 1: Register the `messageCreate` handler in `initDiscord`**

In `initDiscord`, after the `ready` handler is registered but before the `discordClient.login(...)` call, add:

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm -C discord-bot tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test — mention reply**

1. Confirm "Message Content Intent" is enabled in the Discord developer portal for this bot.
2. With a deploy active, in any text channel of that guild type: `@<bot> hi, who are you?`
3. Expected: bot replies in the same channel with the agent's text reply.

- [ ] **Step 4: Manual smoke test — mention without deploy is ignored**

1. `/undeploy` (or `endDiscordDeploy` from the UI).
2. Mention the bot again.
3. Expected: no reply, no error in logs (just the early `return` path).

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/index.ts
git commit -m "feat(discord-bot): reply to @mentions in text when deploy is active"
```

---

## Task 6: Web — pass `textChannelId` through the deploy form

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/components/Deploy/DiscordDeployPanel.tsx`

- [ ] **Step 1: Add `textChannelId` to the request type**

In `web/src/lib/api.ts` (around line 243), update:

```ts
export interface DiscordDeployStartRequest {
  ensLabel: string;
  guildId: string;
  channelId: string;
  textChannelId: string;
  ownerAddress: `0x${string}`;
}
```

No other change needed in `api.ts` — the field is already serialized via `JSON.stringify(req)`.

- [ ] **Step 2: Add a Text Channel ID input to the panel**

In `web/src/components/Deploy/DiscordDeployPanel.tsx`:

a) Add state next to the existing `channelId` state (around line 56):

```tsx
const [textChannelId, setTextChannelId] = useState('');
```

b) Find the existing `<Field label="Voice Channel ID" ...>` block (around line 293) and add a new `<Field>` immediately after it:

```tsx
<Field label="Text Channel ID" hint="Right-click the text channel where mentions should reply → Copy Channel ID">
  <input
    value={textChannelId}
    onChange={(e) => setTextChannelId(e.target.value)}
    className={/* match the className used by the Voice Channel ID input */}
    placeholder="123456789012345678"
  />
</Field>
```

(Copy the `className` and any other prop pattern from the Voice Channel ID `<input>` so styling matches.)

c) Update the `disabled` check on the deploy button (around line 312):

```tsx
disabled={starting || !guildId || !channelId || !textChannelId}
```

d) Update the `startDiscordDeploy` call (around line 145) to include the new field:

```tsx
const res = await startDiscordDeploy({
  ensLabel,
  guildId: guildId.trim(),
  channelId: channelId.trim(),
  textChannelId: textChannelId.trim(),
  ownerAddress,
});
```

- [ ] **Step 3: Type-check the web app**

Run: `pnpm -C web tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test — end-to-end**

1. Start everything: server, discord-bot, openvoice, web (`pnpm -C web dev`).
2. Open the deploy panel, enter Guild ID, Voice Channel ID, Text Channel ID, click Deploy.
3. Verify the bot joins the VC and speaks the greeting.
4. Speak in VC → bot replies.
5. `@mention` the bot in the text channel → bot replies.
6. End the deploy → both surfaces stop responding.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api.ts web/src/components/Deploy/DiscordDeployPanel.tsx
git commit -m "feat(web): collect Text Channel ID for Discord deploy"
```

---

## Self-Review Checklist (run before handoff)

- ✅ **Spec coverage:**
  - Voice receive loop → Task 4.
  - Open mic + turn lock → `state.speaking` in Task 2 + check in Task 4.
  - Text mention handler → Task 5.
  - Active-deploy gating for mentions → `deploys.get(guildId)` check in Task 5.
  - Session reuse → `startSession` in Task 1, threaded through Tasks 2-5.
  - `textChannelId` capture & propagation → Tasks 1, 2, 6.
  - Reply truncation at 2000 chars → Task 5 (1900 + " …").
  - `MessageContent` intent → Task 2 (+ portal-toggle note).
  - Stopword / min-duration filtering → Task 4 (`STOPWORDS`, `MIN_PCM_BYTES`).
- ✅ **No placeholders.** All code is concrete.
- ✅ **Type consistency.** `state.sessionId` (string) used identically across tasks; `agentReply`/`transcribePcm` signatures stable.
- ✅ **Spec scope held.** No wake-word, no interruption, no DM support, no per-user metering — all explicitly out-of-scope and not added back.

---

## Done criteria

- Voice channel: open mic, single-turn lock, bot replies in voice within ~5s.
- Text channel: `@mention` → text reply within ~3s.
- Both surfaces stop on `/undeploy`.
- Type checks clean for `server`, `discord-bot`, `web`.
