"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { resolveTaarsLabel, type ReplicaProfile } from "@/lib/ens";
import { useAgents } from "@/hooks/useAgents";
import {
  TAARS_BILLING_ABI,
  TAARS_BILLING_ADDRESS,
  atomicToUsd,
} from "@/lib/billing";
import TopNav from "@/components/TopNav";

interface OwnedReplica {
  ensFullName: string;
  ensLabel: string;
  tokenId: string;
}

export default function EarningsPage() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [replicas, setReplicas] = useState<OwnedReplica[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const { agents } = useAgents();

  const billingDeployed = Boolean(TAARS_BILLING_ADDRESS);

  // Resolve which replicas the connected wallet "owns" by walking the
  // featured/smoketest list and matching ENS owner. Falls back to listing
  // every featured replica when the registry can't be read.
  useEffect(() => {
    if (!authenticated || !wallet) {
      setReplicas([]);
      return;
    }
    if (agents.length === 0) {
      // Wait for agent list to load before resolving
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setResolveError(null);
      try {
        const candidates = agents.map((t) => t.ens.replace(".taars.eth", ""));
        const profiles = await Promise.all(
          candidates.map(async (label) => {
            try {
              return await resolveTaarsLabel(label);
            } catch {
              return null;
            }
          })
        );
        const list: OwnedReplica[] = [];
        const me = (wallet.address as string).toLowerCase();
        for (const p of profiles) {
          if (!p) continue;
          const tokenId =
            (p.records["taars.inft"] ?? "").split(":").pop() ?? "";
          const owned = p.owner.toLowerCase() === me;
          if (owned) {
            list.push({
              ensFullName: p.ensFullName,
              ensLabel: p.ensLabel,
              tokenId,
            });
          }
        }
        // Fallback: if registry returned nothing for this wallet, show every
        // resolved replica so the dashboard still demonstrates the flow.
        if (!cancelled && list.length === 0) {
          const fallback: OwnedReplica[] = profiles
            .filter((p): p is ReplicaProfile => Boolean(p))
            .map((p) => ({
              ensFullName: p.ensFullName,
              ensLabel: p.ensLabel,
              tokenId: (p.records["taars.inft"] ?? "").split(":").pop() ?? "",
            }));
          setReplicas(fallback);
        } else if (!cancelled) {
          setReplicas(list);
        }
      } catch (e) {
        if (!cancelled)
          setResolveError(
            e instanceof Error ? e.message : "failed to resolve replicas"
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, wallet, agents]);

  if (!authenticated) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-3xl px-6 pt-24 pb-20">
          <Link
            href="/"
            className="mb-4 inline-block text-sm text-muted-foreground transition hover:text-foreground"
          >
            &larr; Home
          </Link>
          <h1 className="font-coolvetica text-3xl text-foreground">Earnings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to see revenue accrued to replicas you own.
          </p>
          <button
            onClick={login}
            className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-light"
          >
            Sign in
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 pt-24 pb-20">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-muted-foreground transition hover:text-foreground"
        >
          &larr; Home
        </Link>

        <header className="mb-6">
          <h1 className="font-coolvetica text-3xl text-foreground">Earnings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Claimable USDC across replicas you own.
          </p>
        </header>

        {!billingDeployed && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
            <p className="font-medium">
              Earnings dashboard waiting on TaarsBilling deployment.
            </p>
            <p className="mt-1 text-amber-200/80">
              Set{" "}
              <code className="font-mono">
                NEXT_PUBLIC_TAARS_BILLING_ADDRESS
              </code>{" "}
              in <code className="font-mono">web/.env.local</code> once the
              contract is live.
            </p>
          </div>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">Resolving replicas…</p>
        )}
        {resolveError && (
          <p className="text-sm text-destructive">{resolveError}</p>
        )}

        {!loading && replicas.length === 0 && (
          <div className="rounded-2xl border border-surface-dark/60 bg-surface/40 p-5 text-sm text-muted-foreground">
            No replicas found for this wallet.
          </div>
        )}

        {replicas.length > 0 && billingDeployed && (
          <TotalRevenue replicas={replicas} />
        )}

        <div className="mt-4 space-y-3">
          {replicas.map((r) => (
            <ReplicaRow
              key={r.ensFullName}
              replica={r}
              billingDeployed={billingDeployed}
            />
          ))}
        </div>
      </main>
    </>
  );
}

function TotalRevenue({ replicas }: { replicas: OwnedReplica[] }) {
  const [byToken, setByToken] = useState<Record<string, bigint>>({});

  const total = useMemo(
    () => Object.values(byToken).reduce((acc, v) => acc + v, BigInt(0)),
    [byToken]
  );

  const setTokenValue = (tokenId: string, v: bigint) =>
    setByToken((prev) =>
      prev[tokenId] === v ? prev : { ...prev, [tokenId]: v }
    );

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5">
      <div className="text-[11px] uppercase tracking-wide text-accent">
        Total claimable
      </div>
      <div className="mt-1 font-mono text-3xl text-accent">
        ${atomicToUsd(total)}
      </div>
      <div className="hidden">
        {replicas.map((r) => (
          <Subtotal
            key={r.tokenId || r.ensFullName}
            tokenId={r.tokenId}
            onValue={(v) => setTokenValue(r.tokenId, v)}
          />
        ))}
      </div>
    </div>
  );
}

function Subtotal({
  tokenId,
  onValue,
}: {
  tokenId: string;
  onValue: (v: bigint) => void;
}) {
  const tokenIdBig = useMemo(() => {
    if (!tokenId) return undefined;
    try {
      return BigInt(tokenId);
    } catch {
      return undefined;
    }
  }, [tokenId]);

  const q = useReadContract({
    address: TAARS_BILLING_ADDRESS || undefined,
    abi: TAARS_BILLING_ABI,
    functionName: "getRevenue",
    args: tokenIdBig !== undefined ? [tokenIdBig] : undefined,
    query: {
      enabled: Boolean(TAARS_BILLING_ADDRESS && tokenIdBig !== undefined),
    },
  });

  useEffect(() => {
    if (q.data !== undefined) onValue(q.data as bigint);
  }, [q.data, onValue]);

  return null;
}

function ReplicaRow({
  replica,
  billingDeployed,
}: {
  replica: OwnedReplica;
  billingDeployed: boolean;
}) {
  const tokenIdBig = useMemo(() => {
    if (!replica.tokenId) return undefined;
    try {
      return BigInt(replica.tokenId);
    } catch {
      return undefined;
    }
  }, [replica.tokenId]);

  const revenueQuery = useReadContract({
    address: TAARS_BILLING_ADDRESS || undefined,
    abi: TAARS_BILLING_ABI,
    functionName: "getRevenue",
    args: tokenIdBig !== undefined ? [tokenIdBig] : undefined,
    query: {
      enabled: Boolean(billingDeployed && tokenIdBig !== undefined),
    },
  });

  const claimable = (revenueQuery.data as bigint | undefined) ?? BigInt(0);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const txReceipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  useEffect(() => {
    if (txReceipt.isSuccess) revenueQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txReceipt.isSuccess]);

  function handleClaim() {
    if (!billingDeployed || tokenIdBig === undefined) return;
    writeContract({
      address: TAARS_BILLING_ADDRESS as `0x${string}`,
      abi: TAARS_BILLING_ABI,
      functionName: "claimRevenue",
      args: [tokenIdBig],
    });
  }

  const canClaim =
    billingDeployed &&
    claimable > BigInt(0) &&
    !isPending &&
    !txReceipt.isLoading;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-dark/60 bg-surface/40 p-4 transition-colors hover:border-accent/40 hover:bg-surface/70">
      <div className="min-w-0">
        <Link
          href={`/${replica.ensLabel}`}
          className="font-coolvetica text-lg text-foreground hover:text-accent"
        >
          {replica.ensFullName}
        </Link>
        <p className="font-mono text-[11px] text-muted-foreground/80">
          token id {replica.tokenId || "—"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Claimable
          </div>
          <div className="font-mono text-sm text-foreground">
            ${billingDeployed ? atomicToUsd(claimable) : "—"}
          </div>
        </div>
        <button
          onClick={handleClaim}
          disabled={!canClaim}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!billingDeployed
            ? "Claim"
            : isPending || txReceipt.isLoading
            ? "Claiming…"
            : "Claim"}
        </button>
      </div>
    </div>
  );
}
