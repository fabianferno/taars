"use client";

import { motion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute filter invert hue-rotate-110 inset-0 z-0 w-full h-full object-cover pointer-events-none"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* Subtle radial gradient vignette */}
      <div className="absolute inset-0 pointer-events-none z-[1]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-surface-dark text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Create human-backed replica agents
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-coolvetica text-7xl tracking-tight text-foreground mt-8 leading-[1.05]"
        >
          Your AI Replica.
          <br />
          <span className="text-accent">Your Identity.</span>
          <br />
          Your Rules.
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Create a private AI clone of yourself &mdash; your voice, knowledge,
          personality. Own it as an INFT. Let it speak for you 24/7.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="#cta"
            className="group inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-white font-medium px-7 py-3.5 rounded-full transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30"
          >
            Create My taar
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="#featured"
            className="inline-flex items-center gap-2 border-2 border-surface-dark hover:border-accent/40 text-foreground font-medium px-7 py-3.5 rounded-full transition-all"
          >
            <Compass className="w-4 h-4" />
            Explore taars
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
