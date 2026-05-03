import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import type { MintRequest, MintResponse, MintErrorResponse } from '@taars/sdk';
import { trainVoiceProfile } from '../services/voice.js';
import { uploadEncryptedBundleToZeroG } from '../services/storage.js';
import { mintINFT } from '../services/inft.js';
import {
  createSubname,
  setTextsMulticall,
  transferSubnameOwnership,
} from '../services/ens.js';
import { env } from '../env.js';
import {
  checkpointKey,
  clearCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
  type MintCheckpoint,
} from '../services/mintCheckpoint.js';
import { appendAgent } from '../services/agentsIndex.js';
import { _invalidateAgentsCache } from '../services/agents.js';

const personalitySchema = z.object({
  vibe: z.string().min(1),
  expertise: z.string().min(1),
  catchphrases: z.string().default(''),
  avoid: z.string().default(''),
  example1Q: z.string().default(''),
  example1A: z.string().default(''),
  example2Q: z.string().default(''),
  example2A: z.string().default(''),
  example3Q: z.string().default(''),
  example3A: z.string().default(''),
});

const requestSchema = z.object({
  ensLabel: z.string().regex(/^[a-z0-9-]{2,32}$/),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  voiceSampleBase64: z.string().min(100),
  voiceSampleMime: z.string().default('audio/webm'),
  personality: personalitySchema,
  pricePerMinUsd: z.string().regex(/^\d+(\.\d+)?$/),
  description: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export const mint = new Hono();

mint.post('/', async (c) => {
  const body = (await c.req.json()) as MintRequest;
  const parsed = requestSchema.parse(body);
  let step: MintErrorResponse['step'] = 'unknown';

  try {
    // 1. Train voice profile (OpenVoice clone, narrated as 0G Compute fine-tune in production).
    step = 'voice';
    const voiceBytes = Buffer.from(parsed.voiceSampleBase64, 'base64');
    const voice = await trainVoiceProfile(parsed.ensLabel, voiceBytes, parsed.voiceSampleMime);

    // 2. Build the artifact bundle: soul (system prompt), skills (placeholder), voice profile.
    step = 'encrypt';
    const soul = buildSoul(parsed);
    const skills = JSON.stringify({ skills: [], created_at: Date.now() }, null, 2);
    const voiceConfig = JSON.stringify(
      {
        voice_id: voice.voiceId,
        provider: voice.provider,
        sample_rate: voice.sampleRate,
        ens_label: parsed.ensLabel,
      },
      null,
      2
    );

    // 3. Encrypt + upload each blob to 0G Storage.
    step = 'storage';
    const { intelligentData, merkleRoot } = await uploadEncryptedBundleToZeroG([
      { description: 'soul.md', content: soul },
      { description: 'skills.json', content: skills },
      { description: 'voice.json', content: voiceConfig },
    ]);
    // Use the soul.md downloadable root as the ENS taars.storage value so
    // /chat can fetchAndDecrypt(taars.storage) at session-start. The
    // composite merkle root is also recorded onchain via INFT IntelligentData[].
    const storageRoot = intelligentData[0].storageRoot;
    void merkleRoot;

    // 4. Mint INFT on 0G Chain.
    step = 'inft';
    const { tokenId, txHash: txInft } = await mintINFT(
      parsed.ownerAddress as `0x${string}`,
      intelligentData.map((d) => ({ dataDescription: d.dataDescription, dataHash: d.dataHash }))
    );

    // 5. Create ENS subname under taars.eth on Sepolia. Deployer is set as the
    //    initial wrapped owner so it can write text records in the next step;
    //    ownership is transferred to the user in step 7 (operator pattern).
    step = 'ens.subname';
    const fullEns = `${parsed.ensLabel}.${env.PARENT_ENS_NAME}`;
    const sub = await createSubname(parsed.ensLabel, parsed.ownerAddress as `0x${string}`);

    // 6. Set text records via multicall while deployer still owns the subname.
    step = 'ens.records';
    const records = buildRecords(parsed, tokenId, storageRoot, voice.voiceId);
    const multicallTx = await setTextsMulticall(fullEns, records);
    const txEnsTextRecords = [multicallTx];

    // 7. Transfer the wrapped subname to the user. After this, the user is the
    //    on-chain owner of <label>.taars.eth — the PRD contract holds.
    step = 'ens.transfer';
    const transferRes = await transferSubnameOwnership(
      fullEns,
      parsed.ownerAddress as `0x${string}`
    );

    const response: MintResponse = {
      ok: true,
      tokenId: tokenId.toString(),
      storageRoot,
      intelligentData: intelligentData.map((d) => ({
        dataDescription: d.dataDescription,
        dataHash: d.dataHash,
        storageRoot: d.storageRoot,
      })),
      ensLabel: parsed.ensLabel,
      ensFullName: fullEns,
      voiceProfileId: voice.voiceId,
      txInft,
      txEnsSubname: sub.txHash ?? '',
      txEnsTextRecords: transferRes.txHash
        ? [...txEnsTextRecords, transferRes.txHash]
        : txEnsTextRecords,
    };
    try {
      await appendAgent({
        tokenId: tokenId.toString(),
        ensLabel: parsed.ensLabel,
        ownerAddress: parsed.ownerAddress,
        mintedAt: Math.floor(Date.now() / 1000),
      });
      _invalidateAgentsCache();
    } catch (e) {
      console.warn('[mint] agents-index append failed:', (e as Error).message);
    }
    return c.json(response);
  } catch (e) {
    const err: MintErrorResponse = {
      ok: false,
      step,
      error: e instanceof Error ? e.message : String(e),
    };
    console.error('[mint failed]', err);
    return c.json(err, 500);
  }
});

/// Streaming variant of /mint. Emits one JSON-line event per pipeline step:
///   {"type":"step","step":"voice","status":"running"}
///   {"type":"step","step":"voice","status":"done","detail":{...}}
///   ...
///   {"type":"done","result":<MintResponse>}
///   or {"type":"error","step":"...","error":"..."}
mint.post('/stream', async (c) => {
  const fresh = c.req.query('fresh') === '1' || c.req.query('fresh') === 'true';
  const body = (await c.req.json()) as MintRequest;
  const parsed = requestSchema.parse(body);
  const ckptKey = checkpointKey(parsed.ownerAddress, parsed.ensLabel);
  if (fresh) await clearCheckpoint(ckptKey);
  const initial = (await loadCheckpoint(ckptKey)) ?? null;
  // If a previous attempt completed for this exact key, treat the new request as fresh.
  let prior: MintCheckpoint | null = initial?.completed ? null : initial;
  if (initial?.completed) await clearCheckpoint(ckptKey);

  return stream(c, async (out) => {
    out.onAbort(() => {
      console.warn('[mint/stream] aborted by client');
    });
    let step: MintErrorResponse['step'] = 'unknown';
    const emit = async (obj: object) => {
      await out.write(JSON.stringify(obj) + '\n');
    };

    const persist = (patch: Partial<MintCheckpoint>) =>
      saveCheckpoint(ckptKey, {
        ...patch,
        ensLabel: parsed.ensLabel,
        ownerAddress: parsed.ownerAddress,
      }).then((next) => {
        prior = next;
      });

    try {
      // ---- 1. voice ----
      step = 'voice';
      let voice: { voiceId: string; provider: string; sampleRate: number };
      if (prior?.voice) {
        voice = prior.voice;
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { voiceId: voice.voiceId, resumed: true },
        });
      } else {
        await emit({ type: 'step', step, status: 'running', label: 'Training voice profile' });
        const voiceBytes = Buffer.from(parsed.voiceSampleBase64, 'base64');
        const v = await trainVoiceProfile(parsed.ensLabel, voiceBytes, parsed.voiceSampleMime);
        voice = { voiceId: v.voiceId, provider: v.provider, sampleRate: v.sampleRate };
        await persist({ voice });
        await emit({ type: 'step', step, status: 'done', detail: { voiceId: voice.voiceId } });
      }

      // ---- 2. encrypt (no on-chain side effect; cheap to recompute every time) ----
      step = 'encrypt';
      await emit({ type: 'step', step, status: 'running', label: 'Encrypting artifacts' });
      const soul = buildSoul(parsed);
      const skills = JSON.stringify({ skills: [], created_at: Date.now() }, null, 2);
      const voiceConfig = JSON.stringify(
        {
          voice_id: voice.voiceId,
          provider: voice.provider,
          sample_rate: voice.sampleRate,
          ens_label: parsed.ensLabel,
        },
        null,
        2
      );
      await emit({ type: 'step', step, status: 'done' });

      // ---- 3. storage ----
      step = 'storage';
      let intelligentData: Array<{
        dataDescription: string;
        dataHash: `0x${string}`;
        storageRoot: string;
      }>;
      let storageRoot: string;
      if (prior?.storage) {
        intelligentData = prior.storage.intelligentData;
        storageRoot = prior.storage.storageRoot;
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { storageRoot, blobs: intelligentData.length, resumed: true },
        });
      } else {
        await emit({ type: 'step', step, status: 'running', label: 'Uploading to 0G Storage' });
        const { intelligentData: idata, merkleRoot } = await uploadEncryptedBundleToZeroG([
          { description: 'soul.md', content: soul },
          { description: 'skills.json', content: skills },
          { description: 'voice.json', content: voiceConfig },
        ]);
        intelligentData = idata;
        storageRoot = idata[0].storageRoot;
        void merkleRoot;
        await persist({ storage: { intelligentData, storageRoot } });
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { storageRoot, blobs: intelligentData.length },
        });
      }

      // ---- 4. inft ----
      step = 'inft';
      let tokenId: bigint;
      let txInft: string;
      if (prior?.inft) {
        tokenId = BigInt(prior.inft.tokenId);
        txInft = prior.inft.txHash;
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { tokenId: prior.inft.tokenId, txHash: txInft, resumed: true },
        });
      } else {
        await emit({ type: 'step', step, status: 'running', label: 'Minting INFT on 0G Chain' });
        const res = await mintINFT(
          parsed.ownerAddress as `0x${string}`,
          intelligentData.map((d) => ({ dataDescription: d.dataDescription, dataHash: d.dataHash }))
        );
        tokenId = res.tokenId;
        txInft = res.txHash;
        await persist({ inft: { tokenId: tokenId.toString(), txHash: txInft } });
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { tokenId: tokenId.toString(), txHash: txInft },
        });
      }

      // ---- 5. ens.subname ----
      step = 'ens.subname';
      const fullEns = `${parsed.ensLabel}.${env.PARENT_ENS_NAME}`;
      let subnameTx: string | undefined;
      if (prior?.ensSubname) {
        subnameTx = prior.ensSubname.txHash;
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { txHash: subnameTx ?? null, resumed: true },
        });
      } else {
        await emit({
          type: 'step',
          step,
          status: 'running',
          label: `Creating ${fullEns}`,
        });
        const sub = await createSubname(parsed.ensLabel, parsed.ownerAddress as `0x${string}`);
        subnameTx = sub.txHash ?? undefined;
        await persist({ ensSubname: { txHash: subnameTx } });
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { txHash: subnameTx ?? null },
        });
      }

      // ---- 6. ens.records ----
      step = 'ens.records';
      let multicallTx: string;
      if (prior?.ensRecords) {
        multicallTx = prior.ensRecords.txHash;
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: {
            txHash: multicallTx,
            recordCount: prior.ensRecords.recordCount,
            resumed: true,
          },
        });
      } else {
        await emit({ type: 'step', step, status: 'running', label: 'Writing ENS text records' });
        const records = buildRecords(parsed, tokenId, storageRoot, voice.voiceId);
        multicallTx = await setTextsMulticall(fullEns, records);
        await persist({
          ensRecords: { txHash: multicallTx, recordCount: records.length },
        });
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: { txHash: multicallTx, recordCount: records.length },
        });
      }

      // ---- 7. ens.transfer ----
      step = 'ens.transfer';
      let transferTx: string | undefined;
      let alreadyOwned: boolean | undefined;
      if (prior?.ensTransfer) {
        transferTx = prior.ensTransfer.txHash;
        alreadyOwned = prior.ensTransfer.alreadyOwned;
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: {
            txHash: transferTx ?? null,
            alreadyOwned,
            newOwner: parsed.ownerAddress,
            resumed: true,
          },
        });
      } else {
        await emit({
          type: 'step',
          step,
          status: 'running',
          label: `Transferring ${fullEns} to ${parsed.ownerAddress.slice(0, 10)}…`,
        });
        const transferRes = await transferSubnameOwnership(
          fullEns,
          parsed.ownerAddress as `0x${string}`
        );
        transferTx = transferRes.txHash ?? undefined;
        alreadyOwned = transferRes.alreadyOwned;
        await persist({ ensTransfer: { txHash: transferTx, alreadyOwned } });
        await emit({
          type: 'step',
          step,
          status: 'done',
          detail: {
            txHash: transferTx ?? null,
            alreadyOwned,
            newOwner: parsed.ownerAddress,
          },
        });
      }

      const response: MintResponse = {
        ok: true,
        tokenId: tokenId.toString(),
        storageRoot,
        intelligentData: intelligentData.map((d) => ({
          dataDescription: d.dataDescription,
          dataHash: d.dataHash,
          storageRoot: d.storageRoot,
        })),
        ensLabel: parsed.ensLabel,
        ensFullName: fullEns,
        voiceProfileId: voice.voiceId,
        txInft,
        txEnsSubname: subnameTx ?? '',
        txEnsTextRecords: transferTx ? [multicallTx, transferTx] : [multicallTx],
      };
      await persist({ completed: true });
      try {
        await appendAgent({
          tokenId: tokenId.toString(),
          ensLabel: parsed.ensLabel,
          ownerAddress: parsed.ownerAddress,
          mintedAt: Math.floor(Date.now() / 1000),
        });
        _invalidateAgentsCache();
      } catch (e) {
        console.warn('[mint] agents-index append failed:', (e as Error).message);
      }
      await emit({ type: 'done', result: response });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[mint/stream failed]', step, error);
      await emit({ type: 'error', step, error });
    }
  });
});

/**
 * GET /mint/checkpoint?owner=0x...&ensLabel=foo
 * Inspect the current checkpoint state (debug / UI use).
 */
mint.get('/checkpoint', async (c) => {
  const owner = c.req.query('owner') ?? '';
  const label = c.req.query('ensLabel') ?? '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(owner) || !/^[a-z0-9-]{2,32}$/.test(label)) {
    return c.json({ ok: false, error: 'invalid owner or ensLabel' }, 400);
  }
  const ckpt = await loadCheckpoint(checkpointKey(owner, label));
  return c.json({ ok: true, checkpoint: ckpt });
});

/**
 * DELETE /mint/checkpoint?owner=0x...&ensLabel=foo
 * Wipe the checkpoint so the next /mint/stream starts fresh.
 */
mint.delete('/checkpoint', async (c) => {
  const owner = c.req.query('owner') ?? '';
  const label = c.req.query('ensLabel') ?? '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(owner) || !/^[a-z0-9-]{2,32}$/.test(label)) {
    return c.json({ ok: false, error: 'invalid owner or ensLabel' }, 400);
  }
  await clearCheckpoint(checkpointKey(owner, label));
  return c.json({ ok: true });
});

/**
 * Canonical ENS text records for a taars replica. The settlement chain (USDC
 * billing) is Base in production but Sepolia on the hackathon path — read it
 * from BILLING_NETWORK_LABEL (defaults to 'sepolia').
 */
function buildRecords(
  parsed: z.infer<typeof requestSchema>,
  tokenId: bigint,
  storageRoot: string,
  voiceId: string
): Array<{ key: string; value: string }> {
  const billingNetwork = process.env.BILLING_NETWORK_LABEL || 'sepolia';
  const records: Array<{ key: string; value: string }> = [
    { key: 'taars.inft', value: `0g:${env.OG_CHAIN_ID}:${tokenId.toString()}` },
    { key: 'taars.storage', value: storageRoot },
    { key: 'taars.created', value: String(Math.floor(Date.now() / 1000)) },
    { key: 'taars.version', value: 'taars-v1' },
    { key: 'taars.price', value: parsed.pricePerMinUsd },
    { key: 'taars.currency', value: 'USDC' },
    { key: 'taars.network', value: billingNetwork },
    { key: 'taars.voice', value: voiceId },
    { key: 'taars.owner', value: parsed.ownerAddress },
    {
      key: 'description',
      value:
        parsed.description ?? `taars replica created ${new Date().toISOString().slice(0, 10)}`,
    },
    { key: 'url', value: `https://taars.app/${parsed.ensLabel}` },
  ];
  if (parsed.avatarUrl) records.push({ key: 'avatar', value: parsed.avatarUrl });
  return records;
}

function buildSoul(parsed: z.infer<typeof requestSchema>): string {
  const p = parsed.personality;
  return `# taars replica: ${parsed.ensLabel}.${env.PARENT_ENS_NAME}

## vibe
${p.vibe}

## expertise
${p.expertise}

## phrases I use
${p.catchphrases}

## topics I avoid
${p.avoid}

## example exchanges

Q: ${p.example1Q}
A: ${p.example1A}

Q: ${p.example2Q}
A: ${p.example2A}

Q: ${p.example3Q}
A: ${p.example3A}

## guardrails
- Always identify as an AI replica created on taars, not the real person.
- Do not give financial, legal, or medical advice.
`;
}
