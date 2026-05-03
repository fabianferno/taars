'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Check, Copy } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { WalletBalance } from '@/components/WalletBalance';

interface TopNavProps {
  variant?: 'landing' | 'app';
}

export default function TopNav({ variant = 'app' }: TopNavProps) {
  const { authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const connectedAddress = wallets[0]?.address as `0x${string}` | undefined;
  const wallet = user?.wallet?.address;
  const email = user?.email?.address;
  const label = email ?? (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'me');

  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  function copyAddress() {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
          {authenticated && connectedAddress && (
            <WalletBalance address={connectedAddress} />
          )}
          {variant === 'landing' ? (
            <Link
              href="/create"
              className="text-sm font-medium bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-full transition-colors"
            >
              Create
            </Link>
          ) : authenticated ? (
            <div className="relative flex items-center gap-1" ref={menuRef}>
              <button
                onClick={copyAddress}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors max-w-[160px] truncate"
                title={wallet ? `Copy address (${wallet})` : label}
              >
                {label}
                {copied
                  ? <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  : <Copy className="h-3.5 w-3.5 shrink-0 opacity-50" />
                }
              </button>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Account menu"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 min-w-[120px] rounded-xl border border-surface-dark/60 bg-white shadow-lg py-1">
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="w-full px-3 py-2 text-left text-xs text-destructive hover:bg-surface transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
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
