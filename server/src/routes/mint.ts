import { Hono } from 'hono';
import { z } from 'zod';
import type { MintRequest, MintResponse, MintErrorResponse } from '@taars/sdk';
import { trainVoiceProfile } from '../services/voice.js';
import { uploadEncryptedBundleToZeroG } from '../services/storage.js';
import { mintINFT } from '../services/inft.js';
import { createSubname, setTexts } from '../services/ens.js';
import { env } from '../env.js';

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

    // 5. Create ENS subname under taars.eth on Sepolia.
    step = 'ens.subname';
    const fullEns = `${parsed.ensLabel}.${env.PARENT_ENS_NAME}`;
    const sub = await createSubname(parsed.ensLabel, parsed.ownerAddress as `0x${string}`);

    // 6. Set text records on the new subname (deployer is operator for now).
    // Note: setText requires the caller to own the name. We register subname owner = user wallet,
    // but in Plan 1 the deployer also writes the initial records. For that to work the deployer
    // must own the name at write time. So: write records first, then re-assign? Simpler: deployer
    // owns the subname initially, writes records, then transfers via setOwner.
    // For hackathon: deployer keeps subname ownership; user ownership is shown via taars.owner
    // text record. We can iterate later.
    step = 'ens.records';
    const records: Array<{ key: string; value: string }> = [
      { key: 'taars.inft', value: `0g:${env.OG_CHAIN_ID}:${tokenId.toString()}` },
      { key: 'taars.storage', value: storageRoot },
      { key: 'taars.created', value: String(Math.floor(Date.now() / 1000)) },
      { key: 'taars.version', value: 'taars-v1' },
      { key: 'taars.price', value: parsed.pricePerMinUsd },
      { key: 'taars.currency', value: 'USDC' },
      { key: 'taars.network', value: 'sepolia' },
      { key: 'taars.voice', value: voice.voiceId },
      {
        key: 'description',
        value: parsed.description ?? `taars replica created ${new Date().toISOString().slice(0, 10)}`,
      },
      { key: 'url', value: `https://taars.app/${parsed.ensLabel}` },
    ];
    if (parsed.avatarUrl) records.push({ key: 'avatar', value: parsed.avatarUrl });

    // To write text records the deployer must own the subname. Re-create the subname as deployer-owned
    // for now if it isn't. (createSubname is idempotent.)
    void sub; // (sub.owner may be the user; we rely on deployer to be operator on parent).
    const txEnsTextRecords = await setTexts(fullEns, records);

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
      txEnsSubname: sub.txHash ?? '0x',
      txEnsTextRecords,
    };
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
