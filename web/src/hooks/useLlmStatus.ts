'use client';
import { useEffect, useState } from 'react';
import { getLlmStatus, type LlmStatus } from '@/lib/api';

export function useLlmStatus(pollMs = 15000): LlmStatus | null {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      getLlmStatus()
        .then((s) => !cancelled && setStatus(s))
        .catch(() => !cancelled && setStatus(null));
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);
  return status;
}
