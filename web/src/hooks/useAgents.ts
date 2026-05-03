'use client';
import { useEffect, useState } from 'react';
import { SERVER_URL } from '@/lib/api';

export interface UiAgent {
  name: string;
  ens: string;
  initials: string;
  bio: string;
  category: 'trending' | 'top' | 'new';
  rating: number;
  pricePerMinUsd: number;
  price: string;
  gradient: string;
  verification: 'self' | 'community';
  greeting: string;
  disclaimer?: string;
  image?: string;
  featured?: boolean;
}

function formatPrice(p: number): string {
  return p === 0 ? 'Free' : `$${p.toFixed(2)}/min`;
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
        const agents: UiAgent[] = j.agents.map((a: Omit<UiAgent, 'price'>) => ({
          ...a,
          price: formatPrice(a.pricePerMinUsd),
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
