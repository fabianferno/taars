'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, ChevronRight, ExternalLink, Sparkles } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { PersonalityAnswers, MintResponse } from '@taars/sdk';
import TopNav from '@/components/TopNav';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { PersonalityForm, emptyPersonality } from '@/components/PersonalityForm';
import { StepProgress, type StepState } from '@/components/Create/StepProgress';
import {
  mintReplicaStream,
  blobToBase64,
  clearMintCheckpoint,
  type MintStepKey,
  type MintStreamEvent,
} from '@/lib/api';

type WizardStep = 'name' | 'voice' | 'personality' | 'price' | 'minting' | 'done';

const WIZARD_LABELS: Record<Exclude<WizardStep, 'minting' | 'done'>, string> = {
  name: 'Name',
  voice: 'Voice',
  personality: 'Personality',
  price: 'Pricing',
};
const WIZARD_ORDER: Array<Exclude<WizardStep, 'minting' | 'done'>> = [
  'name',
  'voice',
  'personality',
  'price',
];

const blankStates = (): Record<MintStepKey, StepState> => ({
  voice: 'pending',
  encrypt: 'pending',
  storage: 'pending',
  inft: 'pending',
  'ens.subname': 'pending',
  'ens.records': 'pending',
  'ens.transfer': 'pending',
});

/** Passage for voice enrollment: natural prose plus varied sounds for a clearer clone. */
const VOICE_SAMPLE_PROMPT =
  'Hello — this is my taar voice sample. I’m speaking clearly and at my normal pace. ' +
  'The evening breeze rustled through tall oak trees near the riverbank. ' +
  'Pack my box with five dozen quality liquor jugs. ' +
  'Thanks for listening; that should be enough for my replica.';

export default function CreatePage() {
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [step, setStep] = useState<WizardStep>('name');
  const [ensLabel, setEnsLabel] = useState('');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceMode, setVoiceMode] = useState<'record' | 'upload'>('record');
  const [personality, setPersonality] = useState<PersonalityAnswers>(emptyPersonality);
  const [price, setPrice] = useState('0.05');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResponse | null>(null);

  const [stepStates, setStepStates] = useState<Record<MintStepKey, StepState>>(blankStates);
  const [stepDetails, setStepDetails] = useState<
    Partial<Record<MintStepKey, Record<string, unknown>>>
  >({});
  const [errorStep, setErrorStep] = useState<MintStepKey | 'unknown' | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  if (!authenticated) {
    return (
      <PageShell>
        <Hero />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-8 max-w-md rounded-3xl border border-surface-dark/60 bg-white p-8 text-center shadow-sm"
        >
          <Sparkles className="mx-auto h-7 w-7 text-accent" />
          <h2 className="mt-3 font-coolvetica text-2xl tracking-tight">Sign in to forge your taar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A taar is a creator-owned AI replica — your voice, your personality, on-chain. Sign in
            with email, Google, or your wallet.
          </p>
          <button
            onClick={login}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:bg-accent-light"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.section>
      </PageShell>
    );
  }

  async function forge(opts?: { fresh?: boolean }) {
    if (!wallet || !voiceBlob) return;
    setStep('minting');
    setError(null);
    setErrorStep(null);
    setStepStates(blankStates());
    setStepDetails({});
    setStartedAt(Date.now());

    const ticker = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    try {
      if (opts?.fresh) {
        try {
          await clearMintCheckpoint(wallet.address as `0x${string}`, ensLabel);
        } catch {
          // best-effort — server will clear on the next call too
        }
      }
      const voiceSampleBase64 = await blobToBase64(voiceBlob);
      const res = await mintReplicaStream(
        {
          ensLabel,
          ownerAddress: wallet.address as `0x${string}`,
          voiceSampleBase64,
          voiceSampleMime: voiceBlob.type || 'audio/webm',
          personality,
          pricePerMinUsd: price,
        },
        (evt: MintStreamEvent) => {
          if (evt.type === 'step') {
            setStepStates((prev) => ({ ...prev, [evt.step]: evt.status }));
            if (evt.detail) {
              setStepDetails((prev) => ({ ...prev, [evt.step]: evt.detail }));
            }
          } else if (evt.type === 'error') {
            setErrorStep(evt.step);
            setStepStates((prev) =>
              evt.step !== 'unknown' ? { ...prev, [evt.step]: 'error' } : prev
            );
            setError(evt.error);
          }
        },
        undefined,
        { fresh: opts?.fresh }
      );
      setResult(res);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      // Stay on minting step so user can see which row failed.
    } finally {
      clearInterval(ticker);
    }
  }

  const wizardIndex = WIZARD_ORDER.indexOf(step as Exclude<WizardStep, 'minting' | 'done'>);

  return (
    <PageShell>
      {step !== 'minting' && step !== 'done' && (
        <header className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <h1 className="mt-3 font-coolvetica text-5xl tracking-tight text-foreground">
            Forge your taar
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Four short steps. Your replica goes live at{' '}
            <span className="font-mono text-foreground">
              {ensLabel || 'name'}.taars.eth
            </span>{' '}
            with an INFT on 0G Chain and a voice profile cloned from your sample.
          </p>

          {/* Wizard progress chips */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {WIZARD_ORDER.map((s, i) => {
              const passed = i < wizardIndex;
              const current = i === wizardIndex;
              return (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                      current
                        ? 'bg-accent text-white'
                        : passed
                          ? 'bg-accent/10 text-accent'
                          : 'bg-surface text-muted-foreground'
                    }`}
                  >
                    <span className="font-mono opacity-70">{i + 1}</span>
                    {WIZARD_LABELS[s]}
                  </span>
                  {i < WIZARD_ORDER.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </div>
              );
            })}
          </div>
        </header>
      )}

      {step === 'name' && (
        <Card>
          <Label>Pick your taar name</Label>
          <Help>
            This becomes your ENS subname under <span className="font-mono">taars.eth</span>. 2-32
            characters, lowercase letters / numbers / hyphens.
          </Help>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-surface-dark/70 bg-white p-1 focus-within:border-accent">
            <input
              autoFocus
              value={ensLabel}
              onChange={(e) =>
                setEnsLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder="alice"
              className="flex-1 bg-transparent px-3 py-3 text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <span className="px-3 text-sm text-muted-foreground">.taars.eth</span>
          </div>
          <NextRow>
            <span />
            <PrimaryBtn disabled={ensLabel.length < 2} onClick={() => setStep('voice')}>
              Next
            </PrimaryBtn>
          </NextRow>
        </Card>
      )}

      {step === 'voice' && (
        <Card>
          <Label>Record a voice sample</Label>
          <Help>
            Up to 60s of natural speech. When you start recording, read the passage shown — it
            helps capture a consistent sample. The clone is processed locally via OpenVoice
            (production target: TEE-backed 0G Compute).
          </Help>
          <div className="mt-4">
            <VoiceRecorder
              onComplete={setVoiceBlob}
              mode={voiceMode}
              onModeChange={setVoiceMode}
              samplePrompt={VOICE_SAMPLE_PROMPT}
            />
          </div>
          <NextRow>
            <SecondaryBtn onClick={() => setStep('name')}>Back</SecondaryBtn>
            <PrimaryBtn disabled={!voiceBlob} onClick={() => setStep('personality')}>
              Next
            </PrimaryBtn>
          </NextRow>
        </Card>
      )}

      {step === 'personality' && (
        <Card>
          <Label>Personality &amp; voice</Label>
          <Help>
            Ten short prompts that define how your replica thinks and replies. The answers are
            built into the system prompt that goes to 0G Compute (or fallback LLM).
          </Help>
          <div className="mt-4">
            <PersonalityForm value={personality} onChange={setPersonality} />
          </div>
          <NextRow>
            <SecondaryBtn onClick={() => setStep('voice')}>Back</SecondaryBtn>
            <PrimaryBtn onClick={() => setStep('price')}>Next</PrimaryBtn>
          </NextRow>
        </Card>
      )}

      {step === 'price' && (
        <Card>
          <Label>Set per-minute rate (USDC)</Label>
          <Help>
            Callers pay this per minute via x402. KeeperHub-style settlement splits 90% to you, 7%
            to the platform, 3% creator royalty.
          </Help>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-36 rounded-xl border border-surface-dark/70 bg-white px-3 py-3 text-foreground outline-none focus:border-accent"
            />
            <span className="text-sm text-muted-foreground">/ min</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['0.05', '0.10', '0.15'].map((p) => (
              <button
                key={p}
                onClick={() => setPrice(p)}
                className={`rounded-full px-3 py-1 text-xs ${
                  price === p ? 'bg-accent text-white' : 'bg-surface text-muted-foreground hover:bg-surface-dark'
                }`}
              >
                ${p}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <NextRow>
            <SecondaryBtn onClick={() => setStep('personality')}>Back</SecondaryBtn>
            <button
              onClick={() => forge()}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent to-accent-dark px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent/20 transition hover:opacity-90"
            >
              Forge My taar
              <Sparkles className="h-4 w-4" />
            </button>
          </NextRow>
        </Card>
      )}

      {step === 'minting' && (
        <div className="space-y-6">
          <header>
            <h1 className="font-coolvetica text-4xl tracking-tight text-foreground">
              Forging <span className="text-accent">{ensLabel}.taars.eth</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Seven on-chain steps. Track them live below. Total runtime is usually 60-200s,
              dominated by 0G Storage and Sepolia tx confirmations.
            </p>
          </header>

          <div className="flex items-center justify-between rounded-2xl border border-surface-dark/60 bg-white px-5 py-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">elapsed</div>
            <div className="font-mono text-sm tabular-nums text-foreground">
              {Math.floor(elapsedSec / 60)
                .toString()
                .padStart(2, '0')}
              :{(elapsedSec % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <StepProgress
            states={stepStates}
            details={stepDetails}
            errorStep={errorStep}
            errorMessage={error}
          />

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">{error}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Failed at <span className="font-mono">{errorStep ?? 'unknown'}</span>. Steps that
                already succeeded are checkpointed — resume picks up from the failed step.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => forge()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:bg-accent-light"
                >
                  Resume from {errorStep ?? 'last step'}
                </button>
                <button
                  onClick={() => forge({ fresh: true })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-surface-dark/70 bg-white px-4 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface"
                >
                  Start fresh
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setStep('price');
                    setStartedAt(null);
                    setElapsedSec(0);
                  }}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Back to pricing
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl bg-gradient-to-br from-accent to-accent-dark p-8 text-white shadow-xl shadow-accent/20"
          >
            <Sparkles className="h-8 w-8" />
            <h1 className="mt-3 font-coolvetica text-4xl tracking-tight">
              Live at {result.ensFullName}
            </h1>
            <p className="mt-2 text-sm opacity-90">
              {startedAt
                ? `Forged in ${Math.floor((Date.now() - startedAt) / 1000)}s.`
                : 'Done.'}{' '}
              Your replica is on-chain, encrypted, and addressable.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/${result.ensLabel}`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-medium text-accent transition hover:bg-surface"
              >
                View profile
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href={`https://chainscan-galileo.0g.ai/tx/${result.txInft}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-5 py-2 text-sm font-medium hover:bg-white/10"
              >
                INFT on 0G
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </motion.div>

          <Card>
            <Label>Receipts</Label>
            <ul className="mt-4 space-y-2 break-all font-mono text-xs text-muted-foreground">
              <Receipt name="INFT token" value={result.tokenId} />
              <Receipt name="storage root" value={result.storageRoot} />
              <Receipt name="voice profile" value={result.voiceProfileId} />
              <Receipt
                name="INFT tx"
                value={result.txInft}
                href={`https://chainscan-galileo.0g.ai/tx/${result.txInft}`}
              />
              {result.txEnsSubname && (
                <Receipt
                  name="ENS subname tx"
                  value={result.txEnsSubname}
                  href={`https://sepolia.etherscan.io/tx/${result.txEnsSubname}`}
                />
              )}
              {result.txEnsTextRecords[0] && (
                <Receipt
                  name="ENS records tx"
                  value={result.txEnsTextRecords[0]}
                  href={`https://sepolia.etherscan.io/tx/${result.txEnsTextRecords[0]}`}
                />
              )}
              {result.txEnsTextRecords[1] && (
                <Receipt
                  name="ENS transfer tx"
                  value={result.txEnsTextRecords[1]}
                  href={`https://sepolia.etherscan.io/tx/${result.txEnsTextRecords[1]}`}
                />
              )}
            </ul>
          </Card>
        </div>
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-background pt-24 pb-20">
        <div className="mx-auto max-w-2xl px-6">{children}</div>
      </main>
    </>
  );
}

function Hero() {
  return (
    <header className="text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-surface-dark bg-surface px-3 py-1 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Forge your taar
      </span>
      <h1 className="mt-4 font-coolvetica text-5xl tracking-tight text-foreground">
        Your replica, in <span className="text-accent">four steps.</span>
      </h1>
    </header>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-surface-dark/60 bg-white p-6 shadow-sm sm:p-8"
    >
      {children}
    </motion.section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-coolvetica text-2xl tracking-tight text-foreground">{children}</h2>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm text-muted-foreground">{children}</p>;
}

function NextRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex items-center justify-between gap-2">{children}</div>;
}

function PrimaryBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-light disabled:opacity-40 disabled:hover:bg-accent"
    >
      {children}
    </button>
  );
}

function SecondaryBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center gap-1.5 rounded-full border border-surface-dark px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Receipt({ name, value, href }: { name: string; value: string; href?: string }) {
  return (
    <li className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:w-28 sm:shrink-0">
        {name}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="break-all text-foreground hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="break-all text-foreground">{value}</span>
      )}
    </li>
  );
}
