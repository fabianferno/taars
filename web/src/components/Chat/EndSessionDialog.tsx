'use client';
import type { ChatEndResponse } from '@/lib/api';

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function EndSessionDialog({
  receipt,
  onClose,
}: {
  receipt: ChatEndResponse;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <h2 className="font-coolvetica text-2xl text-foreground">Session settled</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Receipt for session{' '}
          <span className="font-mono text-neutral-300">
            {receipt.sessionId.slice(0, 10)}…
          </span>
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Cell label="Duration" value={fmt(receipt.durationSeconds)} />
          <Cell label="Rate" value={`$${receipt.ratePerMinUsd}/min`} />
          <Cell label="Total" value={`$${receipt.expectedUsd}`} />
          <Cell label="Settled" value={receipt.settled ? 'on-chain' : 'off-chain'} />
        </dl>

        {receipt.txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${receipt.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block break-all rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 font-mono text-xs text-neutral-300 underline-offset-2 hover:underline"
          >
            tx: {receipt.txHash}
          </a>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-light"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-neutral-100">{value}</div>
    </div>
  );
}
