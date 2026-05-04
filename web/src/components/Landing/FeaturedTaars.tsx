"use client";

import { useAgents, type UiAgent } from "@/hooks/useAgents";
import { motion, useInView } from "framer-motion";
import { BadgeCheck, MessageCircle, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

function formatPrice(t: UiAgent): string {
  const n = Number(t.pricePerMinUsd);
  return !Number.isFinite(n) || n <= 0 ? "Free" : `$${n.toFixed(2)}/min`;
}

function TaarCard({ taar, index }: { taar: UiAgent; index: number }) {
  const isSelf = taar.verification === "self";
  const ensLabel = taar.ens.replace(".taars.eth", "");
  const avatarSrc =
    taar.image ??
    `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(taar.ens)}&radius=50&backgroundType=gradientLinear`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="flex-shrink-0 w-72 sm:w-80"
    >
      <Link
        href={`/${ensLabel}`}
        className="group block h-full rounded-2xl border border-surface-dark/60 bg-surface/40 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface/70"
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
    </motion.div>
  );
}

export default function FeaturedTaars() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const { agents, loading, error } = useAgents({ featuredOnly: true });

  return (
    <section id="featured" className="py-24 sm:py-32" ref={ref}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="font-coolvetica text-4xl sm:text-5xl text-foreground">
            Featured taars
          </h2>
          <p className="text-muted-foreground mt-3 text-lg">
            Explore AI replicas - verified creators and community interpretations.
          </p>
        </motion.div>
      </div>

      {loading && <div className="text-center text-white/60 py-8">Loading featured agents…</div>}
      {error && <div className="text-center text-red-400 py-8">Failed to load: {error}</div>}

      {/* Horizontal scroll container */}
      <div className="overflow-x-auto overflow-y-visible pb-4 scrollbar-hide">
        <div className="flex gap-4 px-6 max-w-7xl mx-auto py-2">
          {agents.map((taar, i) => (
            <TaarCard key={taar.ens} taar={taar} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
