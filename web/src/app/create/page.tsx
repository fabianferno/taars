'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { PersonalityAnswers, MintResponse } from '@taars/sdk';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { PersonalityForm, emptyPersonality } from '@/components/PersonalityForm';
import { mintReplica, blobToBase64 } from '@/lib/api';

type Step = 'name' | 'voice' | 'personality' | 'price' | 'minting' | 'done';

export default function CreatePage() {
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [step, setStep] = useState<Step>('name');
  const [ensLabel, setEnsLabel] = useState('');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [personality, setPersonality] = useState<PersonalityAnswers>(emptyPersonality);
  const [price, setPrice] = useState('0.05');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResponse | null>(null);

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-md p-6 pt-20 text-center">
        <h1 className="mb-3 text-2xl font-bold">Sign in to forge your taar</h1>
        <p className="mb-6 text-sm text-neutral-400">
          A taar is a creator-owned AI replica — your voice, your personality, on-chain.
        </p>
        <button
          onClick={login}
          className="rounded-full bg-neutral-100 px-6 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-white"
        >
          Sign in
        </button>
      </main>
    );
  }

  async function forge() {
    if (!wallet || !voiceBlob) return;
    setStep('minting');
    setError(null);
    try {
      const voiceSampleBase64 = await blobToBase64(voiceBlob);
      const res = await mintReplica({
        ensLabel,
        ownerAddress: wallet.address as `0x${string}`,
        voiceSampleBase64,
        voiceSampleMime: voiceBlob.type || 'audio/webm',
        personality,
        pricePerMinUsd: price,
      });
      setResult(res);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStep('price');
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 pt-12">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Home
      </Link>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Forge your taar</h1>

      {step === 'name' && (
        <section className="space-y-3">
          <p className="text-sm text-neutral-300">Pick your taar name. This becomes your ENS subname.</p>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={ensLabel}
              onChange={(e) =>
                setEnsLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder="alice"
              className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3"
            />
            <span className="text-sm text-neutral-400">.taars.eth</span>
          </div>
          <button
            disabled={ensLabel.length < 2}
            onClick={() => setStep('voice')}
            className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 transition disabled:opacity-40"
          >
            Next
          </button>
        </section>
      )}

      {step === 'voice' && (
        <section className="space-y-3">
          <VoiceRecorder onComplete={setVoiceBlob} />
          <div className="flex gap-2">
            <button
              onClick={() => setStep('name')}
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
            >
              Back
            </button>
            <button
              disabled={!voiceBlob}
              onClick={() => setStep('personality')}
              className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 'personality' && (
        <section className="space-y-4">
          <PersonalityForm value={personality} onChange={setPersonality} />
          <div className="flex gap-2">
            <button
              onClick={() => setStep('voice')}
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
            >
              Back
            </button>
            <button
              onClick={() => setStep('price')}
              className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 'price' && (
        <section className="space-y-3">
          <label className="block text-sm text-neutral-300">Per-minute rate (USDC)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-32 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3"
          />
          <button
            onClick={forge}
            className="block rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 px-6 py-2.5 font-medium text-white transition hover:opacity-90"
          >
            Forge My taar
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>
      )}

      {step === 'minting' && (
        <section className="space-y-1.5 text-sm text-neutral-300">
          <p>Training voice profile (OpenVoice).</p>
          <p>Encrypting + uploading artifacts to 0G Storage.</p>
          <p>Minting INFT on 0G Chain.</p>
          <p>Registering ENS subname on Sepolia.</p>
          <p className="pt-2 text-neutral-500">This takes ~30–60s.</p>
        </section>
      )}

      {step === 'done' && result && (
        <section className="space-y-3 rounded-2xl border border-fuchsia-700/60 bg-neutral-900/80 p-5">
          <h2 className="text-xl font-bold">Live at {result.ensFullName}</h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            <li>
              INFT token: <span className="font-mono">{result.tokenId}</span>
            </li>
            <li>
              Storage root: <span className="break-all font-mono">{result.storageRoot}</span>
            </li>
            <li>
              Voice profile: <span className="font-mono">{result.voiceProfileId}</span>
            </li>
            <li>
              INFT tx:{' '}
              <a
                className="underline"
                href={`https://chainscan-galileo.0g.ai/tx/${result.txInft}`}
                target="_blank"
                rel="noreferrer"
              >
                {result.txInft.slice(0, 10)}…
              </a>
            </li>
          </ul>
          <button
            onClick={() => router.push(`/${result.ensLabel}`)}
            className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950"
          >
            View profile
          </button>
        </section>
      )}
    </main>
  );
}
