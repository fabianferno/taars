/**
 * Mint the four featured taars on-chain (vitalik / trump / fabian / balaji).
 * Reads /seed/featured.json. Calls POST /mint per replica.
 *
 *   pnpm exec tsx src/scripts/seed-featured.ts [--only=<label,label>]
 *
 * Idempotent-ish: if the ENS subname already exists, /mint will fail at the
 * subname registration step. Run with `--only=<label>` to retry a single one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../env.js';

const SERVER = `http://localhost:${env.SERVER_PORT}`;

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

async function main() {
  const seedPath = path.resolve(process.cwd(), '../seed/featured.json');
  const featured: Featured[] = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyLabels = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);

  for (const f of featured) {
    if (onlyLabels && !onlyLabels.includes(f.ensLabel)) continue;
    const audioPath = path.resolve(process.cwd(), '..', f.voiceSample);
    if (!fs.existsSync(audioPath)) {
      console.warn(`[seed] missing audio for ${f.ensLabel}: ${audioPath} — skipping`);
      continue;
    }
    const audioBytes = fs.readFileSync(audioPath);
    const body = {
      ensLabel: f.ensLabel,
      ownerAddress: account.address,
      voiceSampleBase64: audioBytes.toString('base64'),
      voiceSampleMime: audioPath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/webm',
      personality: f.personality,
      pricePerMinUsd: f.pricePerMinUsd,
      description: f.description ?? `${f.displayName} — taars replica.`,
    };

    console.log(`[seed] minting ${f.ensLabel} (${audioBytes.length} bytes)`);
    const t0 = Date.now();
    const res = await fetch(`${SERVER}/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    if (res.status === 200 && parsed?.ok) {
      console.log(`[seed] ${f.ensLabel} -> token ${parsed.tokenId}, root ${parsed.storageRoot.slice(0,12)}..., voice ${parsed.voiceProfileId} (${elapsed}s)`);
    } else {
      console.error(`[seed] ${f.ensLabel} FAILED in ${elapsed}s status=${res.status}:`, parsed ?? text.slice(0, 200));
    }
  }
}

main().catch((e) => { console.error('[seed] fatal:', e); process.exit(1); });
