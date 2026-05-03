'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import TopNav from '@/components/TopNav';
import { resolveTaarsLabel, type ReplicaProfile } from '@/lib/ens';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { DiscordDeployPanel } from '@/components/Deploy/DiscordDeployPanel';

type PageProps = { params: Promise<{ ensName: string }> };

export default function ProfilePage({ params }: PageProps) {
  const { ensName } = use(params);
  const [profile, setProfile] = useState<ReplicaProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await resolveTaarsLabel(ensName);
        if (cancelled) return;
        if (!p) {
          setError(`No taar registered at ${ensName}.taars.eth`);
        } else {
          setProfile(p);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Resolution failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensName]);

  if (loading)
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-3xl px-6 pt-24 pb-12 text-muted-foreground">
          Resolving {ensName}.taars.eth&hellip;
        </main>
      </>
    );
  if (error)
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-3xl px-6 pt-24 pb-12">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Home
          </Link>
          <p className="mt-4 text-destructive">{error}</p>
        </main>
      </>
    );
  if (!profile) return null;

  const r = profile.records;
  const inftRef = r['taars.inft'] ?? '';
  const tokenId = inftRef.split(':').pop() ?? '';
  const initials = profile.ensLabel.slice(0, 2).toUpperCase();

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 pt-24 pb-20">
      <Link
        href="/"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Home
      </Link>

      {/* ProfileHero */}
      <header className="mb-6 flex items-start gap-4">
        {r.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.avatar}
            alt={profile.ensFullName}
            className="h-16 w-16 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark font-coolvetica text-2xl text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-coolvetica text-3xl tracking-tight text-foreground">
            {profile.ensFullName}
          </h1>
          {r.description && (
            <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
          )}
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground/70">
            owner {profile.owner}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wide text-accent">per-min</div>
          <div className="font-mono text-base text-accent">
            ${r['taars.price'] ?? '—'}
          </div>
        </div>
      </header>

      {/* Stats grid */}
      <section className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Per-minute" value={r['taars.price'] ? `$${r['taars.price']}` : '—'} />
        <Stat label="Currency" value={r['taars.currency'] ?? '—'} />
        <Stat label="Network" value={r['taars.network'] ?? '—'} />
        <Stat label="Version" value={r['taars.version'] ?? '—'} />
      </section>

      {/* On-chain receipts */}
      <details className="mb-6 rounded-2xl border border-surface-dark/60 bg-white p-4">
        <summary className="cursor-pointer text-sm text-foreground">
          On-chain receipts
        </summary>
        <ul className="mt-3 space-y-1 break-all font-mono text-xs text-muted-foreground">
          <li>owner: {profile.owner}</li>
          <li>token id: {tokenId || '—'}</li>
          <li>storage: {r['taars.storage'] ?? '—'}</li>
          <li>voice: {r['taars.voice'] ?? '—'}</li>
          <li>created: {r['taars.created'] ?? '—'}</li>
        </ul>
        {tokenId && (
          <a
            className="mt-3 block text-xs text-accent underline"
            href={`https://chainscan-galileo.0g.ai/token/${process.env.NEXT_PUBLIC_TAARS_INFT_ADDRESS}?a=${tokenId}`}
            target="_blank"
            rel="noreferrer"
          >
            View INFT on 0G Chainscan &rarr;
          </a>
        )}
      </details>

      {/* Chat panel */}
      <ChatPanel profile={profile} />

      {/* Discord VC deploy panel */}
      <DiscordDeployPanel
        ensLabel={profile.ensLabel}
        ensFullName={profile.ensFullName}
        basePricePerMinUsd={r['taars.price'] ?? '0'}
      />
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-dark/60 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}
