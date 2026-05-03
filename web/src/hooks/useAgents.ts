'use client';
import { useEffect, useState } from 'react';
import { SERVER_URL } from '@/lib/api';

export interface UiAgent {
  tokenId: string;
  ens: string;
  ensLabel: string;
  mintedAt: number;
  owner: string;
  pricePerMinUsd: string;     // raw decimal string from ENS
  description: string;
  avatar: string;
  voiceId: string;
  storageRoot: string;
  name: string;
  initials: string;
  gradient: string;
  verification: 'self' | 'community';
  featured?: boolean;
  // Derived in the hook for backwards-compatible display:
  price: string;
  bio: string;
  image?: string;
  rating?: number;
  category?: string;
  greeting?: string;
  disclaimer?: string;
}

function formatPrice(p: string): string {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `$${n.toFixed(2)}/min`;
}

export function useAgents(opts?: { featuredOnly?: boolean }): {
  agents: UiAgent[];
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{ agents: UiAgent[]; loading: boolean; error: string | null }>(
    { agents: [], loading: true, error: null }
  );

  useEffect(() => {
    let cancelled = false;
    const url = `${SERVER_URL}/agents${opts?.featuredOnly ? '?featured=1' : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) throw new Error(j.error || 'failed');
        const agents: UiAgent[] = (j.agents as Array<Omit<UiAgent, 'price' | 'bio' | 'image'>>).map((a) => ({
          ...a,
          price: formatPrice(a.pricePerMinUsd),
          bio: a.description,
          image: a.avatar || undefined,
        }));
        setState({ agents, loading: false, error: null });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState({ agents: [], loading: false, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [opts?.featuredOnly]);

  return state;
}
