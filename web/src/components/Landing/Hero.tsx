"use client";

import { motion } from "framer-motion";
import { ArrowRight, Compass, Presentation } from "lucide-react";
import Link from "next/link";
import ShaderBackground from "../ShaderBackground";
import MetallicPaint from "../MetallicPaint";

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-end pt-16 overflow-hidden">
      {/* Shader gradient background — hero only */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <ShaderBackground />
      </div>

      {/* Bottom fade — keeps text legible over the shader */}
      <div className="absolute inset-x-0 bottom-0 h-9/10 z-[1] pointer-events-none bg-gradient-to-t from-background via-background/80 to-transparent" />

      {/* Metallic logo — absolute, right side */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.2 }}
        className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 z-[2] pointer-events-none w-[55vw] max-w-[1100px] h-[110vh] max-h-[1100px]"
      >
        <MetallicPaint imageSrc="/taars-logo.svg" />
      </motion.div>

      {/* Hero text — left aligned, anchored to bottom */}
      <div className="relative z-10 w-full pb-16 sm:pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            {/* Pill badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface/80 backdrop-blur-sm border border-surface-dark text-sm text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Create human-backed replica agents
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="font-coolvetica text-6xl sm:text-7xl tracking-tight text-foreground mt-6 leading-[1.05]"
            >
              Your digital twin.
              <br />
              <span className="text-accent">Your identity.</span>

            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl"
            >
              Create a private AI clone of yourself &mdash; your voice, knowledge,
              personality. Own it as an INFT. Let it speak for you 24/7.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-10 flex flex-col sm:flex-row items-start gap-4"
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
                className="inline-flex items-center gap-2 border-2 border-surface-dark hover:border-accent/40 text-foreground font-medium px-7 py-3.5 rounded-full transition-all backdrop-blur-sm"
              >
                <Compass className="w-4 h-4" />
                Explore taars
              </Link>
              <Link
                href="/pitch"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium px-4 py-3.5 transition-colors"
              >
                <Presentation className="w-4 h-4" />
                View Pitch Deck
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
