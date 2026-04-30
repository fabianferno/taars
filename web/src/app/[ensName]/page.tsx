'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { resolveTaarsLabel, type ReplicaProfile } from '@/lib/ens';

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
    return <main className="mx-auto max-w-2xl p-6 text-neutral-400">Resolving {ensName}.taars.eth…</main>;
  if (error)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href="/" className="text-sm text-neutral-400">
          ← Home
        </Link>
        <p className="mt-4 text-red-400">{error}</p>
      </main>
    );
  if (!profile) return null;

  const r = profile.records;
  const inftRef = r['taars.inft'] ?? '';
  const tokenId = inftRef.split(':').pop() ?? '';

  return (
    <main className="mx-auto max-w-2xl p-6 pt-12">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Home
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{profile.ensFullName}</h1>
        {r.description && <p className="mt-2 text-neutral-300">{r.description}</p>}
      </header>

      <section className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Per-minute" value={r['taars.price'] ? `$${r['taars.price']}` : '—'} />
        <Stat label="Currency" value={r['taars.currency'] ?? '—'} />
        <Stat label="Network" value={r['taars.network'] ?? '—'} />
        <Stat label="Version" value={r['taars.version'] ?? '—'} />
      </section>

      <details className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
        <summary className="cursor-pointer text-sm text-neutral-300">On-chain receipts</summary>
        <ul className="mt-3 space-y-1 break-all font-mono text-xs text-neutral-400">
          <li>owner: {profile.owner}</li>
          <li>token id: {tokenId || '—'}</li>
          <li>storage: {r['taars.storage'] ?? '—'}</li>
          <li>voice: {r['taars.voice'] ?? '—'}</li>
          <li>created: {r['taars.created'] ?? '—'}</li>
        </ul>
        {tokenId && (
          <a
            className="mt-3 block text-xs underline"
            href={`https://chainscan-galileo.0g.ai/token/${process.env.NEXT_PUBLIC_TAARS_INFT_ADDRESS}?a=${tokenId}`}
            target="_blank"
            rel="noreferrer"
          >
            View INFT on 0G Chainscan ↗
          </a>
        )}
      </details>

      <div className="mt-8 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 p-6 text-center">
        <p className="text-sm text-neutral-200">Chat & voice come in Plan 2.</p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}
