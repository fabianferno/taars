"use client";

import { useAgents, type UiAgent } from "@/hooks/useAgents";
import { motion, useInView } from "framer-motion";
import { BadgeCheck, MessageCircle, Users } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

function TaarCard({
  taar,
  index,
}: {
  taar: UiAgent;
  index: number;
}) {
  const gradient = taar.gradient;
  const price = taar.price;
  const isSelf = taar.verification === "self";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="flex-shrink-0 w-56 sm:w-60"
    >
      <div
        className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-4 h-72 flex flex-col justify-between overflow-hidden group`}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Verification badge */}
        <div className="relative flex items-center justify-between">
          <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 overflow-hidden">
            {taar.image ? (
              <Image
                src={taar.image}
                alt={taar.name}
                width={56}
                height={56}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <span className="font-coolvetica text-lg text-white/90">
                {taar.initials}
              </span>
            )}
          </div>
          {isSelf ? (
            <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/10">
              <BadgeCheck size={11} className="text-white" />
              <span className="text-[9px] text-white font-medium">Verified</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/10">
              <Users size={11} className="text-white/60" />
              <span className="text-[9px] text-white/60 font-medium italic">Community</span>
            </span>
          )}
        </div>

        {/* Info */}
        <div className="relative mt-auto space-y-2">
          <div>
            <h3 className="font-coolvetica text-xl text-white leading-tight">
              {taar.name}
            </h3>
            <p className="text-white/60 text-xs mt-0.5 line-clamp-2">{taar.bio}</p>
          </div>

          {/* Community disclaimer */}
          {taar.disclaimer && (
            <p className="text-white/40 text-[9px] italic leading-tight line-clamp-1">
              {taar.disclaimer}
            </p>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 font-mono truncate">
              {taar.ens}
            </span>
          </div>

          <div className="relative z-10 flex items-center justify-between pt-1">
            <span className="text-white/70 text-xs">
              {price}
              <span className="text-white/40"> /min</span>
            </span>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/10 bg-[#ffffff] px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-sm transition-colors [color-scheme:light] appearance-none hover:bg-[#f5f5f5]"
            >
              <MessageCircle className="h-3 w-3 text-[#0a0a0a]" />
              Chat
            </button>
          </div>
        </div>
      </div>
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
