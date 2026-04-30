"use client";

import { motion, useInView } from "framer-motion";
import { ShieldCheck, KeyRound, Globe } from "lucide-react";
import { useRef } from "react";

const features = [
  {
    icon: ShieldCheck,
    title: "Verifiable Privacy",
    description:
      "Your voice and data are processed inside a TEE (Trusted Execution Environment). Original data is cryptographically destroyed after training. Zero-knowledge proof of deletion.",
  },
  {
    icon: KeyRound,
    title: "True Ownership",
    description:
      "Your taar is minted as an INFT using ERC-7857 — an intelligent NFT that carries its own inference logic. You own the model weights, not just a pointer.",
  },
  {
    icon: Globe,
    title: "Portable Identity",
    description:
      "Every taar gets an ENS subname (you.taars.eth) that resolves across the decentralized web. Your AI identity is as portable as your wallet.",
  },
];

export default function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 sm:py-32" ref={ref}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-coolvetica text-4xl sm:text-5xl text-foreground">
            Why taars
          </h2>
          <p className="text-muted-foreground mt-3 text-lg max-w-xl mx-auto">
            Privacy-first AI replicas, owned and controlled by verified humans.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative rounded-2xl border-2 border-accent/15 hover:border-accent/30 bg-background p-8 transition-colors group"
            >
              <div className="w-14 h-14 rounded-2xl bg-accent/10 group-hover:bg-accent/15 flex items-center justify-center mb-6 transition-colors">
                <feature.icon className="w-7 h-7 text-accent" />
              </div>

              <h3 className="font-coolvetica text-2xl text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
