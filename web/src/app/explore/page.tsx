"use client";

import Navbar from "@/components/Landing/Navbar";
import Footer from "@/components/Landing/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import { useAgents, type UiAgent } from "@/hooks/useAgents";
import { BadgeCheck, MessageCircle, Search, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type Category = "all" | "trending" | "new" | "top";
type SortKey = "popular" | "price-asc" | "price-desc" | "rating";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trending", label: "Trending" },
  { key: "new", label: "New" },
  { key: "top", label: "Top Rated" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "rating", label: "Highest rated" },
  { key: "price-asc", label: "Price: low → high" },
  { key: "price-desc", label: "Price: high → low" },
];

function formatPrice(t: UiAgent): string {
  const n = Number(t.pricePerMinUsd);
  return !Number.isFinite(n) || n <= 0 ? "Free" : `$${n.toFixed(2)}/min`;
}

function TaarCard({ taar }: { taar: UiAgent }) {
  const isSelf = taar.verification === "self";
  const ensLabel = taar.ens.replace(".taars.eth", "");
  const avatarSrc =
    taar.image ??
    `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(taar.ens)}&radius=50&backgroundType=gradientLinear`;

  return (
    <Link
      href={`/${ensLabel}`}
      className="group block rounded-2xl border border-surface-dark/60 bg-surface/40 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface/70"
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 h-14 w-14 rounded-full bg-gradient-to-br ${taar.gradient} flex items-center justify-center overflow-hidden border border-white/10`}
        >
          <Image
            src={avatarSrc}
            alt={taar.name}
            width={56}
            height={56}
            className="w-full h-full object-cover object-top"
            unoptimized={!taar.image}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-coolvetica text-xl text-foreground truncate">
              {taar.name}
            </h3>
            {isSelf ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                <BadgeCheck size={11} /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground italic">
                <Users size={11} /> Community
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {taar.bio}
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/80 truncate">
            {taar.ens}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{formatPrice(taar)}</span>
          <span aria-hidden>·</span>
          <span>★ {(taar.rating ?? 0).toFixed(1)}</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-90 group-hover:opacity-100">
          <MessageCircle className="h-3 w-3" />
          Chat
        </span>
      </div>
    </Link>
  );
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const { agents, loading, error } = useAgents();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\.taars\.eth$/, "");
    let list: UiAgent[] = [...agents];
    if (q) {
      list = list.filter((t) => {
        const label = t.ens.replace(".taars.eth", "").toLowerCase();
        return (
          label.includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.bio.toLowerCase().includes(q)
        );
      });
    }
    if (category !== "all") {
      // on-chain agents have no category yet — keep filter as no-op for the demo
      list = list.filter(() => true);
    }
    const priceOf = (t: UiAgent) => Number(t.pricePerMinUsd) || 0;
    const ratingOf = (t: UiAgent) => t.rating ?? 0;
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => priceOf(a) - priceOf(b));
        break;
      case "price-desc":
        list.sort((a, b) => priceOf(b) - priceOf(a));
        break;
      case "rating":
        list.sort((a, b) => ratingOf(b) - ratingOf(a));
        break;
      default:
        // popular: most recently minted first
        list.sort((a, b) => b.mintedAt - a.mintedAt);
    }
    return list;
  }, [query, category, sort, agents]);

  return (
    <SmoothScroll>
      <Navbar />
      <main className="pt-24 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <header className="mb-10">
            <h1 className="font-coolvetica text-5xl sm:text-6xl text-foreground">
              Explore taars
            </h1>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
              Every taar resolves from an ENS subname under{" "}
              <span className="font-mono">taars.eth</span>. Search by name,
              browse by category, or sort by price — all data is read live from
              ENS text records.
            </p>
          </header>

          <div className="sticky top-16 z-30 -mx-6 mb-8 border-b border-surface-dark/40 bg-background/80 backdrop-blur-md px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-xl">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by ENS name, e.g. vitalik or balaji.taars.eth"
                  className="w-full rounded-full border border-surface-dark/60 bg-surface/40 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      category === c.key
                        ? "border-accent bg-accent text-white"
                        : "border-surface-dark/60 bg-surface/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-full border border-surface-dark/60 bg-surface/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading && (
            <div className="py-8 text-center text-muted-foreground">Loading agents…</div>
          )}
          {error && (
            <div className="py-8 text-center text-red-400">Failed to load agents: {error}</div>
          )}

          {!loading && filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">
                No taars match{" "}
                <span className="font-mono text-foreground">{query}</span>.
              </p>
              <p className="mt-2 text-sm text-muted-foreground/70">
                Try a different name, or{" "}
                <Link href="/create" className="text-accent hover:underline">
                  forge your own taar
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <TaarCard key={t.ens} taar={t} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </SmoothScroll>
  );
}
