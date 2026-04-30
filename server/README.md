# @taars/server

Node backend (Hono) for the taars create pipeline.

## What it does

`POST /mint` orchestrates the full replica creation flow:

1. **Voice train** — uploads the user's voice sample to OpenVoice (`http://localhost:5005/clone`); returns a `voiceId`.
2. **Encrypt** — AES-256-GCM encrypts each artifact (`soul.md`, `skills.json`, `voice.json`) with `ENCRYPTION_KEY`.
3. **Storage** — uploads each encrypted blob to 0G Storage via `@0glabs/0g-ts-sdk`; collects content hashes; computes a merkle root.
4. **INFT mint** — calls `TaarsAgentNFT.mint(IntelligentData[], to)` on 0G testnet (chainId 16602).
5. **ENS subname** — `setSubnodeRecord` for `<label>.taars.eth` on Sepolia (parent owned by deployer).
6. **ENS text records** — writes `taars.inft`, `taars.storage`, `taars.price`, `taars.voice`, etc. on the Public Resolver.

`GET /health` returns service status.

## Setup

```bash
# from repo root
pnpm install
cp .env.example .env
# fill DEPLOYER_PRIVATE_KEY, ENCRYPTION_KEY, TAARS_INFT_ADDRESS, etc.
```

## Running

```bash
# start OpenVoice service (in /openvoice)
cd ../openvoice && python http_server.py   # listens on :5005

# start the Node server
pnpm --filter @taars/server dev             # listens on :8080
```

## Tests

```bash
pnpm --filter @taars/server test
```

## Required env

| Var | Purpose |
|---|---|
| `DEPLOYER_PRIVATE_KEY` | Hex key with funds on 0G testnet + Sepolia |
| `ENCRYPTION_KEY` | 32-byte hex (AES-256-GCM) |
| `SEPOLIA_RPC_URL` | Sepolia RPC for ENS |
| `OG_RPC_URL` | 0G testnet RPC |
| `OG_INDEXER_URL` | 0G Storage indexer |
| `TAARS_INFT_ADDRESS` | Deployed `TaarsAgentNFT` proxy on 0G |
| `PARENT_ENS_NAME` | `taars.eth` |
| `OPENVOICE_URL` | `http://localhost:5005` |
