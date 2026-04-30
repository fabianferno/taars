'use client';
import { useEffect, useState } from 'react';

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function SessionTimerBar({
  startedAt,
  ratePerMinUsd,
}: {
  startedAt: number;
  ratePerMinUsd: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedMs = now - startedAt;
  const elapsedMin = elapsedMs / 60_000;
  const rate = parseFloat(ratePerMinUsd) || 0;
  const cost = elapsedMin * rate;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        live
      </span>
      <span className="font-mono text-sm text-neutral-100">{fmt(elapsedMs)}</span>
      <span className="text-neutral-500">·</span>
      <span>
        rate <span className="font-mono text-neutral-100">${ratePerMinUsd}</span>/min
      </span>
      <span className="text-neutral-500">·</span>
      <span>
        running cost{' '}
        <span className="font-mono text-neutral-100">${cost.toFixed(4)}</span>
      </span>
    </div>
  );
}
