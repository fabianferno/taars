"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-surface-dark/50"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/taars-logo.jpg"
            alt="Taars"
            width={28}
            height={28}
            className="rounded-sm"
          />
          <span className="font-coolvetica text-xl tracking-wide text-foreground">
            taars
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/explore"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Explore
          </Link>
          <Link
            href="/earnings"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Earnings
          </Link>
          <Link
            href="/pitch"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Pitch
          </Link>
          <Link
            href="#cta"
            className="text-sm font-medium bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-full transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
