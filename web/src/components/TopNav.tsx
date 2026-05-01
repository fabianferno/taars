'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

interface TopNavProps {
  variant?: 'landing' | 'app';
}

export default function TopNav({ variant = 'app' }: TopNavProps) {
  const { authenticated, login, logout, user } = usePrivy();
  const wallet = user?.wallet?.address;
  const email = user?.email?.address;
  const label = email ?? (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'me');

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
          <span className="font-coolvetica text-xl tracking-wide text-foreground">taars</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href={variant === 'landing' ? '#featured' : '/'}
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
          {variant === 'landing' ? (
            <Link
              href="/create"
              className="text-sm font-medium bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-full transition-colors"
            >
              Create
            </Link>
          ) : authenticated ? (
            <button
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors max-w-[160px] truncate"
              title={`Sign out (${label})`}
            >
              {label}
            </button>
          ) : (
            <button
              onClick={login}
              className="text-sm font-medium bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-full transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
