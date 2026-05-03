# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

pnpm workspace monorepo. Packages: `web/` (Next.js 15 PWA), `server/` (Hono backend), `contracts/` (Hardhat), `sdk/` (shared TS types + ABIs), `mcp/` (MCP server), `discord-bot/`. Plus `openvoice/` (standalone Python service, not part of pnpm workspace).

## Commands

Root scripts (run from repo root):

```bash
pnpm install
pnpm dev                              # web + server in parallel
pnpm web:dev                          # Next.js on :3030
pnpm server:dev                       # Hono on :8080 (tsx watch)
pnpm contracts:compile
pnpm contracts:test
pnpm contracts:deploy:0g              # needs DEPLOYER_PRIVATE_KEY
pnpm sdk:abi                          # regenerate ABIs in sdk/ after contract changes
```

Server-specific:

```bash
pnpm --filter @taars/server typecheck
pnpm --filter @taars/server test                     # vitest run
pnpm --filter @taars/server exec vitest run path/to/file.test.ts   # single test file
pnpm --filter @taars/server exec tsx scripts/test-keeperhub.ts     # KeeperHub smoke test
```

Web lint uses prettier: `pnpm --filter @taars/web lint`. There is no test suite in `web/`.

OpenVoice service (separate process, Python): `cd openvoice && python http_server.py` → :5005. Designed to be deployed inside a TEE in production; raw voice samples never cross the boundary.

## Architecture (the parts that span files)

Three independent chains/networks are coordinated per replica. When changing one, check the others:

1. **0G Galileo Testnet (chainId 16602)** — `TaarsAgentNFT` (ERC-7857 INFT, UUPS proxy) holds `IntelligentData[]` of `(description, dataHash)` triples. The hashes are merkle roots returned by 0G Storage uploads.
2. **0G Storage** — `server/src/services/storage.ts` uses `@0gfoundation/0g-ts-sdk` `Indexer.upload()` with `MemData`. Each replica writes three encrypted blobs: `soul.md`, `skills.json`, `voice.json`. Encryption: `server/src/services/encrypt.ts` (AES via `ENCRYPTION_KEY`).
3. **Sepolia ENS** — `server/src/services/ens.ts` writes 11 text records via `PublicResolver.multicall`, then `safeTransferFrom`s the wrapped 1155 subname to the user. Text records are **load-bearing**, not cosmetic: `taars.storage` is read at chat time to decrypt the soul; `taars.price` seeds the x402 paywall; `taars.inft` points back at 0G. Discovery (`/explore`, `/[ensName]`) resolves directly from ENS, not a private DB.
4. **Sepolia billing** — `TaarsBilling` + `MockUSDC` with a fixed 90/7/3 split (owner / treasury / original creator). The owner is verified against canonical 0G `ownerOf`, so revenue follows INFT transfers.

The **mint pipeline** (server/src/routes/mint.ts → services/storage, encrypt, inft, ens) is one ceremony spanning all four. The **transfer flow** (`iTransfer` re-encryption) is orchestrated and KeeperHub-attested.

### KeeperHub attestation

Three workflows wired in `server/src/services/keeperhub.ts`. Each fires from a different code path:

- `billingSettle` — fired post-settle in `server/src/services/billing.ts`; calls `getRevenue` on Sepolia.
- `inftTransfer` — fired post-`iTransfer` in `server/src/services/transfer.ts`; calls `ownerOf` on 0G.
- `discordDeploy` — fired at start + end in `server/src/routes/deploy.ts`.

Audit trail: every workflow execution writes `executionId` into `server/.audit/{sessions,deploys,transfers}.jsonl` so on-chain actions and KH runs cross-reference. When adding a new lifecycle hook, follow the same pattern.

### x402 paywall

`server/src/middleware/x402.ts` returns real **HTTP 402** with the x402 challenge envelope on `/chat/message` and `/chat/transcribe`. `maxAmountRequired` is derived from the agent's ENS `taars.price` text record — not a config constant. Settlement: client pays on `TaarsBilling`, then `billingSettle` KH workflow attests. Don't bypass this for "test mode"; flow expects 402 → settle → KH.

### Chat path

`server/src/routes/chat.ts`: resolve ENS → fetch `taars.storage` → pull encrypted blob from 0G Storage → decrypt with `ENCRYPTION_KEY` → use as system prompt. Sessions stored via `services/sessions.ts`. LLM calls in `services/llm.ts`.

### SDK

`sdk/` exports shared types + contract ABIs. After changing contracts, run `pnpm sdk:abi` so `web/` and `server/` see new ABIs.

## Conventions worth knowing

- Server is ESM (`"type": "module"`). Use `tsx` for scripts; relative imports need `.js` extensions in TS source.
- Server runtime is Node (Hono on `@hono/node-server`), not edge.
- Wallet ops use `viem` + `ethers` mixed. `services/inft.ts`, `transfer.ts`, `billing.ts` use `ethers` (because of contract proxy + typechain ergonomics); HTTP-side code tends to use `viem`.
- Web uses Privy embedded wallet (`@privy-io/react-auth`) + `wagmi` for read calls.
- Operator pattern: the deployer key (`DEPLOYER_PRIVATE_KEY`) creates ENS subnames and mints INFTs, then transfers ownership to the user. The deployer is not the long-term owner.

## Env

`.env.example` is canonical. Required for full pipeline: `DEPLOYER_PRIVATE_KEY`, `NEXT_PUBLIC_PRIVY_APP_ID`, `ENCRYPTION_KEY`, `TAARS_INFT_ADDRESS`, `TAARS_BILLING_ADDRESS`, `MOCK_USDC_ADDRESS`, `KEEPERHUB_WEBHOOK_BASE`, `KEEPERHUB_API_KEY`, `DISCORD_BOT_TOKEN`. Contract deploy writes proxy address to `contracts/deployments/og-testnet.json`.

## When changing contracts

1. Edit Solidity in `contracts/contracts/`.
2. `pnpm contracts:compile && pnpm contracts:test`.
3. `pnpm sdk:abi` to regenerate ABIs consumed by `web/` and `server/`.
4. If deploying: `pnpm contracts:deploy:0g` (or `deploy:billing` for Sepolia) — updates `contracts/deployments/*.json`. Update `.env` addresses if they changed.
