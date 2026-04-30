# taars

> Your AI Replica. Your Identity. Your Rules.

Creator-owned AI replicas — INFT on 0G Chain, ENS identity on Sepolia, voice cloning via OpenVoice.

See [`prd.md`](./prd.md) for the full product spec.

## Layout

```
taars/
├── web/              # Next.js 15 PWA (frontend + Privy embedded wallet)
├── server/           # Node Hono backend (mint orchestration: voice → encrypt → 0G → INFT → ENS)
├── contracts/        # Hardhat ERC-7857 INFT (TaarsAgentNFT, UUPS upgradeable, on 0G testnet)
├── sdk/              # Shared TS types + ABIs
├── openvoice/        # Python OpenVoice service (voice cloning + TTS)
├── backend/          # Python Pipecat voice agent runtime (Plan 2)
├── browser/          # Browser automation (Plan 2+)
└── caas-project-reference/   # Reference patterns we ported from
```

## Setup

```bash
pnpm install
cp .env.example .env
# fill DEPLOYER_PRIVATE_KEY, NEXT_PUBLIC_PRIVY_APP_ID, ENCRYPTION_KEY, etc.
```

## Build & test

```bash
pnpm contracts:compile        # Hardhat compile
pnpm contracts:test           # 5 tests on TaarsAgentNFT
pnpm sdk:abi                  # generate ABIs into sdk/src/abi from contracts artifacts
pnpm --filter @taars/server typecheck
pnpm --filter @taars/server test
```

## Run

```bash
# 1. OpenVoice (requires its own Python venv + checkpoints in openvoice/checkpoints_v2/)
cd openvoice && python http_server.py        # :5005

# 2. Node server
pnpm server:dev                                # :8080

# 3. Frontend
pnpm web:dev                                   # :3000
```

## Deploy contracts

```bash
DEPLOYER_PRIVATE_KEY=0x... pnpm --filter @taars/contracts deploy:0g
# updates contracts/deployments/og-testnet.json with the proxy address
# copy that into .env as TAARS_INFT_ADDRESS and NEXT_PUBLIC_TAARS_INFT_ADDRESS
```

## Bounty targets

- **0G** — Compute (Plan 2) + Storage + INFT (ERC-7857)
- **ENS** — subnames + text records (`taars.eth`)
- **KeeperHub** — billing + transfer orchestration + Discord deploy + MCP plugin (Plan 2/3)
