/**
 * Repair script: for each featured replica that's missing or partial in ENS,
 * fill in the missing pieces directly (no /mint round-trip — reuses existing
 * INFT tokens minted by an earlier seeding run).
 *
 * Strategy:
 *  - voice: clone via OpenVoice (idempotent — overwrites the stored .npy).
 *  - artifact: encrypt + upload soul/skills/voice config to 0G Storage.
 *  - subname: NameWrapper.setSubnodeRecord (idempotent).
 *  - text records: PublicResolver.multicall — 10 records in 1 tx.
 *  - tokenId mapping is configurable: --map=trump:3,fabian:4,balaji:5
 *
 *   pnpm exec tsx src/scripts/repair-featured.ts --only=trump,fabian,balaji --map=trump:3,fabian:4,balaji:5
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { trainVoiceProfile } from '../services/voice.js';
import { encryptBlob, blobToBytes } from '../services/encrypt.js';
import { uploadEncryptedBundleToZeroG } from '../services/storage.js';
import { createSubname, setTextsMulticall } from '../services/ens.js';
import { env } from '../env.js';

interface Featured {
  ensLabel: string;
  displayName: string;
  voiceSample: string;
  pricePerMinUsd: string;
  description?: string;
  personality: {
    vibe: string; expertise: string; catchphrases: string; avoid: string;
    example1Q: string; example1A: string;
    example2Q: string; example2A: string;
    example3Q: string; example3A: string;
  };
}

function buildSoul(f: Featured): string {
  const p = f.personality;
  return `# taars replica: ${f.ensLabel}.${env.PARENT_ENS_NAME}\n\n## vibe\n${p.vibe}\n\n## expertise\n${p.expertise}\n\n## phrases I use\n${p.catchphrases}\n\n## topics I avoid\n${p.avoid}\n\n## example exchanges\n\nQ: ${p.example1Q}\nA: ${p.example1A}\n\nQ: ${p.example2Q}\nA: ${p.example2A}\n\nQ: ${p.example3Q}\nA: ${p.example3A}\n\n## guardrails\n- Always identify as an AI replica created on taars, not the real person.\n- Do not give financial, legal, or medical advice.\n`;
}

async function repairOne(f: Featured, tokenId: bigint) {
  const fullName = `${f.ensLabel}.${env.PARENT_ENS_NAME}`;
  const audioPath = path.resolve(process.cwd(), '..', f.voiceSample);
  const audioBytes = fs.readFileSync(audioPath);

  console.log(`[repair] ${f.ensLabel}: train voice`);
  const voice = await trainVoiceProfile(
    f.ensLabel,
    audioBytes,
    audioPath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/webm'
  );

  console.log(`[repair] ${f.ensLabel}: encrypt + upload artifacts`);
  const soul = buildSoul(f);
  const skills = JSON.stringify({ skills: [], created_at: Date.now() }, null, 2);
  const voiceConfig = JSON.stringify(
    { voice_id: voice.voiceId, provider: voice.provider, sample_rate: voice.sampleRate, ens_label: f.ensLabel },
    null,
    2
  );
  const { intelligentData } = await uploadEncryptedBundleToZeroG([
    { description: 'soul.md', content: soul },
    { description: 'skills.json', content: skills },
    { description: 'voice.json', content: voiceConfig },
  ]);
  const merkleRoot = intelligentData[0].storageRoot;

  console.log(`[repair] ${f.ensLabel}: ensure subname (idempotent)`);
  await createSubname(f.ensLabel);

  console.log(`[repair] ${f.ensLabel}: multicall set text records`);
  const records = [
    { key: 'taars.inft', value: `0g:${env.OG_CHAIN_ID}:${tokenId.toString()}` },
    { key: 'taars.storage', value: merkleRoot },
    { key: 'taars.created', value: String(Math.floor(Date.now() / 1000)) },
    { key: 'taars.version', value: 'taars-v1' },
    { key: 'taars.price', value: f.pricePerMinUsd },
    { key: 'taars.currency', value: 'USDC' },
    { key: 'taars.network', value: 'sepolia' },
    { key: 'taars.voice', value: voice.voiceId },
    { key: 'description', value: f.description ?? `${f.displayName} taars replica.` },
    { key: 'url', value: `https://taars.app/${f.ensLabel}` },
  ];
  const tx = await setTextsMulticall(fullName, records);
  console.log(`[repair] ${f.ensLabel}: multicall tx = ${tx}`);
  console.log(`[repair] ${f.ensLabel}: DONE -> ${fullName} (token ${tokenId})\n`);
}

async function main() {
  const seedPath = path.resolve(process.cwd(), '../seed/featured.json');
  const featured: Featured[] = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyLabels = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

  const mapArg = process.argv.find((a) => a.startsWith('--map='));
  const tokenMap: Record<string, bigint> = {};
  if (mapArg) {
    for (const pair of mapArg.slice('--map='.length).split(',')) {
      const [label, id] = pair.split(':');
      tokenMap[label] = BigInt(id);
    }
  }

  for (const f of featured) {
    if (onlyLabels && !onlyLabels.includes(f.ensLabel)) continue;
    const tokenId = tokenMap[f.ensLabel];
    if (!tokenId) {
      console.warn(`[repair] no tokenId mapped for ${f.ensLabel} (use --map=${f.ensLabel}:N) — skipping`);
      continue;
    }
    try {
      await repairOne(f, tokenId);
    } catch (e) {
      console.error(`[repair] ${f.ensLabel} FAILED:`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error('[repair] fatal:', e);
  process.exit(1);
});
