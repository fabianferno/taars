# Hackathon judging prep — Taars

Practice doc: expected judge questions, skeptic angles, and concise answer hooks. Use it for Q&A drills and demo rehearsal.

---

## How to use this

- Read a section aloud; answer in **60–90 seconds** without slides when possible.
- For each “hard” question, prep **one metric, one diagram sentence, and one demo beat** (what you show if time).
- If a judge interrupts, default to: **Problem → your differentiator → live demo or architecture in one breath**.

---

## Judging panel (this event)

| Judge | Org | Likely lens (prepare for this) |
| ----- | --- | ------------------------------ |
| **Eskender Abebe** | [Archetype](https://www.archetype.fund/) | Crypto × AI that is **actually composable infrastructure**, not narrative; **agents** and **protocol product** clarity; deep on **ENS** (he was Head of Product at ENS) and **elizaOS**-class frameworks (ex–CPO Eliza Labs). |
| **Andrew Hong** | [Herd Labs](https://docs.herd.eco/) | **On-chain truth**: contracts, verification, what an agent can **prove** vs assume; **MCP** and tooling that lets agents do **research / due diligence** onchain; product narrative that could connect to “AI that reads the chain.” |
| **Luca Malpiedi** | KeeperHub | **Workflow automation** that is load-bearing: why these hooks, what they attest, **failure modes**, and what you’d add next if Taars ships. |

**Panel dynamics:** Eskender may push hardest on “why not elizaOS + Stripe” and on ENS correctness. Andrew may ask how you’d **validate** or **inspect** your own contracts and billing paths. Luca should get a **crisp, humble** KeeperHub story (three workflows, one audit example)—avoid hand-waving.

---

### Eskender Abebe (Archetype) — likely questions

1. **How is this not “elizaOS + a few APIs”?**  
   *Hook:* Name **one** architectural commitment: portable identity + **load-bearing** ENS records + **on-chain** billing / revenue routing + **attested** lifecycle—not a plugin theme.

2. **You’re using ENS as more than a name—walk me through the text records that matter at runtime.**  
   *Hook:* `taars.storage` (decrypt path), `taars.price` (x402), `taars.inft` (0G)—**chat and paywall break** if these are wrong.

3. **What is the agent’s “source of truth” for personality and skills—and who can change it?**  
   *Hook:* Blobs on 0G, pointers on ENS/INFT; operator vs user; **transfer** / re-encryption story if they go deep.

4. **Where does crypto actually earn its keep in the user journey vs. where you could centralize?**  
   *Hook:* Be intellectually honest: what’s ideological vs **necessary** for your thesis (ownership, splits, discovery).

5. **If you had one more week, what would you ship to make the “crypto × AI” case sharper?**  
   *Hook:* Benchmarks, verifiable step, or creator economics—pick **one** credible slice.

---

### Andrew Hong (Herd Labs) — likely questions

1. **If I pointed an agent at your `TaarsBilling` / proxy contracts, what would it get wrong without your docs?**  
   *Hook:* UUPS, role/Ops, **settlements**, `ownerOf` checks—show you know the sharp edges (see also “trap” section).

2. **How would you use on-chain data to prove usage or revenue in a dashboard?**  
   *Hook:* Events you’d index, **Dune-able** metrics, Sepolia today vs mainnet later—stay concrete.

3. **Herd is big on MCP + onchain research—does Taars expose something agent-readable (MCP, OpenAPI) or only a web app?**  
   *Hook:* You have an `mcp/` package in the repo—tie **real** capabilities, not vapor “we could MCP.”

4. **What’s the due diligence story for a user picking an agent?**  
   *Hook:* ENS resolution, contract linkage, **what’s encrypted** vs public metadata—trust minimization where you can.

5. **What’s the funniest bug you found integrating LLM + chain + storage?**  
   *Hook:* One authentic story > generic “we had challenges.”

---

### Luca Malpiedi (KeeperHub) — likely questions

1. **Why these three workflows—`billingSettle`, `inftTransfer`, `discordDeploy`—and what exactly is each attesting?**  
   *Hook:* Map **event in app** → **on-chain read/tx** → **KH execution** → **audit log row** (`executionId`).

2. **What happens if KeeperHub is slow or unavailable?**  
   *Hook:* User-facing path still works vs delayed attestation; **never** claim the chain path depends on KH for safety-critical settlement unless true.

3. **What would you add as a fourth workflow if you continued?**  
   *Hook:* e.g. mint-complete, voice job done, TEE attestation—pick **one** aligned with their product.

4. **Show me how you’d correlate an on-chain tx with a KH run in your audit trail.**  
   *Hook:* `server/.audit/*.jsonl` + tx hash / block—**prep one example** before the pitch.

5. **Why KeeperHub vs. a cron + webhook to your own DB?**  
   *Hook:* Third-party attestable workflows, less DIY ops, fits operator story—be respectful, not salesy.

---

## Generic personas (extra drills)

| Persona | Cares most about |
| -------- | ----------------- |
| **Technical** | Correct architecture, security, what actually runs on-chain vs off-chain, integration quality |
| **Product / UX** | Who pays, who gets value in 2 minutes, onboarding friction |
| **Track / sponsor** | Use of required APIs, SDKs, or partner infra; how much is “real” vs mocked |
| **Impact / ethics** | Data ownership, abuse, voice/AI safety, alignment with stated user need |
| **Business** | Moat, why not a hosted SaaS clone without Web3 |

---

## Innovation & differentiation

1. **What exactly is novel here versus “an NFT plus a chatbot”?**  
   *Hook:* INFT as identity + portable encrypted “soul” blobs; ENS as discovery and **load-bearing** config (`taars.storage`, `taars.price`), not just branding.

2. **Why does this need a blockchain? Why not Postgres + Stripe?**  
   *Hook:* Portable agent identity, user-owned naming, programmable revenue split on-chain, transparent billing attestation—not *only* decentralization theater.

3. **How are you different from Character.ai, OpenAI GPTs, or elizaOS agents?**  
   *Hook:* Specific stack: agent linked to **on-chain identity**, **per-agent pricing** via ENS, **x402** paywall, **0G** for encrypted artifact storage, optional **voice** pipeline.

---

## Technical execution

4. **Walk through the request path for one chat message end-to-end.**  
   *Hook:* Resolve ENS → fetch `taars.storage` pointer → pull encrypted blob from 0G → decrypt → LLM → session store; mention 402 when unpaid.

5. **What runs in the TEE vs what runs on your server?**  
   *Hook:* OpenVoice-style service boundary; **raw audio stays inside** the trust boundary you define for prod; API contract at the edge.

6. **What breaks if `ENCRYPTION_KEY` leaks? What breaks if the deployer key leaks?**  
   *Hook:* Encryption key → ciphertext exposure risk; deployer key → ceremony/operator actions—be honest and say what you rotate or scope.

7. **Why both viem and ethers?**  
   *Hook:* Pragmatic: different surfaces (HTTP vs contract ergonomics); you’re prioritizing shipping a coherent pipeline.

8. **How do you handle rate limits, LLM failures, and partial storage outages?**  
   *Hook:* User-visible errors, retries where cheap, degrade chat vs minting vs billing separately.

---

## Integration & sponsor fit (adapt to your hackathon tracks)

9. **Which parts use 0G Storage vs chain vs ENS—and show one tx or indexer proof.**  
   *Hook:* Uploads return hashes that land in INFT `IntelligentData`; explorer or screenshot if live.

10. **Prove the x402 flow is real: what returns 402 and what settles payment?**  
    *Hook:* HTTP 402 challenge, client pays through `TaarsBilling`, KeeperHub workflow attests **billingSettle**—tie narrative to **auditable** operator actions.

11. **What does KeeperHub attest, and why should we care?**  
    *Hook:* Cross-reference `executionId` with on-chain actions in your audit logs—**traceability** for judges who want “serious infra.”

---

## Security, privacy, abuse

12. **Who can read the soul/skills/voice blobs?**  
    *Hook:* Encryption at rest with your key material model; clarify **user vs operator** threat model honestly.

13. **What stops someone from cloning prompts or bypassing the paywall?**  
    *Hook:* Economic + route protection; no silver bullet in 48h—state what you enforce on the server and what’s roadmap (e.g. watermarking, stronger auth).

14. **Voice data: retention, consent, minors**  
    *Hook:* Processing location (TEE intent), minimal retention, clear “not for medical/legal” if applicable.

---

## Product, UX & demo

15. **In 30 seconds: what do I do as a new user?**  
    *Hook:* One hero path—e.g. explore → pick agent → hit paywall → pay → chat with voice optional.

16. **What’s the “wow” moment in the demo—exactly when do you show it?**  
    *Hook:* Script it: e.g. ENS resolution + decrypted personality, or 402 → paid session, or transfer / revenue split.

17. **What’s intentionally not built (cut scope) and still fair to judge?**  
    *Hook:* Name 2–3 gaps and 1 sentence each on next step—judges respect scope discipline.

---

## Business & roadmap

18. **Who pays whom, and why would creators use this?**  
    *Hook:* Refer to billing split (e.g. 90/7/3 narrative from architecture) and **creator incentive** in one sentence.

19. **What’s the moat in 12 months?**  
    *Hook:* Network effects on naming + marketplace of agents, deeper attestations, better TEE story—not buzzwords list.

20. **Why Sepolia / testnet—what’s the mainnet story?**  
    *Hook:* Hackathon reality + one concrete migration step (contracts, ENS, USDC).

---

## Likely objections → short rebuttal strategy

| Objection | Skeptic level | Rebuttal angle |
|-----------|----------------|----------------|
| “This is a wrapper around APIs.” | High | Acknowledge; pivot to **composition**: identity + storage + payments + attestation in one user journey competitors don’t ship together. |
| “Web3 adds friction.” | Medium | Agree for onboarding; show **who** benefits (creator ownership, programmable revenue) and demo the **smoothest** path you built. |
| “TEE / encryption story is hand-wavy.” | Medium | Separate **intent** (architecture) from **demo** (what’s simulated); show boundary diagram in 20 seconds. |
| “Paywall will kill growth.” | Low–medium | Position as **quality filter** and creator sustainability; optional free tier if you have it. |

---

## “Trap” questions (practice staying calm)

- **If I inspect your contract on-chain, what will confuse me?** → Name one sharp edge (proxy, testnet config, operator role).
- **What did the team argue about at 3am?** → One real tradeoff (speed vs security, scope cut).
- **Why should you win over the team next to you?** → Compliment them, then one **non-generic** differentiator tied to your demo.

---

## 5-minute rehearsal checklist

- [ ] Problem in **one sentence** (non-jargon).
- [ ] Architecture: **three boxes** (client → server → chain/storage).
- [ ] Demo script with **backup path** if RPC/API is slow.
- [ ] Honest **limitations** slide or phrase.
- [ ] One **number** (latency, cost, tx count, or user steps).

---

## Blank lines for your own notes

**Our strongest answer (memorize):**

---

**Our honest limitation + fix:**

---

**Demo backup if network fails:**

---

*Tailored for judges Eskender Abebe (Archetype), Andrew Hong (Herd Labs), Luca Malpiedi (KeeperHub). Stack: Next.js, Hono, 0G, ENS, x402, INFT, KeeperHub, OpenVoice.*
