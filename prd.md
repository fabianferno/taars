# taars

**Your AI Replica. Your Identity. Your Rules.**

Creator-owned AI replicas — powered by 0G, ENS, and KeeperHub.

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [Architecture](#architecture)
5. [Technology Stack](#technology-stack)
6. [User Flow](#user-flow)
7. [Featured taars & Explore](#featured-taars--explore)
8. [Monetization — Per-Minute Billing via x402 + KeeperHub](#monetization)
9. [ENS Integration — Agent Identity Layer](#ens-integration)
10. [0G Integration — AI Infrastructure](#0g-integration)
11. [INFT (ERC-7857) — Ownable AI Replicas](#inft-integration)
12. [KeeperHub Integration — Execution & Reliability Layer](#keeperhub-integration)
13. [Voice Output — Replicas That Speak](#voice-output)
14. [Multi-Platform Deployment](#multi-platform-deployment)
15. [Revenue Sharing](#revenue-sharing)
16. [Smart Contract Architecture](#smart-contract-architecture)
17. [Data Flow Diagram](#data-flow-diagram)
18. [Hackathon Scope](#hackathon-scope)
19. [Bounty Targets](#bounty-targets)
20. [Demo Script](#demo-script)

---

## Overview

taars is a creator-owned AI replica platform. Anyone can mint an AI replica of themselves — voice, knowledge, personality — using 0G's decentralized AI infrastructure. The raw training data is processed inside TEE-backed compute and destroyed. The resulting replica is minted as an INFT (Intelligent NFT, ERC-7857) on 0G Chain, stored encrypted on 0G Storage, and discoverable via an ENS subname on Base.

Identity is handled by ENS itself: whoever owns `alice.taars.eth` owns the replica. The ENS name *is* the agent address. INFT ownership and ENS ownership move together.

Per-minute billing, revenue distribution, INFT transfers, and external platform deploys are orchestrated by KeeperHub — the guaranteed onchain execution layer.

**One-liner for the demo:** *"I just created an AI replica of myself. It lives at alice.taars.eth. My raw data was processed in a TEE and destroyed. I own my digital mind as an INFT. Anyone can pay per minute to talk to it, and the revenue lands in my wallet — guaranteed by KeeperHub."*

---

## The Problem

Every existing "digital clone" platform (Delphi, Character.ai, etc.) has the same fundamental issues:

1. **You surrender your most intimate data.** Voice recordings, personal writing, conversation history — uploaded to a company's servers. You just trust them.
2. **You don't own your replica.** The platform owns the model. If they shut down, your digital mind disappears. You can't transfer, sell, or license it.
3. **No verifiable privacy.** There's no cryptographic proof of what happened to your data. "We take privacy seriously" is the best you get.
4. **No portable identity.** Your replica is locked inside one platform. It can't be discovered, addressed, or interacted with from outside.
5. **No native monetization.** If your replica is valuable, the platform captures the upside. Revenue, royalties, and resale happen off-chain at the platform's discretion.

---

## The Solution

taars flips every one of these problems:

| Problem | taars Solution |
|---|---|
| Data surrender | Raw data processed in 0G Compute (TEE-backed), then destroyed. Verifiable computation proofs. |
| No ownership | Replica minted as an INFT (ERC-7857) — transferable, sellable, licensable. |
| No verifiable privacy | TEE attestation + 0G Storage merkle proofs on-chain. Cryptographic evidence. |
| No portable identity | ENS subname (`alice.taars.eth`) with text records pointing to INFT, storage, price, and voice config. |
| No native monetization | Per-minute x402 payments via KeeperHub. 90% to INFT owner, on-chain, guaranteed. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       TAARS WEB APP (PWA)                       │
│                Next.js 14 + Privy Embedded Wallet               │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐ │
│  │  Record  │  │  Personality  │  │   Chat    │  │  Manage   │ │
│  │  Voice   │  │  Questions    │  │   With    │  │  Your     │ │
│  │  Samples │  │  + Content    │  │  Replicas │  │  INFT     │ │
│  └─────┬────┘  └──────┬───────┘  └─────┬─────┘  └─────┬─────┘ │
│        │              │                │              │        │
└────────┼──────────────┼────────────────┼──────────────┼────────┘
         │              │                │              │
    ┌────▼──────────────▼────┐     ┌─────▼────┐   ┌────▼─────┐
    │     0G COMPUTE (TEE)   │     │  0G      │   │  ENS     │
    │                        │     │  COMPUTE │   │  (Base)  │
    │  Fine-tune voice model │     │  (Infer) │   │          │
    │  Generate embeddings   │     │          │   │  Resolve │
    │  Build personality cfg │     │  Run the │   │  name →  │
    │  Destroy raw data      │     │  replica │   │  INFT →  │
    │  Sign attestation      │     │          │   │  storage │
    └────────────┬───────────┘     └──────────┘   └──────────┘
                 │
    ┌────────────▼────────────┐
    │     0G STORAGE          │
    │                         │
    │  Encrypted model weights│
    │  Voice embeddings       │
    │  Personality config     │
    │  Knowledge index        │
    │                         │
    │  Returns: merkle root   │
    └────────────┬────────────┘
                 │
    ┌────────────▼────────────┐         ┌────────────────────────┐
    │   0G CHAIN (EVM)        │         │   BASE                 │
    │                         │         │                        │
    │  INFT (ERC-7857) mint   │◄────────┤  ENS L2 subnames       │
    │  Encrypted metadata     │         │  (taars.eth/*)         │
    │    → points to storage  │         │                        │
    │  Owner-only decryption  │         │  USDC (x402 payments)  │
    │                         │         │  Billing contract      │
    └─────────────────────────┘         │  Revenue treasury      │
                                        └────────────┬───────────┘
                                                     │
                                        ┌────────────▼───────────┐
                                        │   KEEPERHUB MCP        │
                                        │                        │
                                        │  • x402 settlement     │
                                        │  • Revenue distribution│
                                        │  • INFT transfer flow  │
                                        │  • Discord deploy life │
                                        │  • taars MCP plugin    │
                                        └────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 PWA + TailwindCSS + shadcn/ui | Installable web app, mobile-first, no app-store gatekeepers |
| **Auth / Wallet** | Privy (email/social → embedded wallet on Base) | Frictionless onboarding for non-crypto users |
| **Identity** | ENS subnames under `taars.eth` (Base L2) | Human-readable agent name, discovery, metadata via text records |
| **AI Compute** | 0G Compute Network | TEE-backed fine-tuning of voice/personality model. Verifiable. |
| **Storage** | 0G Storage (TypeScript SDK) | Encrypted, decentralized storage for model artifacts. Merkle-verified. |
| **Ownership** | 0G INFTs / ERC-7857 | Replica as a transferable, encrypted AI asset on 0G Chain |
| **Execution layer** | KeeperHub MCP | Guaranteed onchain execution: billing, settlement, transfers, deploys |
| **Payments** | x402 protocol on Base (USDC) | Per-minute payments, settled by KeeperHub |
| **External deploy** | Discord.js (live) | Replica joins Discord VCs as a voice bot |

---

## User Flow

### Creating a Replica

```
Step 1:  Open taars.app (PWA, installable on phone or desktop)
Step 2:  Sign in with Privy (email/Google → embedded wallet on Base)
Step 3:  Choose your ENS subname → alice.taars.eth
Step 4:  Record 60 seconds of voice samples
Step 5:  Answer 10 personality questions
Step 6:  (Optional) Upload writing samples, social media export, docs
Step 7:  Tap "Forge My taar"
Step 8:  Pay creation fee in USDC (Privy embedded wallet, one tap)
         ↓
    [BACKEND PROCESSING]
         ↓
Step 9:  Raw data → 0G Compute (TEE)
         - Fine-tune lightweight voice model
         - Generate speaker embeddings
         - Build personality config + system prompt
         - Destroy raw inputs
         - Sign attestation proof
Step 10: Encrypted model artifacts → 0G Storage
         - Returns merkle root hash
Step 11: Mint INFT on 0G Chain (ERC-7857)
         - Encrypted metadata → points to 0G Storage root
         - Only owner can decrypt
Step 12: Register ENS subname on Base
         - Set text records (INFT ID, storage root, price, avatar, etc.)
Step 13: Replica is LIVE
         - Accessible at alice.taars.eth
         - Chat/voice interface available in the web app
         - Reachable via taars MCP from any agent framework
```

### Interacting with a Replica

```
Step 1: Search or enter an ENS name (alice.taars.eth)
Step 2: App resolves ENS → reads text records
Step 3: Fetch INFT metadata from 0G Chain
Step 4: If authorized: decrypt model config from 0G Storage
Step 5: Route chat/voice to 0G Compute for inference
Step 6: x402 per-minute billing meter starts (KeeperHub MCP)
Step 7: Replica responds in Alice's voice/personality
Step 8: On session end, KeeperHub settles: 90% to owner, 7% platform, 3% royalty
```

### Transferring a Replica

```
Step 1: Owner initiates transfer in the web app
Step 2: KeeperHub MCP orchestrates the multi-step ERC-7857 transfer:
         a. Pull encrypted metadata from 0G Storage
         b. Send to TEE oracle, re-encrypt for new owner key
         c. Upload re-encrypted blob → new merkle root
         d. Update INFT pointer on 0G Chain
         e. Transfer ENS subname on Base (or release)
         If any step fails: retry, then refund. Audit-logged on-chain.
Step 3: New owner gets full access — can decrypt and use the replica
```

---

## Featured taars & Explore

### Home Page — Instant "Aha" Moment

The home screen isn't empty. On first launch, users see **featured taars** — recognizable names they can talk to immediately. This drives engagement before the user even creates their own replica.

#### Featured taars (Launch Set)

| Name | ENS | Why They're Featured |
|---|---|---|
| **Vitalik Buterin** | `vitalik.taars.eth` | Ethereum creator — trained on public writings, talks, blog posts |
| **Donald Trump** | `trump.taars.eth` | Viral appeal — everyone wants to argue with the replica |
| **Fabian Ferno** | `fabian.taars.eth` | Team member / builder — dogfooding the product |
| **Balaji Srinivasan** | `balaji.taars.eth` | Crypto thought leader — trained on Network State content |

These are trained on **publicly available** content only (blog posts, talks, interviews, books) — no private data. They serve as demo replicas that showcase the product's capabilities.

### Explore Page

The Explore page is the discovery engine for all taars. It uses ENS as the backend — every listed replica is resolved from its ENS subname.

**Features:**
- **Search by ENS name** — type `vitalik` → resolves `vitalik.taars.eth` → shows profile
- **Categories:** Trending, New, Top Rated, Most Minutes, By Topic
- **Filters:** Price range (per-minute rate), language, expertise domain
- **Profile cards** show: ENS name, avatar, description, per-minute rate, total minutes served
- **One-tap call** — tap a card → start a session → billing starts automatically

---

## Monetization

### The Model

When someone interacts with a taar, they pay **per minute** in USDC on Base. Payment is settled via the **x402 protocol**, with **KeeperHub MCP** guaranteeing onchain execution.

The taar owner sets their per-minute rate. The caller pays. Revenue flows to the INFT owner's wallet, with KeeperHub handling the split.

### How x402 Per-Minute Billing Works

```
CALLER                     TAARS SERVER                 KEEPERHUB MCP
  │                              │                            │
  │  1. "Talk to vitalik         │                            │
  │      .taars.eth"             │                            │
  │  ──────────────────────────> │                            │
  │                              │                            │
  │  2. Server returns 402       │                            │
  │     Payment Required         │                            │
  │     price: $0.10/min         │                            │
  │     payTo: owner wallet      │                            │
  │     network: Base            │                            │
  │  <────────────────────────── │                            │
  │                              │                            │
  │  3. Caller approves payment  │                            │
  │     (Privy embedded wallet)  │                            │
  │  ──────────────────────────> │                            │
  │                              │                            │
  │  4. KeeperHub starts session │                            │
  │     billing meter            │                            │
  │     (audit-logged onchain)   │  ────────────────────────> │
  │                              │                            │
  │  5. Session active           │                            │
  │     ... N minutes pass ...   │                            │
  │                              │                            │
  │  6. Caller ends session      │                            │
  │  ──────────────────────────> │                            │
  │                              │                            │
  │  7. KeeperHub settles:       │                            │
  │     N min × $0.10 = total    │                            │
  │     - 90% → INFT owner       │                            │
  │     - 7%  → platform treasury│                            │
  │     - 3%  → creator royalty  │                            │
  │     Guaranteed onchain exec  │  <──────────────────────── │
  │                              │                            │
  │  8. Final receipt to caller  │                            │
  │  <────────────────────────── │                            │
  │                              │                            │
```

### Payment Details

| Aspect | Implementation |
|---|---|
| **Currency** | USDC on Base |
| **Pricing** | Per-minute, set by the taar owner (stored in registry contract + ENS text record) |
| **Free trial** | None — first minute is paid |
| **Payment flow** | x402 protocol — caller's wallet pays to escrow, KeeperHub settles on session end |
| **Platform fee** | 7% of each session goes to taars treasury |
| **Creator royalty** | 3% to original creator (enforced even after INFT transfer) |
| **Settlement** | KeeperHub MCP — guaranteed onchain execution with retry + audit trail |
| **Network** | Base (primary) |

### Revenue Split

```
Per-minute rate: $0.10 (example)

$0.10 per minute × N minutes
  ├── 90% → INFT Owner
  ├── 7%  → taars Platform Treasury
  └── 3%  → Original Creator Royalty Pool
```

### Pricing Tiers (Suggested Defaults)

| Tier | Per-Minute Rate | Who |
|---|---|---|
| **Free** | $0.00 | Team demos, owner-funded promotional sessions |
| **Standard** | $0.05 | Most individual taars |
| **Premium** | $0.10 – $0.25 | Popular creators, experts, thought leaders |
| **Custom** | Owner sets price | Enterprise, VIP, specialized knowledge |

### ENS Text Records for Pricing

The per-minute rate is stored in the ENS text records, making it discoverable:

| Record Key | Value | Purpose |
|---|---|---|
| `taars.price` | `0.10` | Per-minute rate in USD |
| `taars.currency` | `USDC` | Accepted currency |
| `taars.network` | `base` | Settlement network |

This means any app resolving the ENS name can also show the price — full composability.

---

## ENS Integration

### Why ENS Is Structural (Not Cosmetic)

ENS is the **namespace, identity, and discovery layer** for the entire taars ecosystem. Without it, replicas are just hex addresses and token IDs. With it, every replica has a human-readable, portable, composable identity.

Whoever owns `alice.taars.eth` owns the replica. The ENS name is the agent address — every other piece of state (INFT, storage, price, voice config) hangs off the name.

### Subname Registration

When a user creates their replica, taars mints an ENS subname under the parent `taars.eth`:

```
alice.taars.eth
bob.taars.eth
satoshi.taars.eth
```

This happens on Base (L2) for gas efficiency — the ENS bounty specifically calls out L2 subnames as a strong pattern.

### Text Records as Agent Metadata

Each subname's text records store everything needed to discover and interact with the replica:

| Record Key | Value | Purpose |
|---|---|---|
| `taars.inft` | `0g:chain:tokenId` | Points to the INFT on 0G Chain |
| `taars.storage` | `0g:storage:merkleRoot` | Points to encrypted model on 0G Storage |
| `taars.created` | Unix timestamp | When the replica was forged |
| `taars.version` | Model version string | Which training pipeline version was used |
| `taars.price` | `0.10` | Per-minute rate in USD |
| `taars.currency` | `USDC` | Accepted payment currency |
| `taars.network` | `base` | Settlement chain |
| `taars.voice` | Voice profile hash | Reference to voice embedding config |
| `taars.deploy.discord` | `0.25` | Per-minute rate for Discord deploys |
| `avatar` | IPFS/0G URI | Profile image for the replica |
| `description` | String | Bio / personality summary |
| `url` | `https://taars.app/alice` | Direct link to chat with the replica |

### Discovery & Composability

Any app can resolve `alice.taars.eth`, read the text records, find the INFT, and build their own interface to the replica. taars creates an open protocol, not a walled garden.

Other use cases enabled by ENS:

- **Portable identity:** If Alice moves to a different frontend, her ENS name and records go with her. The name points to the INFT and storage — not to the taars app.
- **Agent framework integration:** A LangChain/Eliza/CrewAI agent can call any taar by ENS name through the taars MCP plugin — pay per minute via x402, no SDK lock-in.
- **Reputation accrual:** Ratings, total minutes served, and uptime are written into text records by KeeperHub on a schedule. Reputation lives on-chain at the name.

### ENS Bounty Alignment

The ENS bounty at this hackathon explicitly asks for:

> "ENS as identity mechanism for one or more AI agents — resolving addresses, storing metadata, gating access, enabling discovery, or coordinating agent-to-agent interaction."
> "Go beyond name → address lookups. Store credentials/zk proofs in text records, privacy features, subnames as access tokens, etc."

taars hits every one of these:
- AI agents named via ENS subnames ✓
- Text records storing cryptographic references (INFT pointer, storage merkle root) ✓
- Text records storing dynamic agent metadata (price, voice, deploy rates, reputation) ✓
- Subnames as both identity and access primitive — ENS is the discovery and identity layer ✓

---

## 0G Integration

### 0G Compute — TEE-Backed AI Training

The core privacy promise of taars depends on 0G Compute:

1. User's raw voice samples and personality data are sent to the 0G Compute Network.
2. A GPU provider processes the data inside a TEE (Trusted Execution Environment).
3. The TEE runs the fine-tuning pipeline: voice embeddings, personality config, system prompt generation.
4. Raw data is destroyed inside the TEE. Only the derived model artifacts exit.
5. Cryptographic attestation proves the computation ran inside verified hardware, with verified code.

For inference (when someone chats with a replica), 0G Compute handles the AI inference workload — routing requests to GPU providers running the replica's model.

Key 0G Compute features used:
- **Fine-tuning service** (live) — trains the replica model from user data
- **Inference service** (live) — runs the replica for real-time chat/voice
- **TEE verification** — cryptographic proof of computation integrity
- **Smart contract escrow** — payment held until compute delivered
- **OpenAI SDK compatible** — easy integration for inference calls

### 0G Storage — Encrypted Model Storage

The trained model artifacts need persistent, decentralized, encrypted storage:

1. After TEE processing, model weights/embeddings/config are encrypted with the owner's key.
2. Encrypted artifacts are uploaded to 0G Storage via the TypeScript SDK.
3. 0G Storage returns a merkle root hash — this becomes the content identifier.
4. The merkle root is stored in the INFT metadata and in the ENS text records.
5. Only the INFT owner can decrypt and access the model data.

Key 0G Storage features used:
- **TypeScript SDK** — `@0gfoundation/0g-ts-sdk` for upload/download
- **Merkle verification** — tamper-proof content integrity
- **Browser support** — works in PWA via `ZgBlob`
- **In-memory upload** — `MemData` for uploading processed model data without disk writes

```typescript
// Example: Upload encrypted model to 0G Storage
import { MemData, Indexer } from '@0gfoundation/0g-ts-sdk';

const encryptedModel = encrypt(modelWeights, ownerPublicKey);
const memData = new MemData(encryptedModel);
const [tree, treeErr] = await memData.merkleTree();
const [tx, err] = await indexer.upload(memData, RPC_URL, signer);

// Store the merkle root in INFT metadata + ENS text records
const merkleRoot = tree.rootHash();
```

### 0G Chain — Smart Contracts

0G Chain is EVM-compatible, so standard Solidity contracts work. Used for:
- INFT (ERC-7857) contract deployment
- Compute escrow and verification contracts
- On-chain attestation records

---

## INFT Integration

### ERC-7857 — The AI Replica as a Token

The INFT standard (ERC-7857) was designed specifically for tokenizing AI agents. A taars replica is a textbook INFT:

| ERC-7857 Feature | taars Usage |
|---|---|
| **Encrypted metadata** | Voice model, personality config, knowledge index — all encrypted |
| **Secure transfer** | When ownership transfers, TEE oracle re-encrypts metadata for new owner |
| **Clone function** | Create copies of your replica for licensing/distribution |
| **Authorized usage** | Grant usage rights without ownership transfer (AI-as-a-Service) |
| **Dynamic metadata** | Replica evolves as user adds more training data over time |
| **0G Storage integration** | Encrypted metadata stored on 0G Storage, referenced by merkle root |

### Transfer Flow (Orchestrated by KeeperHub)

When a taars INFT transfers, KeeperHub MCP guarantees the multi-step flow completes atomically:

1. Current owner initiates transfer via the web app.
2. KeeperHub pulls encrypted metadata from 0G Storage.
3. Sends to the TEE oracle — oracle re-encrypts with new owner's key.
4. New encrypted metadata uploaded to 0G Storage (new merkle root).
5. Smart contract verifies proofs from both parties and the oracle; INFT ownership transfers.
6. ENS subname can optionally transfer with the INFT.
7. Every step is audit-logged onchain. Failures retry; unrecoverable failures roll back.

Without KeeperHub, this flow is fragile: if step 4 succeeds but step 5 fails, the INFT points at metadata its owner can't decrypt. KeeperHub turns it into a guaranteed atomic operation.

### Authorized Usage (Leasing)

The INFT's authorized usage feature enables a Delphi-like business model:
- A thought leader creates their taar.
- They grant time-bounded "usage" rights to a company (e.g., for customer support).
- The company can run the replica via 0G Compute, but never accesses the raw model weights.
- KeeperHub schedules the lease expiry — guaranteed access cutoff at the agreed time.
- Original owner retains full ownership and can revoke access.

---

## KeeperHub Integration

KeeperHub is the execution and reliability layer for taars. It's not bolted on — it's wired into four real product surfaces:

### 1. Per-Minute Billing + Revenue Settlement

- Caller pays via x402 (USDC on Base) per minute.
- KeeperHub MCP holds the session state and meters time.
- On session end, KeeperHub settles onchain with guaranteed execution: 90% to INFT owner, 7% to platform, 3% to creator royalty.
- Every session is audit-logged onchain. If a settlement fails (gas spike, network blip), KeeperHub retries with gas optimization.

### 2. INFT Transfer Orchestration

- ERC-7857 transfers require multiple coordinated steps across 0G Storage, TEE oracle, 0G Chain, and ENS on Base.
- KeeperHub orchestrates the sequence as a single atomic flow.
- Failure at any step rolls back state; the audit trail proves integrity to both parties.

### 3. Discord Deploy Lifecycle

- User taps "Deploy → Discord VC" on a taar's profile.
- KeeperHub provisions a Discord bot instance (loaded with voice + persona), connects to the target voice channel, starts billing.
- On session end, KeeperHub tears down the bot, settles billing, returns audit logs.
- If platform API fails mid-session, KeeperHub retries or refunds.

### 4. taars MCP Plugin (Integration Play)

- Hosted MCP server that any agent framework (ElizaOS, LangChain, CrewAI) can install.
- Exposes tools:
  - `taars.resolve(ensName)` → INFT id, storage root, price, voice profile
  - `taars.chat(ensName, message)` → x402-paid chat session
  - `taars.voice(ensName, audio)` → x402-paid voice session
- Lets any agent on any framework call any taars replica by ENS name and pay per minute via x402.
- Makes taars **infrastructure other agents consume**, not just a consumer app.

### Why Each Touchpoint Matters

KeeperHub's pitch is "guaranteed onchain execution + audit trail + native MCP/x402 support." Every one of these four touchpoints is a real reliability problem that taars would otherwise have to solve with custom retry/queue/state machine code. KeeperHub absorbs all of it.

---

## Voice Output

### How It Works

taars don't just type — they speak in the creator's actual voice. When a user records voice samples during creation, the system generates:

1. **Speaker embeddings** — a mathematical fingerprint of the creator's voice characteristics (pitch, cadence, timbre, accent)
2. **A lightweight TTS (text-to-speech) config** — fine-tuned parameters for a voice synthesis model that reproduces the creator's voice

These artifacts are stored encrypted on 0G Storage as part of the INFT metadata.

### Voice Interaction Modes

| Mode | How It Works | UX |
|---|---|---|
| **Text + Voice Playback** | Replica generates text response, then synthesizes it as audio | Each message has a play button. User reads or listens. |
| **Live Voice Mode** | Real-time voice conversation, like a phone call | Push-to-talk or continuous mode. Replica responds in voice with ~500ms latency. |
| **Voice Notes** | Async voice messages back and forth | Like WhatsApp voice notes, but the taar replies in the creator's voice. |

### Technical Pipeline

```
User sends message (text or voice)
    │
    ▼
0G Compute (Inference)
    │
    ├── 1. STT (if voice input) → transcribe to text
    ├── 2. LLM inference → generate response text (using personality config)
    ├── 3. TTS synthesis → generate audio using creator's voice embeddings
    │
    ▼
Response returned: { text, audioUrl, duration }
    │
    ▼
Web app plays audio + shows text transcript
```

For the hackathon demo, the voice synthesis layer is mocked with ElevenLabs (production path: 0G Compute with a fine-tuned voice model). This is honest scope: the architecture is correct, the speed-to-demo is realistic.

### Why This Matters

Text-only replicas feel like chatbots. Voice replicas feel like *talking to the person*. For the demo, this is the "holy shit" moment — you hear Vitalik's voice responding to your question in real time.

---

## Multi-Platform Deployment

### The taar Profile Page

Each taar has a profile page (accessible via its ENS name) that shows the chat/voice interface plus **deployment options** — ways to bring the taar to other platforms.

```
┌──────────────────────────────────────────────┐
│  🌟 vitalik.taars.eth                        │
│                                              │
│  ┌──────┐  Vitalik Buterin                   │
│  │ 🧑‍💻  │  Ethereum co-founder.              │
│  │      │  Trained on blog posts, talks,     │
│  └──────┘  and public interviews.            │
│                                              │
│  ⭐ 4.8/5  │  🕐 2,340 min served  │  💰 $0.15/min│
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │         [💬 Chat Now — $0.15/min]       │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │         [🎙️ Voice Call — $0.20/min]     │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ── Deploy to Other Platforms ──             │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 🎮       │ │ 🐦       │ │ 📱       │     │
│  │ Discord  │ │ Twitter  │ │ Telegram │     │
│  │ Voice    │ │ Spaces   │ │ Bot      │     │
│  │ (LIVE)   │ │ (soon)   │ │ (soon)   │     │
│  │ $0.25/min│ │ $0.30/min│ │ $0.10/min│     │
│  │[Deploy →]│ │[Deploy →]│ │[Deploy →]│     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
└──────────────────────────────────────────────┘
```

### Deployment Channels

| Platform | Status | How It Works | Rate Multiplier |
|---|---|---|---|
| **Discord Voice Channel** | **LIVE** | KeeperHub orchestrates: provision bot → join VC → start billing → tear down on end. | 2.5x base rate |
| **Twitter/X Spaces** | UI shell (post-hackathon) | taar joins a Space as an AI speaker. | 3x base rate |
| **Telegram Bot** | UI shell (post-hackathon) | One-click deploy as a Telegram bot. | 1x base rate |

### How Discord Deployment Works (End-to-End)

1. User taps "Deploy → Discord VC" on a taar's profile page.
2. Authorizes payment (per-minute Discord rate from ENS text record).
3. KeeperHub MCP receives the deploy request and orchestrates:
   - Spins up a Discord bot instance with the taar's voice model + personality
   - Connects to the target Discord voice channel
   - Starts x402 billing
4. The taar is now live in Discord, speaking in the creator's voice.
5. When the session ends, KeeperHub tears down the bot, settles billing, returns logs.

### ENS Text Records for Deployment

Each platform deployment option is advertised in the ENS text records:

| Record Key | Value | Purpose |
|---|---|---|
| `taars.deploy.discord` | `0.25` | Per-minute rate for Discord VC |
| `taars.deploy.twitter` | `0.30` | Per-minute rate for Twitter Spaces (planned) |
| `taars.deploy.telegram` | `0.10` | Per-minute rate for Telegram bot (planned) |

Third-party apps can read these records and build their own deployment interfaces — full composability.

---

## Revenue Sharing

### How Revenue Flows

Every interaction with a taar generates revenue for the INFT owner. This is native to the protocol — not a platform feature that can be turned off.

```
Caller pays per minute (x402 on Base)
    │
    ▼
Smart Contract Escrow
    │
    ▼
KeeperHub MCP settles on session end
    │
    ├── 90% → INFT Owner's Wallet
    ├── 7%  → taars Platform Treasury
    └── 3%  → Creator Royalty Pool (enforced even after INFT transfer)
```

### Revenue Dashboard (Owner View)

```
┌──────────────────────────────────────────────┐
│  💰 fabian.taars.eth — Revenue               │
│                                              │
│  Today:        $12.40                        │
│  This Week:    $84.20                        │
│  All Time:     $342.80                       │
│                                              │
│  📊 Minutes Served                           │
│  ████████████████████░░░░  847 min total     │
│                                              │
│  Top Callers (anonymous wallets):            │
│  • 0x3a...  — 124 min ($12.40)               │
│  • 0x7f...  — 89 min ($8.90)                 │
│  • 0xbc...  — 67 min ($6.70)                 │
│                                              │
│  Revenue by Channel:                         │
│  Web App Chat:      $260.40 (76%)            │
│  Discord VC:        $82.40  (24%)            │
│                                              │
│  [Withdraw to Wallet]  [Set Pricing]         │
└──────────────────────────────────────────────┘
```

### On-Chain Revenue Tracking

All revenue is tracked on-chain per INFT token ID. Anyone can query "how much has `vitalik.taars.eth` earned?" by resolving the ENS name → getting the INFT ID → reading the revenue contract. KeeperHub's audit trail makes the full session history verifiable.

### Royalties on Transfer

If an INFT is transferred or cloned, the original creator continues to earn a 3% royalty on all future revenue. This is enforced at the smart contract level — not a platform promise.

---

## Smart Contract Architecture

```
contracts/
├── TaarsINFT.sol                  # ERC-7857 implementation for AI replicas
│   ├── mint()                     # Mint new replica INFT
│   ├── transferWithMetadata()     # Secure metadata transfer via oracle (KeeperHub-orchestrated)
│   ├── clone()                    # Create replica copies for licensing
│   ├── authorizeUsage()           # Grant time-bounded usage without ownership
│   └── updateMetadata()           # Update model (re-training)
│
├── TaarsRegistry.sol              # Registry linking ENS ↔ INFT
│   ├── register()                 # Create replica: mint INFT + register ENS
│   └── resolve()                  # ENS name → INFT token ID → storage root
│
├── TaarsENS.sol                   # ENS subname management on Base
│   ├── claimSubname()             # Register alice.taars.eth
│   ├── setTextRecords()           # Set INFT, storage, pricing, deploy rates, voice
│   └── releaseSubname()           # Release subname (e.g., on INFT transfer)
│
├── TaarsBilling.sol               # Per-minute billing + revenue distribution
│   ├── startSession()             # Begin a billable session (caller pays via x402)
│   ├── endSession()               # End session, KeeperHub settles
│   ├── claimRevenue()             # INFT owner withdraws accumulated earnings
│   ├── setRate()                  # Owner sets per-minute rate (base + per-platform)
│   ├── setDeployRates()           # Owner sets multipliers for Discord, Twitter, etc.
│   ├── getRevenue()               # Query total revenue for an INFT (public, on-chain)
│   └── distribute()               # 90/7/3 split — called by KeeperHub
│
└── TaarsDeployer.sol              # Discord deploy lifecycle (KeeperHub-orchestrated)
    ├── requestDeploy()            # Request deployment to a platform
    ├── confirmDeploy()            # KeeperHub confirms deployment is live
    ├── endDeploy()                # End a platform deployment, settle billing
    └── getActiveDeployments()     # List active deployments for a taar
```

---

## Data Flow Diagram

```
USER             TAARS WEB APP        0G COMPUTE       0G STORAGE       0G CHAIN          BASE/ENS         KEEPERHUB
 │                    │                   │                │                │                  │                │
 │  1. Open PWA       │                   │                │                │                  │                │
 │ ──────────────────>│                   │                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │  2. Privy login    │                   │                │                │                  │                │
 │     (email/social) │                   │                │                │                  │                │
 │ <─────────────────>│                   │                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │  3. Choose ENS     │                   │                │                │                  │                │
 │ ──────────────────>│                   │                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │  4. Record voice + │                   │                │                │                  │                │
 │     personality    │                   │                │                │                  │                │
 │ ──────────────────>│                   │                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │  5. Pay USDC       │                   │                │                │                  │                │
 │     (Privy)        │                   │                │                │                  │                │
 │ ──────────────────>│                   │                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │                    │  6. Send raw data │                │                │                  │                │
 │                    │ ──────────────────>                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │                    │                   │ 7. TEE Process:                 │                  │                │
 │                    │                   │    Fine-tune                    │                  │                │
 │                    │                   │    Generate emb                 │                  │                │
 │                    │                   │    Destroy raw                  │                  │                │
 │                    │                   │    Sign attest.                 │                  │                │
 │                    │                   │                                 │                  │                │
 │                    │                   │ 8. Upload                       │                  │                │
 │                    │                   │    encrypted model ───────────>│                  │                │
 │                    │                   │    merkle root <───────────────│                  │                │
 │                    │                   │                │                │                  │                │
 │                    │  9. Mint INFT (merkle root)        │                │                  │                │
 │                    │ ────────────────────────────────────────────────────>                  │                │
 │                    │                   │                │                │                  │                │
 │                    │  10. Register ENS subname on Base + set text records                   │                │
 │                    │ ────────────────────────────────────────────────────────────────────────>                │
 │                    │                   │                │                │                  │                │
 │  11. "Live at      │                   │                │                │                  │                │
 │       alice.taars  │                   │                │                │                  │                │
 │       .eth"        │                   │                │                │                  │                │
 │ <──────────────────│                   │                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │  12. Caller chats  │                   │                │                │                  │                │
 │ ──────────────────>│  13. x402 invoice ──────────────────────────────────────────────────────>                │
 │                    │                   │                │                │                  │  14. Meter on  │
 │                    │  15. Inference ──>│                │                │                  │     onchain    │
 │                    │  16. Response <───│                │                │                  │                │
 │                    │                   │                │                │                  │                │
 │  17. End session   │                   │                │                │                  │                │
 │ ──────────────────>│  18. Settle ──────────────────────────────────────────────────────────>│ 19. 90/7/3     │
 │                    │                                                                        │     onchain    │
 │  20. Receipt <─────│ <─────────────────────────────────────────────────────────────────────│                │
 │                    │                   │                │                │                  │                │
```

---

## Hackathon Scope

### What to Build (48 hours)

**Priority 1 — Must Have (Core Demo)**

- [ ] taars Web App (Next.js 14 PWA)
  - Home page with featured taars (Vitalik, Trump, Fabian, Balaji)
  - Explore page with search by ENS name, categories, pricing
  - Recording UI (voice samples)
  - Personality questionnaire
  - Chat + voice interface with replicas
  - Owner profile + earnings dashboard
- [ ] Privy embedded wallet integration (email/social → Base wallet)
- [ ] ENS subname registration on Base (`alice.taars.eth`)
  - Set text records (INFT ref, storage root, pricing, voice, avatar, description)
  - Resolve name → show replica profile with per-minute rate
- [ ] 0G Storage integration
  - Upload encrypted model config via TypeScript SDK
  - Store merkle root on-chain
- [ ] INFT minting on 0G Chain (ERC-7857 contract)
  - Encrypted metadata pointing to 0G Storage
  - Basic mint + ownership verification
- [ ] Per-minute billing via x402 + KeeperHub MCP
  - Session timer visible in chat UI
  - x402 payment from Privy wallet (USDC on Base)
  - KeeperHub settles on session end: 90% owner / 7% platform / 3% royalty
- [ ] Voice output — voice cloning (ElevenLabs in demo, "0G Compute in production")
  - Speaker profile per replica
  - Streamed audio in the chat UI (play button per message + live voice mode)
- [ ] Revenue sharing
  - Per-minute payments flow to INFT owner's wallet via KeeperHub
  - Real-time earnings dashboard on the taar owner's profile
  - On-chain revenue tracking per taar (queryable via ENS name)
- [ ] INFT transfer flow orchestrated by KeeperHub (demoable end-to-end)
- [ ] Discord VC deploy lifecycle (LIVE) orchestrated by KeeperHub
  - Tap "Deploy → Discord" on profile → bot joins target VC, speaks in creator's voice, bills per minute
- [ ] taars MCP server
  - Hosted MCP server exposing `taars.resolve`, `taars.chat`, `taars.voice`
  - Sample LangChain agent in repo that calls a taar via MCP

**Priority 2 — Should Have (Strengthens Bounties)**

- [ ] 0G Compute integration for inference (replica responds via 0G GPU network — at least one replica live on 0G Compute end-to-end)
- [ ] ENS-based discovery enhancements (filters, sorting, category browse)
- [ ] Twitter Spaces / Telegram deploy buttons in UI (shells only — clicking shows "deployment initiated" and writes a KeeperHub log entry, no live integration)

**Priority 3 — Nice to Have (Polish)**

- [ ] INFT transfer demo with full TEE re-encryption flow
- [ ] INFT clone function (licensing demo)
- [ ] Replica evolution (add more training data post-creation)
- [ ] Reputation accrual via KeeperHub-scheduled text record updates

**Simulated / Mocked for Demo**

- 0G Compute fine-tuning (use a pre-built voice embedding pipeline locally, present as "runs on 0G Compute in production")
- Voice synthesis (ElevenLabs in the demo path; production target is 0G Compute)

### Tech Stack for Hackathon

```
Frontend:     Next.js 14 + Tailwind + shadcn/ui (PWA)
Auth/Wallet:  Privy (email/social → embedded wallet on Base)
Contracts:    Solidity (ERC-7857 on 0G Chain) + ENS subname contracts on Base
Storage:      @0gfoundation/0g-ts-sdk
Compute:      0G Compute SDK (OpenAI-compatible)
Execution:    KeeperHub MCP (billing, settlement, transfer, deploy lifecycle)
Payments:     x402 protocol on Base (USDC)
ENS:          @ensdomains/ensjs or ethers.js ENS utilities
External:     Discord.js (voice channel deploy)
MCP:          @modelcontextprotocol/sdk (for taars MCP plugin)
Deployment:   Vercel (frontend) + 0G Testnet + Base Sepolia (contracts)
```

---

## Bounty Targets

| Bounty | Pool | What We're Using | Key Selling Point |
|---|---|---|---|
| **0G — Best Autonomous Agents/iNFT Innovations** | $7,500 | Compute (TEE training + inference), Storage (encrypted artifacts), INFT (ERC-7857) full lifecycle | The showcase app for ERC-7857 — mint, encrypted metadata, secure transfer, authorized leasing |
| **0G — Best Agent Framework/Tooling** | $7,500 | taars MCP plugin — hosted MCP server callable from any agent framework | Other agents on ElizaOS / LangChain / CrewAI can consume any taar via MCP — taars is infrastructure |
| **ENS — Best AI Agent Integration** | $2,500 | Subnames as agent identity, name-based discovery, owner-of-name = owner-of-replica | The ENS name *is* the replica identity. Resolve → INFT, price, storage, voice — all in text records |
| **ENS — Most Creative Use** | $2,500 | Text records as full agent metadata + dynamic on-chain reputation (KeeperHub-scheduled updates) | `taars.inft`, `taars.storage`, `taars.price`, `taars.voice`, `taars.deploy.*` — composable agent record |
| **KeeperHub — Best Use** | $4,500 | x402 billing + revenue settlement + INFT transfer orchestration + Discord deploy lifecycle + taars MCP plugin | Four real reliability surfaces, not bolted on |
| **KeeperHub — Feedback Bounty** | $250–500 | Honest FEEDBACK.md from integration | Free if we write it well |

**Realistic target: ~$25K. Stretch (top placement across 0G + ENS + KeeperHub): $30K+.**

### Why Each Bounty Judge Should Care

**0G judges:** "Uses three core 0G products in one coherent app — Compute for TEE-backed training, Storage for encrypted model persistence, and INFTs (ERC-7857) as the ownership primitive. Plus the taars MCP plugin makes it a framework other agents can build on. This is the showcase app for ERC-7857 that doesn't exist yet."

**ENS judges:** "This isn't ENS slapped on as an afterthought. The ENS name IS the agent identity. Whoever owns the name owns the replica. Text records store cryptographic references (INFT pointer, storage merkle root), pricing, voice config, deploy rates, and dynamic reputation. It's composable — any app can resolve the name and build on top of it. This is what ENS looks like when it becomes the namespace for AI agents."

**KeeperHub judges:** "Four real touchpoints: x402 per-minute billing with guaranteed settlement, INFT transfer atomic orchestration, Discord deploy lifecycle, and a hosted taars MCP plugin that any agent framework can install. KeeperHub is the literal money-flow + reliability backbone of the product, not a bolt-on."

---

## Demo Script

**Duration:** 3 minutes

### Opening (15 seconds)
> "What if your AI replica was an asset *you owned* — not data a company holds? Your training data destroyed in a TEE, your model encrypted on decentralized storage, your identity at a human-readable name, and revenue from every interaction landing in your wallet — guaranteed onchain."

### Live Demo (2.5 minutes)

1. **Open the Web App** (15s)
   - Open taars.app PWA (installable on phone or desktop)
   - Show home page: featured taars — Vitalik, Trump, Fabian, Balaji
   - "These are AI replicas of real people — trained on their public content, owned as INFTs, discoverable by ENS name."

2. **Talk to a Featured taar** (30s)
   - Tap on `vitalik.taars.eth` → profile shows: avatar, bio, $0.10/min rate
   - Approve x402 payment in Privy wallet → session starts
   - Ask a question → Vitalik's replica responds in his personality/style with voice playback
   - Show the session timer ticking
   - "I'm talking to Vitalik's taar. x402 charges my wallet per minute via KeeperHub — settled onchain when I end the session. 90% goes to the INFT owner."

3. **Create Your Own taar** (45s)
   - Tap "Create Your taar"
   - Privy email login → embedded wallet on Base
   - Type `fabian` → claims `fabian.taars.eth`
   - Record 15 seconds of voice, answer 2 personality questions
   - Set per-minute rate: $0.05
   - Tap "Forge My taar"

4. **Show the Receipts** (20s)
   - 0G Storage upload → merkle root hash
   - INFT mint on 0G Chain → token ID
   - ENS text records on Base populated: INFT, storage root, voice, price
   - KeeperHub session log entry
   - "My replica is now an INFT I own, stored encrypted on 0G, addressed at fabian.taars.eth on Base, billable via KeeperHub."

5. **Discord Deploy Moment** (20s)
   - On Fabian's taar profile, tap "Deploy → Discord VC"
   - Show KeeperHub orchestration: bot provisioned → joins a Discord voice channel → starts billing
   - Bot speaks in Fabian's voice in the actual Discord VC
   - "My taar is now live in a Discord voice channel. KeeperHub orchestrated the whole lifecycle — provision, billing, teardown."

6. **MCP Plugin Moment** (15s)
   - Show terminal: a sample LangChain agent calling `taars.chat("vitalik.taars.eth", "...")` via the taars MCP server
   - Response streams back; x402 payment auto-handled
   - "Any agent on any framework can talk to any taar by ENS name. taars is the infrastructure — not the app."

### Closing (15 seconds)
> "taars: your voice, your personality, your ENS name, your INFT, your revenue. Owned by you. Composable across every agent framework. Built on 0G, ENS, and KeeperHub."

---

## Future Roadmap (Post-Hackathon)

- **Replica marketplace:** Buy, sell, and license taars as INFTs on a dedicated marketplace. Think "Fiverr for AI agents."
- **Multi-modal training:** Video, social media exports, long-form writing as additional training inputs to make replicas richer.
- **Enterprise tier:** Companies deploy branded taars for customer support, onboarding, sales — using INFT's authorized usage feature.
- **More platform deploys:** Twitter Spaces, Telegram, phone (Twilio), podcast guesting — each as a KeeperHub-orchestrated lifecycle.
- **taars API + SDKs:** Beyond MCP, give developers REST/WebSocket access to call any taar by ENS name.
- **Autonomous actions:** taars that don't just talk but act — book meetings, send emails, make purchases on behalf of their owner. KeeperHub guarantees the onchain side.
- **Reputation system:** On-chain ratings and reviews per taar, written into ENS text records by KeeperHub on a schedule, influencing discovery ranking.

---

*Built at ETHGlobal Open Agents 2026 by Tenori Labs.*
