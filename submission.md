# taars — ETHGlobal Open Agents submission

## Project name
taars

## Category
Artificial Intelligence

## Emoji
🧬

## Demo
- Live demo: https://0g-taars.vercel.app/
- Sample replica: https://0g-taars.vercel.app/skywalker
- Demo video: <ADD 3-MIN VIDEO LINK>
- Source: https://github.com/fabianferno/taars

## Short description (≤100 chars)
Mint yourself as an AI. Own the ENS, own the INFT, earn USDC every minute someone chats.

## Description (min 280 chars)
taars lets anyone mint a sovereign AI replica of themselves — voice, personality, and writing style — as an ERC-7857 Intelligent NFT (INFT) on 0G Chain. Each replica is identified by an ENS subname (`<you>.taars.eth`) whose text records form a structured agent manifest (`taars.inft`, `taars.storage`, `taars.voice`, `taars.price`, `taars.currency`, `taars.network`, `taars.owner`, …). Whoever owns the ENS name owns the INFT, and ownership of both moves together via an `iTransfer` ceremony.

The encrypted "soul" (system prompt), skills, and voice profile are uploaded to 0G Storage; the merkle roots become the `IntelligentData[]` on the INFT and are also published as resolver text records, so any third-party app can discover and talk to a replica purely from ENS — no private database. Voice cloning runs in an isolated OpenVoice service designed for TEE deployment so raw samples never leave the trusted boundary.

Anyone can chat or voice-call a replica. Each session is gated by a real HTTP 402 (x402) challenge, settled on a Sepolia `TaarsBilling` contract in USDC with a 90/7/3 revenue split (owner / treasury / original creator), and post-settle a KeeperHub workflow attests the on-chain revenue update so every payment has a guaranteed audit trail. A Discord bot integration deploys the replica to a server's voice channel — also lifecycle-tracked through a KeeperHub workflow.

## How it's made
**Stack.** Monorepo (pnpm) with Next.js 15 PWA (`web/`, Privy embedded wallet), a Hono server (`server/`), Hardhat contracts (`contracts/`), a Python OpenVoice service (`openvoice/`), a Discord VC bot (`discord-bot/`), an MCP server (`mcp/`), and a shared TS SDK (`sdk/`).

**0G — INFT (ERC-7857).** `TaarsAgentNFT` is a UUPS proxy implementing `IERC7857` + `IERC7857Metadata` deployed on 0G Galileo testnet (chainId 16602) at `0xD2063f53Fd1c1353113796B56c45a78A65731d52`. We use `IntelligentData[]` per token to bind `(dataDescription, dataHash)` triples to encrypted blobs, plus `iTransfer` (re-encryption ceremony) and `iClone` (licensed copies). 0G Storage uploads use the real `@0gfoundation/0g-ts-sdk` (`Indexer.upload()` + `MemData`) — see `server/src/services/storage.ts`. Each replica writes three encrypted blobs (soul / skills / voice); their merkle roots are the on-chain proof of embedded intelligence and are also pulled at chat time to decrypt the system prompt.

**ENS — identity, not cosmetics.** Parent `taars.eth` is registered on Sepolia via the v3 ETHRegistrarController commit-reveal. Subnames are created with `NameWrapper.setSubnodeRecord`, then 11 text records are written in a single `PublicResolver.multicall`, then the wrapped 1155 is `safeTransferFrom`'d to the user — so the user becomes the on-chain owner of the subname. The `/explore` and `/[ensName]` pages and the chat pipeline (`server/src/routes/chat.ts`) read agents directly from ENS (`taars.storage` to fetch the soul, `taars.price` to seed the x402 paywall). Source: `server/src/services/ens.ts`.

**KeeperHub — guaranteed execution + audit.** Three production workflows wired in `server/src/services/keeperhub.ts`:
- `billingSettle` (`9ucfocpbig3urovmnq6v9`) — fires from `server/src/services/billing.ts` after settle, reads `getRevenue` on Sepolia to attest revenue actually accrued.
- `inftTransfer` (`pgkehp9z83o3yeinkh8r2`) — fires from `server/src/services/transfer.ts` after `iTransfer`, reads `ownerOf` on 0G to confirm the new owner.
- `discordDeploy` (`49amr3waaqxy9vlw4wznn`) — fires from `server/src/routes/deploy.ts` on start + end of a Discord VC bot deploy.

Every workflow execution writes its `executionId` into `server/.audit/*.jsonl` so on-chain actions and KH runs can be cross-referenced from either side.

**x402 payments.** `/chat/message` and `/chat/transcribe` return a real HTTP 402 with the x402 challenge envelope (`scheme: "exact"`, `asset`, `network: sepolia`, `payTo`, `maxAmountRequired` derived from the ENS `taars.price` text record). Settlement on `TaarsBilling` (`0xCE5860AA731439a80F39852b6296057313831870`) → `billingSettle` KeeperHub attestation closes the loop: x402 challenge → contract settle → KH attestation as a single audit trail.

**TEE narrative (honest).** The OpenVoice service runs as an isolated process designed for TEE deployment (Phala / Marlin / Nautilus-class GPU enclave) so raw voice samples never leave the boundary; only the trained voice profile is encrypted and uploaded. In this repo it runs as a standalone HTTP service for local dev.

**Notable hacky bits.** Wrapping all 11 ENS text-record writes into a single `multicall` (one tx instead of 11). Operator pattern that mints subname → writes records → transfers wrapped 1155 in one ceremony. Treating ENS resolver text records as the canonical agent manifest so the chat pipeline has zero database dependency. Coupling x402 / on-chain settle / KeeperHub attestation into one cross-referenceable audit ID.

---

## Tech Stack answers

**Ethereum developer tools:** Hardhat, Ethers.js, viem, OpenZeppelin Contracts (UUPS), ENS (NameWrapper, PublicResolver, ETHRegistrarController v3), Privy (embedded wallets), x402.

**Blockchain networks:** 0G Galileo Testnet (chainId 16602), Ethereum Sepolia.

**Programming languages:** TypeScript, Solidity, Python.

**Web frameworks:** Next.js 15 (App Router, PWA), Hono.

**Databases:** None as primary store — ENS resolver text records + 0G Storage are the source of truth. Local JSONL audit logs (`server/.audit/`) for KeeperHub cross-reference.

**Design tools:** Tailwind CSS, shadcn/ui, Figma.

**Other heavy libs/tools:** `@0gfoundation/0g-ts-sdk` (0G Storage), KeeperHub MCP + workflows, OpenVoice (voice cloning), discord.js (VC bot + TTS), MCP SDK (taars MCP server for resolve/chat by ENS name), pnpm workspaces.

## AI tools used in the project
Claude Code (Opus 4.7) was used pair-programming-style across the stack: scaffolding the ERC-7857 contract + tests, wiring the 0G Storage upload pipeline, the ENS multicall + transfer ceremony, the x402 middleware, the KeeperHub workflow integration, and the Discord VC bot's transcribe → reply → TTS loop. OpenVoice (open-source) is the runtime AI model that generates each replica's voice profile. The replica chat itself runs against an LLM provider gated by the x402 paywall.

---

## Partner prizes applying for

### 🟣 0G — Best Autonomous Agents, Swarms & iNFT Innovations
**Why:** taars is an iNFT-native product. Each replica is a real `ERC-7857` token on 0G with `IntelligentData[]` pointing at encrypted soul / skills / voice blobs uploaded via the real `@0gfoundation/0g-ts-sdk`. We exercise `iTransfer` (re-encryption, KH-attested) and `iClone` (licensed copies). Sample minted INFT: tokenId `9` on 0G Galileo.

**Code permalinks:**
- INFT contract — `contracts/contracts/TaarsAgentNFT.sol`: https://github.com/fabianferno/taars/blob/main/contracts/contracts/TaarsAgentNFT.sol
- IERC7857 interface: https://github.com/fabianferno/taars/blob/main/contracts/contracts/interfaces/IERC7857.sol
- 0G Storage uploads — `server/src/services/storage.ts`: https://github.com/fabianferno/taars/blob/main/server/src/services/storage.ts
- iTransfer flow — `server/src/services/transfer.ts`: https://github.com/fabianferno/taars/blob/main/server/src/services/transfer.ts
- Mint tx (tokenId 9): https://chainscan-galileo.0g.ai/tx/0x4b17c8f8068a081363d00b56d365a23b85842c2be3323891c7c47ab3f76dc73d
- INFT contract on 0G Chainscan: https://chainscan-galileo.0g.ai/address/0xD2063f53Fd1c1353113796B56c45a78A65731d52

### 🌳 ENS — Best ENS Integration for AI Agents
**Why:** ENS is the agent's identity, not a label. The subname *is* the replica — owning `<label>.taars.eth` is owning the INFT, and the chat/discovery pipeline reads agents directly from ENS resolver text records (no private DB).

**Code permalinks:**
- ENS service (commit-reveal, NameWrapper, multicall, transfer) — `server/src/services/ens.ts`: https://github.com/fabianferno/taars/blob/main/server/src/services/ens.ts
- Chat pipeline reads `taars.storage` + `taars.price` from ENS — `server/src/routes/chat.ts`: https://github.com/fabianferno/taars/blob/main/server/src/routes/chat.ts
- Sample subname: https://sepolia.app.ens.domains/skywalker.taars.eth

### 🌳 ENS — Most Creative Use of ENS
**Why:** Eleven structured text records form a machine-readable **agent manifest** (`taars.inft`, `taars.storage`, `taars.voice`, `taars.price`, `taars.currency`, `taars.network`, `taars.owner`, `taars.created`, `taars.version`, plus `description` / `url` / `avatar`) all written in a single `PublicResolver.multicall`. The x402 paywall amount and the encrypted soul's storage root are both pulled live from ENS — text records are load-bearing infra, not decoration.

**Code permalinks:**
- 11-record multicall + operator transfer: https://github.com/fabianferno/taars/blob/main/server/src/services/ens.ts
- Agent discovery from ENS only — `web/` explore/[ensName] pages: https://github.com/fabianferno/taars/tree/main/web/src/app

### 🛠 KeeperHub — Best Use of KeeperHub (Focus Area 1: innovative use; Focus Area 2: x402 payments integration)
**Why:** Three real production workflows wired into the lifecycle (`billingSettle`, `inftTransfer`, `discordDeploy`) — each fires from a specific server route, reads on-chain state to attest the action actually landed, and writes `executionId`s into a JSONL audit log so every on-chain action can be cross-referenced with its KH run. The `billingSettle` workflow closes an x402 challenge → on-chain settle → KH attestation loop.

**Live execution evidence** (visible in our org's KeeperHub dashboard):

| Workflow | ID | Sample executionId | Status |
|---|---|---|---|
| `billingSettle` | `9ucfocpbig3urovmnq6v9` | `m0pqec123y9lkl5ynp3wx` · `4cc8mi4g5z1r1o0n9wmd0` | trigger ✅ → verify on Sepolia |
| `inftTransfer` | `pgkehp9z83o3yeinkh8r2` | `glbkpo2a4nhq679b6a4yp` | trigger ✅ → readOwner on 0G |
| `discordDeploy` | `49amr3waaqxy9vlw4wznn` | `ua32kdqse1nlqkiikzfot` | **fully green ✅** (both nodes succeeded) |

**Code permalinks:**
- KeeperHub service — `server/src/services/keeperhub.ts`: https://github.com/fabianferno/taars/blob/main/server/src/services/keeperhub.ts
- x402 middleware — `server/src/middleware/x402.ts`: https://github.com/fabianferno/taars/blob/main/server/src/middleware/x402.ts
- Billing fire-point — `server/src/services/billing.ts`: https://github.com/fabianferno/taars/blob/main/server/src/services/billing.ts
- Discord deploy fire-point — `server/src/routes/deploy.ts`: https://github.com/fabianferno/taars/blob/main/server/src/routes/deploy.ts
- KH smoke test — `server/scripts/test-keeperhub.ts`: https://github.com/fabianferno/taars/blob/main/server/scripts/test-keeperhub.ts

### 🔍 KeeperHub — Builder Feedback Bounty
**Why:** Honest integration notes captured live during the build (webhook URL discovery, payload-shape onboarding gaps, executionId surfacing) collected in `docs/`.

---

## Sponsor feedback (from building taars)

Specific, code-grounded notes from integrating each sponsor's stack over the
hackathon. All examples are reproducible from this repo.

### 🟣 0G

**What worked well**
- `@0gfoundation/0g-ts-sdk` `Indexer.upload(MemData, …)` is genuinely simple — three lines of TS to upload an encrypted blob and get a merkle root back. Excellent fit for INFT-style "encrypted artifact + on-chain pointer" patterns.
- ERC-7857's `IntelligentData[]` shape (description + dataHash) maps cleanly to the way we already wanted to bundle a replica (soul / skills / voice).
- 0G Galileo is EVM-compatible enough that nothing in our Hardhat / OpenZeppelin / viem toolchain needed special handling.

**Friction (reproducible)**
1. **SDK fork ambiguity.** Two TS SDKs exist with overlapping APIs: `@0glabs/0g-ts-sdk` (0.3.x) and `@0gfoundation/0g-ts-sdk` (1.2.x). The `@0glabs` one reverts on Galileo's Flow contract for some submissions; we landed on `@0gfoundation` after trial. A README pointer ("for Galileo testnet, use the `@0gfoundation` package") would save hours. Code reference: `server/src/services/storage.ts` lines 26–32.
2. **Galileo RPC receipt flakiness.** `https://evmrpc-testnet.0g.ai` regularly returns "transaction not found" for valid hashes for ~10–30s after broadcast even when the tx ultimately lands. We had to write a custom `waitForReceiptResilient` poller (`server/src/services/inft.ts` lines 66–102) that tolerates transient `not found` for up to 8 minutes. Standard `viem.waitForTransactionReceipt` fails on this. Worth either (a) documenting it or (b) fixing the indexer.
3. **iTransfer / sealed-key flow under-documented.** ERC-7857's `TransferValidityProof[]` and `PublishedSealedKey` events look like they're meant to coordinate TEE re-encryption but there's no concrete reference flow showing what to put in the proof, who signs it, and what the oracle does with the sealed key. We ended up shipping a placeholder (no proof, empty key) and pushing the re-encryption work onto KeeperHub's audit step. A reference oracle implementation would unlock the full ERC-7857 story.
4. **Storage indexer `upload()` return shape.** The `tx` object returned has `rootHash` on success but the type is loose — we ended up reading `tx.rootHash || tx.root || tx.hash` defensively. A typed return would help.
5. **0G Compute (TEE).** Documentation exists but onboarding a custom workload (we wanted to run OpenVoice in a TEE) wasn't approachable in a hackathon timebox. A "bring your own Docker image to a TEE GPU" Hello World would massively widen the funnel — right now the path looks like it's optimised for partners, not builders.

### 🌳 ENS

**What worked well**
- v3 ETHRegistrarController + NameWrapper on Sepolia is solid. We registered `taars.eth` with commit-reveal and the whole flow ran without surprises.
- Wrapped subnames as ERC-1155 tokens make the operator pattern (deployer creates → writes records → `safeTransferFrom`s to user) clean. We end up with the user as the canonical on-chain owner of `<label>.taars.eth` after one ceremony.
- `PublicResolver.multicall` lets us write 11 text records in one tx instead of 11 — concretely cut our ENS gas cost ~10× and got us under one user-facing "creating your replica…" loading state. This pattern deserves more visibility in docs.
- Sepolia ENS app (`sepolia.app.ens.domains`) is the right hackathon-grade explorer for verifying records.

**Friction**
1. **Address-zoo for v3 controllers.** ETHRegistrarController, NameWrapper, PublicResolver each have different addresses across mainnet / Sepolia / Goerli, and v2 vs v3 vs the upcoming L2 controllers. We spent ~30 minutes hunting for the "right" Sepolia v3 controller (`0xFED6a969AaA60E4961FCD3EBF1A2e8913ac65B72`) because docs surface multiple historical contracts. A canonical "Sepolia ENS v3 contract addresses" page (one source of truth) would help.
2. **`setText` from a different signer than the wrapped owner reverts silently** without a clear "you are not the wrapped owner" error. The trace just shows the call reverting in the resolver. We spent time confirming the operator was actually the wrapped owner before the message clicked.
3. **Subname rate-limits / fuses interaction.** Setting fuses on subnames isn't intuitive — we set fuses=0 and expiry=`type(uint64).max` and let the wrapper cap at parent expiry. This works but the "what fuses should I set for a hackathon project" answer isn't obvious. A recipe-style "subnames-as-agent-identity" page would help.
4. **Reverse resolution from an ENS subname back to the on-chain INFT** is currently app-side glue (parse `taars.inft` text record). A pattern (or namespaced standard) for "this ENS name = this token on this chain" would let third-party wallets render INFT-backed names natively.

### 🛠 KeeperHub

**What worked well**
- The visual workflow editor + node-based templating (`{{@trigger:Webhook.body.X}}`) is a genuinely fast way to wire on-chain post-action checks. Building three workflows took less than an hour each.
- The MCP plugin is a great DX surface — `list_workflows`, `execute_workflow`, `get_execution_status` are exactly the right primitives, and they let us script + audit from inside Claude Code without leaving the editor.
- `web3/get-transaction` and `web3/read-contract` action nodes covered every "did this tx actually land?" / "what's the on-chain state now?" need we had. No custom action code needed.
- The execution history view (with input, output, error, executionTrace per node) is the right level of detail for cross-referencing with our own server-side audit logs.

**Friction (this is also our Builder Feedback Bounty submission — see below)**
- See the dedicated section.

---

## 🔍 Builder Feedback Bounty — KeeperHub (paste this into the bounty form)

The four issues below are reproducible from this repo and were genuine
blockers / time-sinks during integration. Each one is paired with a
concrete fix suggestion.

**1. Webhook trigger auth is undiscoverable.**
The dashboard's webhook trigger node shows `https://app.keeperhub.com/api/workflows/{id}/webhook` but no Auth header shape. We tried every common pattern with our `kh_…` API key — `Authorization: Bearer kh_…`, `X-API-Key: kh_…`, query-string, `Authorization: ApiKey kh_…`. All return `401 {"error":"Invalid API key format"}`. The same `kh_…` key works fine for `GET /api/workflows/{id}` and `GET /api/workflows/{id}/executions`, so this is a webhook-vs-read key split that isn't surfaced anywhere we could find. Fix: add a "Copy webhook URL with auth" button to the trigger node that copies the full `curl` snippet, OR document the webhook-secret credential type explicitly.

**2. The 401 message hides the real cause.**
`{"error":"Invalid API key format"}` is misleading — the format isn't invalid; it's the wrong *type* of key for that endpoint. A more actionable message: `"Webhook triggers require a workflow trigger secret, not an account API key — find it under <path>"`. Saved us probably an hour.

**3. Trigger-input contract is reverse-engineered, not documented.**
`{{@trigger:<NodeLabel>.body.X}}` works but we figured this out from peeking at workflow JSON returned by the API. It also isn't obvious whether the input field name needs to match a schema (it doesn't seem to — undefined fields just template to empty string and downstream nodes fail with cryptic "missing argument" errors). Fix: per-workflow "expected input contract" panel that shows what fields downstream nodes consume from `body`, with example mock requests pre-filled (you already have `webhookMockRequest` — surface the *resolved* templating).

**4. ExecutionIds aren't deep-linkable.**
`execute_workflow` returns `{ "executionId": "ua32kdqse1nlqkiikzfot" }`. To view it I have to navigate to the workflow → executions tab → find the row. A `/executions/{id}` URL that opens directly to the trace would make audit cross-references one-click — critical for "guaranteed audit trail" being the headline pitch. Bonus: include `dashboardUrl` in the API response so SDK consumers can log it next to their own audit ID.

**5. Bonus / minor:** `triggerType: "Webhook"` workflows can't be triggered via `mcp.call_workflow` (which requires `listedSlug`). It would be tidy if MCP `execute_workflow` was the single, auth-uniform path for any workflow regardless of trigger type — that'd remove the entire webhook-secret class of friction for SDK users.

Reproduction repo: see `docs/keeperhub-executions.md` for the four real executionIds we generated while integrating, plus the exact server fire-points (`server/src/services/keeperhub.ts`, `billing.ts`, `transfer.ts`, `routes/deploy.ts`).

---

## Team
- **Fabian Ferno** — Telegram `@fabianferno` · X `@fabianferno`

## Still to add before submitting
- Logo
- Project banner
- Screenshots (see shot-list below)
- Demo video (see script below, target <3 min)
- Confirm GitHub repo URL is public and replace placeholders above if the org/repo path differs

---

## 📸 Screenshot shot-list (capture in this order)

Aim for 6–8 shots; **bolded** are the must-have ≥3 for the form. All 1600×1000 or 1920×1200, light or dark — pick one and stay consistent.

1. **Hero / landing** — `https://0g-taars.vercel.app/` — show the tagline, "mint your replica" CTA, and any featured replicas. Sets the product story.
2. **Mint flow — voice + personality step** — the recorder UI mid-recording (waveform visible) with one personality question answered. Conveys the "voice + soul" capture.
3. **Mint flow — pipeline progress** — the step list showing 0G Storage uploads → INFT mint → ENS subname created → text records written → transfer. This is the proof the multi-step ceremony actually runs.
4. **Replica profile page** — `https://0g-taars.vercel.app/skywalker` — name, avatar, per-minute price, "Chat" / "Voice call" buttons, and the ENS + INFT badges linking out to explorers.
5. **Chat with x402 paywall** — DevTools Network panel open showing the real `HTTP 402` response with the `x402` challenge envelope (`scheme: "exact"`, `asset`, `payTo`, `maxAmountRequired`) next to the chat UI. This is the headline shot for the KeeperHub + payments story.
6. **Voice call in progress** — call UI with mic on, transcript streaming, per-minute meter visible.
7. **ENS subname records** — `https://sepolia.app.ens.domains/skywalker.taars.eth` — the resolver text records panel showing all 11 `taars.*` records. Headline shot for both ENS prizes.
8. **0G explorer — INFT** — `https://chainscan-galileo.0g.ai/address/0xD2063f53Fd1c1353113796B56c45a78A65731d52` and the mint tx for tokenId 9. Proof of contract deployment + minted iNFT.
9. *(Optional)* **KeeperHub dashboard** — the three workflows (`billingSettle`, `inftTransfer`, `discordDeploy`) with recent successful executions.
10. *(Optional)* **Discord bot live in a VC** — server view with the bot connected to a voice channel and a transcribed reply in the text channel.

**Project banner suggestion:** wide (1500×500) — tagline "Your AI Replica. Your Identity. Your Rules." with a stylised ENS name `<you>.taars.eth` and the 0G + ENS + KeeperHub partner marks across the bottom.

---

## 🎬 Demo video script (target 2:45)

Record 1080p, screen + mic. Narration in **bold**, on-screen actions in *italics*. Cuts noted with `→`.

### 0:00–0:15 · Cold open + hook
*Open on landing page hero.*
**"Most AI replicas live in someone else's database. taars makes yours a sovereign on-chain asset — an ERC-7857 INFT on 0G, identified by an ENS name you own, with per-minute payments settled on-chain and attested by KeeperHub. Let me show you in two minutes."**

### 0:15–0:55 · Mint a replica (the ceremony)
→ *Click "Create replica". Walk through: name → record 10s of voice → answer two personality questions → submit.*
**"I'm minting `obiwan.taars.eth`. Voice samples go to an isolated OpenVoice service — designed to run inside a TEE so raw audio never leaves the boundary. Only the trained voice profile is encrypted and uploaded."**
→ *Pipeline progress UI streams steps.*
**"Soul, skills, and voice are encrypted, uploaded to 0G Storage — each blob returns a merkle root. Those roots become the `IntelligentData` array on a real ERC-7857 token minted on 0G Chain. Then we register the ENS subname, write eleven structured text records in a single multicall, and transfer the wrapped name to my wallet. ENS ownership and INFT ownership are now the same thing."**

### 0:55–1:20 · ENS as agent identity
→ *Open `sepolia.app.ens.domains/skywalker.taars.eth` records panel.*
**"This is what makes ENS structural, not cosmetic. `taars.inft` points at the 0G token. `taars.storage` is the merkle root of the encrypted soul. `taars.price` is the per-minute rate. Any third-party app can discover and talk to a replica entirely from these records — there is no private database."**

### 1:20–2:00 · Chat with x402 + KeeperHub
→ *Back to the replica's `/skywalker` page. Open DevTools Network panel. Click "Chat", send a message.*
**"First request returns a real HTTP 402 — the x402 challenge envelope, with `payTo`, `asset` USDC, and `maxAmountRequired` derived live from the ENS `taars.price` record. I authorise the session, settlement lands on the Sepolia `TaarsBilling` contract — 90/7/3 split between the INFT owner, treasury, and the original creator."**
→ *Reply streams in. Switch to KeeperHub dashboard.*
**"Post-settle, the `billingSettle` KeeperHub workflow fires, reads `getRevenue` on-chain, and writes its execution ID into our audit log. Same pattern for `inftTransfer` after an `iTransfer` and `discordDeploy` for the live bot. Every on-chain action has a guaranteed, cross-referenceable audit trail."**

### 2:00–2:30 · Voice call + Discord deploy (the "wow")
→ *Start a voice call with the replica. Show the per-minute meter ticking.*
**"Same paywall, same settlement — billed by the minute."**
→ *Cut to a Discord server, bot in a VC, replying with TTS.*
**"And because it's all addressable by ENS, I can deploy the same replica into a Discord voice channel. The bot listens, transcribes, replies in the cloned voice, and every deploy is lifecycle-tracked through KeeperHub."**

### 2:30–2:45 · Close
→ *Cut to a slate: contract addresses, ENS, GitHub, team handle.*
**"taars — your AI replica, your identity, your rules. ERC-7857 on 0G, ENS-native identity, x402 + KeeperHub for guaranteed paid execution. Repo and live demo in the description. Thanks."**

### Recording checklist
- Pre-fund the demo wallet with Sepolia ETH + MockUSDC and 0G testnet gas.
- Pre-mint a "fresh-looking" replica off-camera so the pipeline timing isn't a bottleneck if the live mint stalls.
- Have DevTools Network panel pre-opened with the `402` filter ready.
- Have the KeeperHub dashboard pre-logged-in in another tab.
- Have the Discord server + bot pre-deployed and the VC pre-joined.
- Keep total runtime under 3:00 — the prize requirement is hard.
