# @taars/discord-bot

Stand-alone Node service that runs a Discord bot and exposes a tiny HTTP control
plane on `:8090`. The taars `server` package orchestrates deploys by calling
this control plane: when a taar owner taps "Deploy -> Discord VC" on the
profile page, the server invokes `POST /deploy` here, the bot joins the target
voice channel, greets the channel in the creator's cloned voice, and bills per
minute. When the deploy ends, the server calls `POST /undeploy` and settles.

## Required env

The bot loads `.env` from the repo root (`../.env` from this package).

| Name                | Required | Default                   | Notes                                           |
|---------------------|----------|---------------------------|-------------------------------------------------|
| `DISCORD_BOT_TOKEN` | no       | (none)                    | If missing, bot boots in stub mode (HTTP only). |
| `DISCORD_BOT_PORT`  | no       | `8090`                    | HTTP control plane port.                        |
| `OPENVOICE_URL`     | no       | `http://localhost:5005`   | FastAPI voice service.                          |
| `TAARS_SERVER_URL`  | no       | `http://localhost:8080`   | taars Hono server (for voice profiles + LLM).   |

Get a token from https://discord.com/developers/applications -> your app ->
Bot -> Reset Token. **Never commit the token.**

## Stub mode

If `DISCORD_BOT_TOKEN` is absent, the bot prints

```
[discord-bot] DISCORD_BOT_TOKEN missing - start in stub mode (HTTP endpoints respond 200 with a simulated deploy)
```

and the HTTP control plane still serves on `:8090`. `/deploy`, `/speak`, and
`/undeploy` all return `200` with `{ stub: true, ... }`. This lets the demo
flow run end-to-end without a real Discord setup.

## Required Discord bot intents

In the Discord developer portal -> Bot:

- `Guilds`
- `GuildVoiceStates`

`MessageContent` is **not** required — the bot only responds to HTTP triggers
from the taars server (and, optionally, slash commands in a future task).

## Required Discord permissions

The bot needs the following permissions in the target server:

- `View Channel`
- `Connect`
- `Speak`
- `Use Voice Activity`

The integer permission bitfield for those is `3145728`.

## OAuth invite URL template

```
https://discord.com/api/oauth2/authorize?client_id=<APP_ID>&permissions=3145728&scope=bot
```

Replace `<APP_ID>` with your application's Client ID (from the General
Information tab of the developer portal). Open the URL, pick a server you
manage, and authorize.

## Setup

```bash
# from the repo root
pnpm install

# typecheck
pnpm --filter @taars/discord-bot typecheck

# run the bot (uses ../.env automatically)
pnpm --filter @taars/discord-bot dev
```

If `@discordjs/opus` fails to build on your platform, install `opusscript` as
an alternative pure-JS encoder:

```bash
pnpm --filter @taars/discord-bot add opusscript
```

`@discordjs/voice` will pick up `opusscript` automatically when
`@discordjs/opus` is unavailable.

## HTTP control plane

All endpoints accept and return JSON.

### `GET /health`

```json
{ "ok": true, "deploys": 0, "discordReady": false, "stubMode": true }
```

### `POST /deploy`

Body:

```json
{
  "guildId": "111...",
  "channelId": "222...",
  "voiceId": "alice",
  "ensLabel": "alice",
  "sessionId": "optional-session-id"
}
```

Joins the voice channel, plays a greeting in the cloned voice
(`"Hi, I'm <ensLabel>'s taars replica..."`), and remembers the deploy keyed by
`guildId`. Returns `{ ok, stub, startedAt, greetingMs, ... }`.

### `POST /speak`

Body:

```json
{ "guildId": "111...", "message": "Hello, world." }
```

Synthesizes the message via OpenVoice using the active deploy's `voiceId` and
plays it back in the connected VC. Returns `{ ok, durationMs }`.

### `POST /undeploy`

Body:

```json
{ "guildId": "111..." }
```

Disconnects from the VC, clears state, and returns
`{ ok, deployedSeconds }`. The taars server uses `deployedSeconds` to settle
billing on-chain.

## Server orchestration

`server/src/routes/deploy.ts` exposes the user-facing routes. It

1. Resolves the voiceId via the `taars.voice` ENS text record.
2. Calls `POST <bot>/deploy`.
3. Tracks the deploy in memory and writes an audit log to
   `server/.audit/deploys.jsonl`.
4. On `/deploy/discord/end`, calls `POST <bot>/undeploy`, computes the
   billable seconds, and (if billing is wired up) settles using the
   `taars.deploy.discord` rate (falling back to 2.5x base).

See `server/src/routes/deploy.ts` and the project PRD for the full lifecycle.
