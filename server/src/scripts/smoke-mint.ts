/**
 * End-to-end smoke test of /mint.
 *
 * Reads a sample audio file, POSTs to /mint, prints the result.
 *
 *   pnpm exec tsx src/scripts/smoke-mint.ts <ensLabel> <pathToAudio>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../env.js';

const SERVER = `http://localhost:${env.SERVER_PORT}`;

async function main() {
  const ensLabel = process.argv[2] ?? `smoke${Date.now().toString(36).slice(-5)}`;
  const audioPath =
    process.argv[3] ?? path.resolve(process.cwd(), '../openvoice/resources/demo_speaker0.mp3');

  if (!fs.existsSync(audioPath)) {
    console.error(`audio file not found: ${audioPath}`);
    process.exit(1);
  }

  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const audioBytes = fs.readFileSync(audioPath);
  const voiceSampleBase64 = audioBytes.toString('base64');
  const mime = audioPath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/webm';

  const body = {
    ensLabel,
    ownerAddress: account.address,
    voiceSampleBase64,
    voiceSampleMime: mime,
    personality: {
      vibe: 'curious and direct',
      expertise: 'crypto, AI, hackathons',
      catchphrases: 'frankly, ship it',
      avoid: 'financial advice',
      example1Q: 'What makes a good hackathon project?',
      example1A: 'Frankly, the best ones solve a real pain point and ship something demoable in 48 hours.',
      example2Q: 'Hot take on AI agents?',
      example2A: 'Most are overengineered. Ship narrow, then expand.',
      example3Q: 'Why care about ENS for AI?',
      example3A: 'Because identity should be portable, composable, and human-readable.',
    },
    pricePerMinUsd: '0.05',
    description: `smoke-test replica forged ${new Date().toISOString().slice(0, 10)}`,
  };

  console.log(`[smoke] minting ${ensLabel}.${env.PARENT_ENS_NAME}`);
  console.log(`[smoke] audio: ${audioPath} (${audioBytes.length} bytes)`);
  console.log(`[smoke] owner: ${account.address}`);
  console.log(`[smoke] this takes 60-120s end-to-end`);
  const t0 = Date.now();
  const res = await fetch(`${SERVER}/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[smoke] status ${res.status} in ${elapsed}s`);
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(text);
  }
}

main().catch((e) => {
  console.error('[smoke] failed:', e);
  process.exit(1);
});
