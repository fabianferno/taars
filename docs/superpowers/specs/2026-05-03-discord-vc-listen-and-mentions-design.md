# Discord VC Two-Way Voice + Text Mentions

Date: 2026-05-03
Surface: `discord-bot/src/index.ts` (extended in place)

## Goal

Make a deployed taars agent in Discord conversational on two surfaces:

1. **Voice channel:** open mic — anyone speaks, the bot transcribes via Whisper, generates an agent reply via the existing `/chat/message` endpoint, and speaks the reply back through the existing OpenVoice TTS pipeline.
2. **Text channel:** when a user `@mentions` the bot in any channel of a guild that currently has an active deploy, the bot replies with a text-only message in the same channel.

Billing is unchanged: minutes-in-VC continue to meter the deploy. Text mentions are free within the deploy window. There is no separate per-message billing.

## Non-goals

- Wake words or "Hey <name>" prefix.
- Interrupting the bot mid-reply (bot holds the floor until done).
- Multi-turn memory beyond what the existing chat session already provides.
- DM support.
- Per-user metering inside a VC.

## Architecture

```
Discord VC ── Opus packets ──> discord-bot ── PCM/WAV ──> server /chat/transcribe ──> OpenAI Whisper
                                    │
                                    └── transcript ──> server /chat/message ──> agent reply text
                                                                                      │
                                                                                      ▼
                                                              OpenVoice /synthesize ──> WAV
                                                                                      │
                                                                                      ▼
Discord VC <── Opus packets ── playInGuild() (existing)

Discord text channel ── @mention event ──> discord-bot ──> /chat/message ──> message.reply()
```

All STT and LLM calls flow through the existing `server` so auth, billing, and prompt assembly stay in one place. The bot is a thin adapter.

## Components

### 1. DeployState additions

```ts
interface DeployState {
  // existing fields ...
  textChannelId: string;   // NEW: where mention replies post; also scopes mention handling
  sessionId: string;       // NEW: reused for transcribe + message x402-gated calls
  speaking: boolean;       // NEW: turn-lock; true while bot is generating or playing
  receiver: any | null;    // NEW: connection.receiver handle
}
```

### 2. `/deploy` request body

Add `textChannelId` (required) and promote `sessionId` from optional to required. The web `DiscordDeployPanel` already has both available — channel from the channel picker, session from the active chat session.

### 3. Voice receive loop (added inside `joinVc` after Ready)

- Take `connection.receiver`, store on `state.receiver`.
- Listen on `receiver.speaking.on('start', userId => ...)`.
- On a fresh speaker, if `state.speaking` is false:
  - `receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 } })`
  - Pipe through `prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 })` into a buffer.
  - On stream end, drop if PCM duration < 300ms.
  - Wrap PCM (48kHz, stereo, s16le) with a minimal WAV header.
  - POST as multipart `audio` to `${SERVER_URL}/chat/transcribe` with `x-session-id: state.sessionId`.
  - If transcript is empty / matches a stopword regex (`^(uh|um|hmm|ah|\.+)$`), drop.
  - Set `state.speaking=true`, POST the transcript to `/chat/message`, await reply text, call existing `playInGuild(guildId, replyText)`, then `state.speaking=false`.
- Errors (transcribe 4xx/5xx, LLM error) are logged and `speaking` is reset; do not crash the loop.

### 4. Text mention handler (added inside `initDiscord`)

- Add `GuildMessages` and `MessageContent` intents. (`MessageContent` is privileged — must be toggled in the Discord developer portal.)
- `client.on('messageCreate', async (message) => { ... })`:
  - Ignore bots and self.
  - Require `message.guildId` present in `deploys`.
  - Require `message.mentions.has(client.user)`.
  - Strip the bot mention token from `message.content`; trim. If empty, ignore.
  - POST stripped text to `/chat/message` using the deploy's `sessionId`.
  - `message.reply(replyText)`. If reply > 2000 chars, truncate with an ellipsis.

### 5. Server-side reuse

No new server endpoints. The existing `/chat/transcribe` and `/chat/message` are reused as-is. Both already accept a session via the x402 middleware; the bot passes `state.sessionId` on every call.

## Data flow: a single voice turn

1. User starts speaking in VC.
2. Bot opens an Opus subscription for that user with 1s silence end-behavior.
3. User pauses for ≥1s → stream ends → bot has raw PCM.
4. Bot wraps PCM into a WAV, posts to `/chat/transcribe` with the session.
5. Server returns `{ text: "..." }`.
6. Bot posts `{ message: text }` to `/chat/message` with the session.
7. Server returns the agent reply.
8. Bot calls `playInGuild()`, which synthesizes via OpenVoice and plays in the VC.
9. `speaking` lock releases; next speaker can be heard.

## Error handling

| Failure                                  | Behavior                                                       |
| ---------------------------------------- | -------------------------------------------------------------- |
| Whisper returns empty                    | Drop silently, no reply.                                       |
| Whisper 4xx/5xx                          | Log; release lock; do not reply.                               |
| `/chat/message` 4xx/5xx                  | Log; release lock; do not reply.                               |
| OpenVoice synthesis failure              | Existing `playInGuild` already throws; we catch and log.       |
| User speaks during bot reply             | `speaking=true` causes the new stream to be dropped on `start`.|
| Mention with empty content after strip   | Ignore.                                                        |
| Reply > 2000 chars (Discord limit)       | Truncate with " …".                                            |

## Edge cases considered

- **Bot's own audio re-entering the receiver:** `speaking.on('start')` fires only for real users in `@discordjs/voice`, so this is safe.
- **Two users start speaking at the exact same moment:** both `start` events fire; the first to acquire the lock wins; the other's stream is opened but its post-transcribe path checks `state.speaking` again and drops if a reply is already underway. (Cheap double-check.)
- **`/undeploy` mid-turn:** `leaveVc` already destroys the connection; the receiver streams will end with an error which is caught.
- **Mentions in a guild where bot was undeployed seconds ago:** `deploys.has(guildId)` check prevents reply.

## Testing plan

Manual, hackathon-grade:

1. Deploy bot to a VC + pick a text channel via the web UI.
2. Speak: "What's your name?" → bot replies in voice with the agent's name.
3. While bot is speaking, try to interrupt → bot should ignore (lock).
4. Two users take turns → both get answered.
5. In any text channel of that guild, `@bot hello` → bot replies in text.
6. `@bot` in a guild with no active deploy → no reply.
7. `/undeploy` → both surfaces stop responding immediately.

## Out of scope / future

- Per-user voice metering (would need server-side billing changes).
- Wake word / push-to-talk modes.
- Streaming TTS (current pipeline is full-WAV at a time).
- Bot interruption when a user starts speaking mid-reply.
