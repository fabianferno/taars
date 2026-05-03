# Remove Mocks: Real Agent Registry, Real LLM, Real 0G INFT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four mocked components with real implementations: (1) hardcoded community/featured agents → backend-served registry, (2) `MockProvider` LLM → 0G primary + OpenAI fallback + visible status UI, (3) demo replies → removed, (4) `MockINFT.sol` Sepolia mirror → real 0G INFT ownership verified server-side.

**Architecture:**
- **Agents:** Move static `FEATURED_TAARS`/`ALL_TAARS` arrays out of `web/src/lib/taars-data.ts` into `server/data/agents.json`, served via new `/agents` route. Frontend uses a `useAgents()` SWR-style hook.
- **LLM:** `getLLM()` returns a chain (0G → OpenAI). Both fail → throws `LLMUnavailableError`. Chat `/message` returns `503` with structured reason. Add `/chat/llm-status` for the UI banner. Delete `MockProvider`.
- **INFT:** Delete `MockINFT.sol`. Drop the `inft` constructor param + `IERC721.ownerOf` checks from `TaarsBilling.sol`. Server (`oracle`) verifies the real 0G INFT owner before calling `settleSession` / `claimRevenueFor`. The 0G mint flow is already real (`server/src/services/inft.ts` targets `evmrpc-testnet.0g.ai`, chainId 16602) — only the Sepolia mirror is removed.

**Tech Stack:** Hono (server), Next.js 15 / React (web), SWR pattern via custom hook, viem, Hardhat (Solidity), Zod.

---

## Phase A — Real Agent Registry

### Task A1: Server data file + types

**Files:**
- Create: `server/src/data/agents.json`
- Create: `server/src/services/agents.ts`
- Modify: `sdk/src/types.ts` (add `AgentRecord` shape so web + server share it)

- [ ] **Step 1: Add the shared type to the SDK**

Edit `sdk/src/types.ts`. Append at the end:

```ts
export type AgentVerification = 'self' | 'community';

export interface AgentRecord {
  name: string;
  ens: string;            // e.g. "vitalik.taars.eth"
  initials: string;
  bio: string;
  category: 'trending' | 'top' | 'new';
  rating: number;
  pricePerMinUsd: number;
  gradient: string;       // tailwind from-X to-Y
  verification: AgentVerification;
  greeting: string;
  disclaimer?: string;
  image?: string;
  featured?: boolean;     // true → appears on landing
}
```

- [ ] **Step 2: Create the data file**

Create `server/src/data/agents.json` with the 7 records currently in `web/src/lib/taars-data.ts` (Vitalik, Trump, Fabian, Balaji, Elon, Naval, Satoshi). Mark Vitalik / Trump / Fabian / Balaji as `"featured": true`. Each entry is one `AgentRecord` (rename `pricePerMin` → `pricePerMinUsd`, drop the `price` display string — frontend formats it).

```json
[
  {
    "name": "Vitalik Buterin",
    "ens": "vitalik.taars.eth",
    "initials": "VB",
    "bio": "Ethereum co-founder. Decentralization maximalist.",
    "category": "trending",
    "rating": 5.0,
    "pricePerMinUsd": 0.15,
    "gradient": "from-indigo-500 to-purple-800",
    "verification": "community",
    "greeting": "Hey! Let's dive into Ethereum, decentralized governance, cryptography, or the future of public goods.",
    "disclaimer": "AI interpretation - not created or endorsed by Vitalik Buterin.",
    "featured": true
  }
  // ... repeat for Trump, Fabian (verification:"self", no disclaimer), Balaji, Elon, Naval, Satoshi.
  // Use the gradient/rating/bio values from the existing taars-data.ts file.
]
```

- [ ] **Step 3: Create the loader service**

Create `server/src/services/agents.ts`:

```ts
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentRecord } from '@taars/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '..', 'data', 'agents.json');

let _cache: { mtimeMs: number; data: AgentRecord[] } | null = null;

export async function listAgents(): Promise<AgentRecord[]> {
  const { stat } = await import('node:fs/promises');
  const s = await stat(DATA_PATH);
  if (_cache && _cache.mtimeMs === s.mtimeMs) return _cache.data;
  const raw = await readFile(DATA_PATH, 'utf8');
  const data = JSON.parse(raw) as AgentRecord[];
  _cache = { mtimeMs: s.mtimeMs, data };
  return data;
}

export async function getAgentByEnsLabel(label: string): Promise<AgentRecord | null> {
  const all = await listAgents();
  return all.find((a) => a.ens.replace('.taars.eth', '') === label) ?? null;
}
```

- [ ] **Step 4: Verify the file loads**

Run from repo root:
```bash
cd server && pnpm exec tsx -e "import('./src/services/agents.ts').then(m => m.listAgents()).then(a => console.log(a.length, 'agents'))"
```
Expected: `7 agents`.

- [ ] **Step 5: Commit**

```bash
git add sdk/src/types.ts server/src/data/agents.json server/src/services/agents.ts
git commit -m "feat(agents): add backend agent registry loader"
```

---

### Task A2: `/agents` route

**Files:**
- Create: `server/src/routes/agents.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create the route**

Create `server/src/routes/agents.ts`:

```ts
import { Hono } from 'hono';
import { listAgents, getAgentByEnsLabel } from '../services/agents.js';

export const agents = new Hono();

agents.get('/', async (c) => {
  const all = await listAgents();
  const featured = c.req.query('featured');
  const filtered = featured === '1' ? all.filter((a) => a.featured) : all;
  return c.json({ ok: true, agents: filtered });
});

agents.get('/:label', async (c) => {
  const label = c.req.param('label');
  const agent = await getAgentByEnsLabel(label);
  if (!agent) return c.json({ ok: false, error: 'not_found' }, 404);
  return c.json({ ok: true, agent });
});
```

- [ ] **Step 2: Register the route**

Edit `server/src/index.ts`. Add the import next to the others:
```ts
import { agents } from './routes/agents.js';
```
And add `app.route('/agents', agents);` next to the other `app.route(...)` calls.

- [ ] **Step 3: Smoke test**

```bash
cd server && pnpm dev &
sleep 3
curl -s localhost:8080/agents | head -c 400
curl -s 'localhost:8080/agents?featured=1' | head -c 400
curl -s localhost:8080/agents/vitalik | head -c 400
kill %1
```
Expected: 7 agents, 4 featured, single agent with `name: "Vitalik Buterin"`.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/agents.ts server/src/index.ts
git commit -m "feat(agents): add GET /agents and /agents/:label"
```

---

### Task A3: Frontend hook + remove static arrays

**Files:**
- Create: `web/src/hooks/useAgents.ts`
- Modify: `web/src/lib/taars-data.ts` (delete arrays, keep types + disclosure helpers)
- Modify: `web/src/components/Landing/FeaturedTaars.tsx`
- Modify: `web/src/app/explore/page.tsx`
- Modify: `web/src/app/earnings/page.tsx`

- [ ] **Step 1: Create the hook**

Create `web/src/hooks/useAgents.ts`:

```ts
'use client';
import { useEffect, useState } from 'react';
import { SERVER_URL } from '@/lib/api';

export interface UiAgent {
  name: string;
  ens: string;
  initials: string;
  bio: string;
  category: 'trending' | 'top' | 'new';
  rating: number;
  pricePerMinUsd: number;
  price: string;          // pre-formatted display string
  gradient: string;
  verification: 'self' | 'community';
  greeting: string;
  disclaimer?: string;
  image?: string;
  featured?: boolean;
}

function formatPrice(p: number): string {
  return p === 0 ? 'Free' : `$${p.toFixed(2)}/min`;
}

export function useAgents(opts?: { featuredOnly?: boolean }): {
  agents: UiAgent[];
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{ agents: UiAgent[]; loading: boolean; error: string | null }>(
    { agents: [], loading: true, error: null }
  );

  useEffect(() => {
    let cancelled = false;
    const url = `${SERVER_URL}/agents${opts?.featuredOnly ? '?featured=1' : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) throw new Error(j.error || 'failed');
        const agents: UiAgent[] = j.agents.map((a: Omit<UiAgent, 'price'>) => ({
          ...a,
          price: formatPrice(a.pricePerMinUsd),
        }));
        setState({ agents, loading: false, error: null });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState({ agents: [], loading: false, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [opts?.featuredOnly]);

  return state;
}
```

- [ ] **Step 2: Strip arrays from `taars-data.ts`**

Replace the body of `web/src/lib/taars-data.ts` with **only** types + helpers. Delete `FEATURED_TAARS`, `ALL_TAARS`, `TAAR_LOOKUP`. Keep:

```ts
export type VerificationStatus = 'self' | 'community';

export interface TaarData {
  name: string;
  ens: string;
  price: string;
  pricePerMin: number;
  bio: string;
  initials: string;
  gradient: string;
  category: string;
  rating: number;
  verification: VerificationStatus;
  greeting: string;
  disclaimer?: string;
  image?: string;
}

export function getDisclosureMessage(taar: { name: string; verification: VerificationStatus }): string {
  const source =
    taar.verification === 'self'
      ? 'self-provided training data'
      : 'publicly available content (blog posts, talks, interviews)';
  return `You are talking to an AI replica, not the real ${taar.name}. Responses are AI-generated based on ${source}.`;
}

export function getSystemPromptAddition(taar: { name: string }): string {
  return `If asked whether you are real, whether you are the actual person, or any variation of this question, always clearly state that you are an AI replica created on taars, not the real ${taar.name}.

Content guardrails:
- Do not give financial advice, medical claims, or legal statements
- Do not claim to be the real ${taar.name}
- Respect the creator's content boundaries`;
}
```

- [ ] **Step 3: Update `FeaturedTaars.tsx`**

Edit `web/src/components/Landing/FeaturedTaars.tsx`. Replace the static import + usage:

```tsx
// at top:
import { useAgents } from '@/hooks/useAgents';
// remove: import { FEATURED_TAARS } from "@/lib/taars-data";

// inside the component, replace `FEATURED_TAARS.map(...)` with:
const { agents, loading, error } = useAgents({ featuredOnly: true });

// then in JSX, around the existing `.map(...)`:
{loading && <div className="text-center text-white/60 py-8">Loading featured agents…</div>}
{error && <div className="text-center text-red-400 py-8">Failed to load: {error}</div>}
{!loading && !error && agents.map((taar, i) => (
  /* keep existing card markup, swap field names: taar.price (already formatted) */
))}
```

(Field shape matches `TaarData` — `pricePerMin` → `pricePerMinUsd`. Update any reference accordingly. The card already uses `price` string for display.)

- [ ] **Step 4: Update `explore/page.tsx`**

Edit `web/src/app/explore/page.tsx`:
- Remove `import { ALL_TAARS, type TaarData } from "@/lib/taars-data";`
- Add `import { useAgents, type UiAgent } from "@/hooks/useAgents";`
- Replace `let list = [...ALL_TAARS];` with hook usage:
  ```tsx
  const { agents, loading, error } = useAgents();
  // then in the filtering block:
  let list: UiAgent[] = [...agents];
  ```
- Render a loading skeleton (`<div>Loading…</div>`) when `loading`, and an error state when `error`.
- Replace any `TaarData` references with `UiAgent`.

- [ ] **Step 5: Update `earnings/page.tsx`**

Edit `web/src/app/earnings/page.tsx`:
- Remove `import { ALL_TAARS } from '@/lib/taars-data';`
- Add `import { useAgents } from '@/hooks/useAgents';`
- Replace `const candidates = ALL_TAARS.map((t) => t.ens.replace('.taars.eth', ''));` with:
  ```tsx
  const { agents } = useAgents();
  const candidates = agents.map((t) => t.ens.replace('.taars.eth', ''));
  ```

- [ ] **Step 6: Type check + visual smoke test**

```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no errors.

Then start both servers and load `/`, `/explore`, `/earnings`:
```bash
cd server && pnpm dev &
cd web && pnpm dev
```
Visit `http://localhost:3000/` — confirm featured grid loads from API. `/explore` shows 7 cards. `/earnings` enumerates ENS labels.

- [ ] **Step 7: Commit**

```bash
git add web/src/hooks/useAgents.ts web/src/lib/taars-data.ts \
        web/src/components/Landing/FeaturedTaars.tsx \
        web/src/app/explore/page.tsx web/src/app/earnings/page.tsx
git commit -m "feat(web): fetch agents from /agents endpoint, drop hardcoded list"
```

---

## Phase B — Real LLM Only (no MockProvider)

### Task B1: Delete `MockProvider`, harden selector

**Files:**
- Modify: `server/src/services/llm.ts`

- [ ] **Step 1: Replace the file body**

Edit `server/src/services/llm.ts`. Delete the entire `MockProvider` class (lines 160–191) and the helpers `pickAfterHeading` / `openerForVibe`. Replace the selector block at the bottom (lines 193–221) with:

```ts
// ----- selector -----

export class LLMUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`No LLM provider available: ${reason}`);
    this.name = 'LLMUnavailableError';
  }
}

class ChainedLLMProvider implements LLMProvider {
  name = 'zerog+openai';
  private zerog: ZeroGLLMProvider | null;
  private openai: OpenAIProvider | null;
  lastUsed: string | null = null;
  lastError: string | null = null;

  constructor(zerog: ZeroGLLMProvider | null, openai: OpenAIProvider | null) {
    this.zerog = zerog;
    this.openai = openai;
  }

  async complete(messages: ChatMessage[], opts?: CompleteOpts): Promise<string> {
    if (this.zerog) {
      try {
        const out = await this.zerog.complete(messages, opts);
        this.lastUsed = 'zerog';
        this.lastError = null;
        return out;
      } catch (e) {
        this.lastError = (e as Error).message.slice(0, 200);
        console.warn('[llm] zerog failed:', this.lastError);
      }
    }
    if (this.openai) {
      try {
        const out = await this.openai.complete(messages, opts);
        this.lastUsed = 'openai';
        // Keep lastError populated if zerog failed — UI surfaces "0G unavailable, using OpenAI fallback"
        return out;
      } catch (e) {
        this.lastError = (e as Error).message.slice(0, 200);
        console.error('[llm] openai failed:', this.lastError);
      }
    }
    throw new LLMUnavailableError(this.lastError ?? 'no providers configured');
  }
}

let _provider: ChainedLLMProvider | null = null;

export function getLLM(): ChainedLLMProvider {
  if (_provider) return _provider;
  const zerog =
    env.OG_BROKER_PROVIDER && env.DEPLOYER_PRIVATE_KEY ? new ZeroGLLMProvider() : null;
  const openai = env.OPENAI_API_KEY ? new OpenAIProvider() : null;
  if (!zerog && !openai) {
    console.warn('[llm] no providers configured — /chat/message will return 503');
  } else {
    console.log(
      `[llm] providers ready: ${[zerog && 'zerog', openai && 'openai'].filter(Boolean).join(', ')}`
    );
  }
  _provider = new ChainedLLMProvider(zerog, openai);
  return _provider;
}

export function _resetLLM(): void {
  _provider = null;
}

export interface LLMStatus {
  zerog: { configured: boolean };
  openai: { configured: boolean };
  lastUsed: string | null;
  lastError: string | null;
}

export function getLLMStatus(): LLMStatus {
  const p = getLLM();
  return {
    zerog: { configured: Boolean(env.OG_BROKER_PROVIDER && env.DEPLOYER_PRIVATE_KEY) },
    openai: { configured: Boolean(env.OPENAI_API_KEY) },
    lastUsed: p.lastUsed,
    lastError: p.lastError,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd server && pnpm exec tsc --noEmit
```
Expected: no errors. If errors reference `MockProvider`, search and remove the leftover references.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/llm.ts
git commit -m "refactor(llm): drop MockProvider, chain 0G→OpenAI, surface status"
```

---

### Task B2: Chat route returns typed errors + `/chat/llm-status`

**Files:**
- Modify: `server/src/routes/chat.ts`

- [ ] **Step 1: Update `/chat/message` error path**

Edit `server/src/routes/chat.ts`. Replace lines 102–110 (the `try/catch` around `llm.complete`) with:

```ts
import { LLMUnavailableError, getLLMStatus } from '../services/llm.js';
// ... in the handler:
let assistantText = '';
try {
  assistantText = await llm.complete([systemMsg, ...session.messages], {
    temperature: 0.7,
    maxTokens: 400,
  });
} catch (e) {
  if (e instanceof LLMUnavailableError) {
    return c.json(
      {
        ok: false,
        error: 'llm_unavailable',
        reason: e.reason,
        status: getLLMStatus(),
      },
      503
    );
  }
  console.error('[chat/message] llm failed:', e);
  return c.json(
    { ok: false, error: 'llm_failed', detail: (e as Error).message.slice(0, 200) },
    502
  );
}
```

(Note: the import at the top of the file should already pull `getLLM` — extend it to also import `LLMUnavailableError, getLLMStatus`.)

- [ ] **Step 2: Add `/chat/llm-status` endpoint**

Append at the bottom of `server/src/routes/chat.ts` (before the `expectedUsd2dp` helper):

```ts
chat.get('/llm-status', (c) => {
  return c.json({ ok: true, status: getLLMStatus() });
});
```

- [ ] **Step 3: Smoke test**

```bash
cd server && pnpm dev &
sleep 3
curl -s localhost:8080/chat/llm-status
kill %1
```
Expected JSON: `{ok:true, status:{zerog:{configured:...}, openai:{configured:...}, lastUsed:null, lastError:null}}`.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/chat.ts
git commit -m "feat(chat): return 503 when no LLM available, add /chat/llm-status"
```

---

### Task B3: Frontend status banner

**Files:**
- Create: `web/src/hooks/useLlmStatus.ts`
- Modify: `web/src/components/Chat/ChatPanel.tsx`
- Modify: `web/src/lib/api.ts` (export `getLlmStatus`)

- [ ] **Step 1: Add API helper**

Edit `web/src/lib/api.ts`. Append:

```ts
export interface LlmStatus {
  zerog: { configured: boolean };
  openai: { configured: boolean };
  lastUsed: string | null;
  lastError: string | null;
}

export async function getLlmStatus(): Promise<LlmStatus> {
  const r = await fetch(`${SERVER_URL}/chat/llm-status`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'failed');
  return j.status as LlmStatus;
}
```

- [ ] **Step 2: Create the hook**

Create `web/src/hooks/useLlmStatus.ts`:

```ts
'use client';
import { useEffect, useState } from 'react';
import { getLlmStatus, type LlmStatus } from '@/lib/api';

export function useLlmStatus(pollMs = 15000): LlmStatus | null {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      getLlmStatus()
        .then((s) => !cancelled && setStatus(s))
        .catch(() => !cancelled && setStatus(null));
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);
  return status;
}
```

- [ ] **Step 3: Replace the mock banner in `ChatPanel.tsx`**

Open `web/src/components/Chat/ChatPanel.tsx`. Find the existing block around lines 192–197 (the "running in mock mode" banner gated on `chat.session.mockLLM`). Replace it with:

```tsx
{(() => {
  const status = useLlmStatus();
  if (!status) return null;
  if (!status.zerog.configured && !status.openai.configured) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        No LLM provider configured. Chat is disabled. Set <code>OG_BROKER_PROVIDER</code> (0G Compute) or <code>OPENAI_API_KEY</code> on the server.
      </div>
    );
  }
  if (status.lastError && status.zerog.configured) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        0G inference unavailable
        {status.openai.configured ? ' — using OpenAI fallback.' : '.'}
        <div className="text-xs opacity-70 mt-1">Reason: {status.lastError}</div>
      </div>
    );
  }
  return null;
})()}
```

The `useLlmStatus` call must be at the top of the component (not inside an IIFE) — refactor to:
```tsx
const llmStatus = useLlmStatus();
// ... in JSX:
{llmStatus && !llmStatus.zerog.configured && !llmStatus.openai.configured && (
  <div className="rounded-md border border-red-500/40 ..."> ... </div>
)}
{llmStatus?.lastError && llmStatus.zerog.configured && (
  <div className="rounded-md border border-amber-500/40 ..."> ... </div>
)}
```

Also: in the message-send error handler, when the API returns `503` with `error: 'llm_unavailable'`, surface a toast or inline error: "LLM unavailable — try again shortly". Update the existing error display to handle this status code explicitly.

- [ ] **Step 4: Type-check + visual smoke test**

```bash
cd web && pnpm exec tsc --noEmit
cd server && pnpm dev &
cd web && pnpm dev
```
Visit a chat page. With `OPENAI_API_KEY` set but `OG_BROKER_PROVIDER` unset, expect no banner (single provider works silently). Unset both env vars and restart the server: expect the red "No LLM provider configured" banner.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useLlmStatus.ts web/src/lib/api.ts web/src/components/Chat/ChatPanel.tsx
git commit -m "feat(chat-ui): show LLM provider status, replace mock banner"
```

---

## Phase C — Real 0G INFT (drop Sepolia mirror)

The 0G mint flow is already real. This phase removes the `MockINFT.sol` Sepolia mirror by making `TaarsBilling` no longer require an on-chain INFT address — the server (oracle) verifies real 0G ownership before settlement.

### Task C1: Refactor `TaarsBilling.sol` — remove `inft` dependency

**Files:**
- Modify: `contracts/contracts/TaarsBilling.sol`

- [ ] **Step 1: Drop `inft` constructor arg + `IERC721` import**

Edit `contracts/contracts/TaarsBilling.sol`:

1. Remove `import "@openzeppelin/contracts/token/ERC721/IERC721.sol";`
2. Remove the `address public immutable inft;` field.
3. Remove `address inft_,` from the constructor params + the `require(inft_ != 0)` + `inft = inft_;`.
4. Remove the `onlyTokenOwner` modifier entirely.
5. `setRate(uint256 tokenId, uint128 ratePerMinute_)` — change `external onlyTokenOwner(tokenId)` to `external onlyOracle`. The server is the gatekeeper; it verifies real 0G ownership before calling `setRate`.
6. In `startSession`: remove the `IERC721(inft).ownerOf(tokenId);` existence check (lines 178–179).
7. Replace `claimRevenue(uint256 tokenId)` with:
   ```solidity
   /// @notice Oracle pays out accrued revenue for `tokenId` to the verified 0G INFT owner.
   function claimRevenueFor(uint256 tokenId, address tokenOwner) external onlyOracle {
       require(tokenOwner != address(0), "TaarsBilling: owner=0");
       uint256 amount = ownerBalance[tokenId];
       require(amount > 0, "TaarsBilling: nothing to claim");
       ownerBalance[tokenId] = 0;
       usdc.safeTransfer(tokenOwner, amount);
       emit RevenueClaimed(tokenId, tokenOwner, amount);
   }
   ```

- [ ] **Step 2: Compile**

```bash
cd contracts && pnpm exec hardhat compile
```
Expected: `Compiled 1 Solidity file successfully`.

- [ ] **Step 3: Commit**

```bash
git add contracts/contracts/TaarsBilling.sol
git commit -m "refactor(billing): remove on-chain INFT dependency, oracle-attested ownership"
```

---

### Task C2: Update tests + delete `MockINFT.sol`

**Files:**
- Modify: `contracts/test/TaarsBilling.test.ts`
- Delete: `contracts/contracts/MockINFT.sol`
- Modify: `contracts/scripts/deploy-billing.ts`

- [ ] **Step 1: Update the test**

Edit `contracts/test/TaarsBilling.test.ts`:
- Remove the `MockINFT` import + the `Inft = await ethers.getContractFactory("MockINFT")` deployment block.
- The new constructor signature is `(usdc_, treasury_, oracle_, owner_)` — drop the `inft.address` arg.
- Replace any `.connect(<owner>).setRate(...)` calls with `.connect(oracle).setRate(...)`.
- Replace `claimRevenue(tokenId)` calls with `connect(oracle).claimRevenueFor(tokenId, ownerAddr)`.
- Replace `await inft.mint(...)` setup with: just track owner addresses in JS (the contract no longer reads INFT on-chain).

- [ ] **Step 2: Run the tests**

```bash
cd contracts && pnpm exec hardhat test
```
Expected: all tests pass.

- [ ] **Step 3: Delete `MockINFT.sol`**

```bash
rm contracts/contracts/MockINFT.sol
```

- [ ] **Step 4: Update `deploy-billing.ts`**

Edit `contracts/scripts/deploy-billing.ts`:
- Remove the entire MockINFT deployment block (the `Inft = await ethers.getContractFactory("MockINFT")` section + the `mockInftDeployed` flag + the `mockInft` field in the output JSON).
- Drop `inftAddress` from the `TaarsBilling` constructor args.

- [ ] **Step 5: Compile + redeploy on Sepolia (manual)**

```bash
cd contracts && pnpm exec hardhat compile
# user runs: pnpm exec hardhat run scripts/deploy-billing.ts --network sepolia
```
Expected: clean compile. The deploy step is left for the user to run manually so they can update the deployed `TAARS_BILLING_ADDRESS`.

- [ ] **Step 6: Commit**

```bash
git add contracts/test/TaarsBilling.test.ts contracts/scripts/deploy-billing.ts
git rm contracts/contracts/MockINFT.sol
git commit -m "chore(contracts): remove MockINFT mirror, update tests + deploy script"
```

---

### Task C3: Server reads 0G INFT ownership before settlement

**Files:**
- Modify: `server/src/services/inft.ts` (add `ownerOf` reader)
- Modify: `server/src/services/billing.ts`
- Modify: `server/src/env.ts` (drop `MOCK_INFT_ADDRESS`)

- [ ] **Step 1: Add `getInftOwnerOnZeroG` to `inft.ts`**

Edit `server/src/services/inft.ts`. Append a new export:

```ts
const ownerOfAbi = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export async function getInftOwnerOnZeroG(tokenId: bigint): Promise<Address> {
  const transport = http(env.OG_RPC_URL);
  const publicClient = createPublicClient({ chain: ogChain, transport });
  const owner = (await publicClient.readContract({
    address: getInftAddress(),
    abi: ownerOfAbi,
    functionName: 'ownerOf',
    args: [tokenId],
  })) as Address;
  return owner;
}
```

- [ ] **Step 2: Update `billing.ts` to call the new claim signature**

Edit `server/src/services/billing.ts`. Find any call to the contract's `claimRevenue(tokenId)` and replace with `claimRevenueFor(tokenId, ownerAddr)` where `ownerAddr` is read from `getInftOwnerOnZeroG(tokenId)`. Also update the contract ABI fragment in this file to remove `inft()` getter references and rename `claimRevenue` → `claimRevenueFor` with the new args.

For `setRate` flows (if any are server-driven), call `setRate` from the oracle wallet (already the deployer). The contract no longer enforces token ownership on-chain — the server must verify before calling:

```ts
import { getInftOwnerOnZeroG } from './inft.js';
// before any rate change or claim:
const realOwner = await getInftOwnerOnZeroG(tokenId);
if (realOwner.toLowerCase() !== requestedOwner.toLowerCase()) {
  throw new Error(`ownership mismatch: 0G says ${realOwner}, request claims ${requestedOwner}`);
}
```

- [ ] **Step 3: Drop `MOCK_INFT_ADDRESS` from env**

Edit `server/src/env.ts`. Remove the line:
```ts
MOCK_INFT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
```

Grep for any remaining references and remove them:
```bash
grep -rn "MOCK_INFT_ADDRESS" server/ web/ discord-bot/ sdk/
```
Expected: no matches after cleanup.

- [ ] **Step 4: Type-check**

```bash
cd server && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/inft.ts server/src/services/billing.ts server/src/env.ts
git commit -m "feat(billing): verify INFT ownership on real 0G before settlement"
```

---

## Final Verification

- [ ] **Step 1: End-to-end smoke test**

1. Start: `cd server && pnpm dev` and `cd web && pnpm dev`.
2. Visit `/` → featured grid loads from `/agents`.
3. Visit `/explore` → 7 cards.
4. Visit a chat page (e.g. `/vitalik`) → no mock banner, real reply via 0G or OpenAI.
5. Stop the server, unset `OG_BROKER_PROVIDER` and `OPENAI_API_KEY`, restart → red banner appears, sending a message returns the typed error.

- [ ] **Step 2: Repository scan for residual mocks**

```bash
grep -rniE "mock|placeholder demo response" --include="*.ts" --include="*.tsx" --include="*.sol" \
  server/src web/src contracts/contracts sdk/src discord-bot/src \
  | grep -v "MockUSDC" | grep -v test
```
Expected: no matches referring to LLM, INFT mirror, or hardcoded agents. (`MockUSDC` is intentionally left — Sepolia has no real USDC.)

- [ ] **Step 3: Final commit if any cleanup remains**

```bash
git status
git add -A && git commit -m "chore: final mock cleanup"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Hardcoded community/featured agents → Phase A (registry + hook).
- ✅ MockLLM removed + status UI → Phase B.
- ✅ Demo replies removed → Phase B Task B1 deletes `MockProvider`.
- ✅ Real 0G INFT integration → Phase C (mint already real; mirror removed; ownership verified on real 0G).

**Out of scope (intentional):**
- `MockUSDC.sol` remains — Sepolia has no real USDC, and the user did not flag it.
- Fixing all UI consumers' field renames (`pricePerMin` → `pricePerMinUsd`) is task A3; if any consumer file is missed, the type-check in A3 step 6 will catch it.

**Known risks:**
- Removing `onlyTokenOwner` from `TaarsBilling.setRate` makes the oracle the sole gatekeeper. Acceptable for hackathon since the oracle is already trusted with `settleSession`. Document this in the contract NatSpec if shipping post-hackathon.
