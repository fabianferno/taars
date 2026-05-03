# Wallet Balance + Faucet Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show ETH and mock USDC balances in the navbar when a wallet is connected, with faucet helpers when either balance is zero.

**Architecture:** A new self-contained `WalletBalance` component fetches both balances via wagmi hooks and renders balance pills + faucet controls. `TopNav` imports and renders it when the user is authenticated. The mock USDC faucet calls `mint()` directly on-chain; the ETH faucet opens a dropdown of external Sepolia faucet links.

**Tech Stack:** React 19, Next.js 15, wagmi v2, viem v2, @tanstack/react-query v5, Tailwind CSS, lucide-react

---

### Task 1: Create WalletBalance component

**Files:**
- Create: `web/src/components/WalletBalance.tsx`

- [ ] **Step 1: Write the component file**

Create `web/src/components/WalletBalance.tsx` with the full implementation:

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Droplets, ExternalLink } from 'lucide-react';
import { MOCK_USDC_ADDRESS, MOCK_USDC_ABI, USDC_DECIMALS, atomicToUsd } from '@/lib/billing';

const SEPOLIA_FAUCETS = [
  { label: 'Alchemy', href: 'https://sepoliafaucet.com' },
  { label: 'Chainlink', href: 'https://faucets.chain.link/sepolia' },
  { label: 'Infura', href: 'https://www.infura.io/faucet/sepolia' },
];

const MINT_AMOUNT = BigInt(100 * 10 ** USDC_DECIMALS); // 100 USDC

interface Props {
  address: `0x${string}`;
}

export function WalletBalance({ address }: Props) {
  const queryClient = useQueryClient();
  const [ethFaucetOpen, setEthFaucetOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close ETH faucet dropdown on outside click
  useEffect(() => {
    if (!ethFaucetOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setEthFaucetOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ethFaucetOpen]);

  // ETH balance
  const { data: ethBalance } = useBalance({ address });

  // USDC balance (skip if contract address not configured)
  const usdcEnabled = !!MOCK_USDC_ADDRESS;
  const { data: usdcRaw, queryKey: usdcQueryKey } = useReadContract({
    address: MOCK_USDC_ADDRESS || undefined,
    abi: MOCK_USDC_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: usdcEnabled },
  });

  // USDC mint
  const { writeContract, data: mintTxHash, isPending: isMinting } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: mintConfirmed } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  // Refetch USDC balance after mint confirms
  useEffect(() => {
    if (mintConfirmed) {
      queryClient.invalidateQueries({ queryKey: usdcQueryKey });
    }
  }, [mintConfirmed, queryClient, usdcQueryKey]);

  const ethValue = ethBalance
    ? Number(ethBalance.value) / 1e18
    : null;

  const usdcValue = usdcRaw !== undefined
    ? atomicToUsd(usdcRaw as bigint)
    : null;

  const ethIsZero = ethValue !== null && ethValue === 0;
  const usdcIsZero = usdcValue !== null && usdcValue === '0';

  const mintBusy = isMinting || isMintConfirming;

  function handleMintUsdc() {
    if (!MOCK_USDC_ADDRESS) return;
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: 'mint',
      args: [address, MINT_AMOUNT],
    });
  }

  return (
    <div className="hidden sm:flex items-center gap-2">
      {/* ETH balance */}
      {ethValue !== null && (
        <div className="relative" ref={ethIsZero ? dropdownRef : undefined}>
          <span className="font-mono text-xs text-muted-foreground">
            {ethValue.toFixed(4)} ETH
          </span>
          {ethIsZero && (
            <>
              <button
                onClick={() => setEthFaucetOpen((o) => !o)}
                className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                <Droplets className="h-3 w-3" />
                Get ETH
              </button>
              {ethFaucetOpen && (
                <div className="absolute right-0 top-7 z-50 min-w-[160px] rounded-xl border border-surface-dark/60 bg-white shadow-lg py-1">
                  {SEPOLIA_FAUCETS.map((f) => (
                    <a
                      key={f.href}
                      href={f.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-3 py-2 text-xs text-foreground hover:bg-surface transition-colors"
                    >
                      {f.label}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* USDC balance */}
      {usdcEnabled && usdcValue !== null && (
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            {Number(usdcValue).toFixed(2)} USDC
          </span>
          {usdcIsZero && (
            <button
              onClick={handleMintUsdc}
              disabled={mintBusy}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              {mintBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Droplets className="h-3 w-3" />
              )}
              Get USDC
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v "shimmer-loader"
```

Expected: no output (the only pre-existing error is shimmer-loader which is unrelated).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/WalletBalance.tsx
git commit -m "feat(navbar): add WalletBalance component with ETH/USDC balances and faucets"
```

---

### Task 2: Wire WalletBalance into TopNav

**Files:**
- Modify: `web/src/components/TopNav.tsx`

Current state of `TopNav.tsx` (lines 1-77): uses `usePrivy` only, shows user label / logout button.

- [ ] **Step 1: Add the import and useWallets hook**

Replace:
```tsx
import { usePrivy } from '@privy-io/react-auth';
```
With:
```tsx
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { WalletBalance } from '@/components/WalletBalance';
```

- [ ] **Step 2: Extract connected wallet address inside the component**

After:
```tsx
  const { authenticated, login, logout, user } = usePrivy();
```
Add:
```tsx
  const { wallets } = useWallets();
  const connectedAddress = wallets[0]?.address as `0x${string}` | undefined;
```

- [ ] **Step 3: Render WalletBalance in the nav right section**

Inside the `<div className="flex items-center gap-6">` block, add `<WalletBalance>` immediately before the authenticated/login conditional:

Replace:
```tsx
          {variant === 'landing' ? (
```
With:
```tsx
          {authenticated && connectedAddress && (
            <WalletBalance address={connectedAddress} />
          )}
          {variant === 'landing' ? (
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v "shimmer-loader"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TopNav.tsx
git commit -m "feat(navbar): render wallet ETH/USDC balance and faucet buttons"
```

---

### Task 3: Smoke-test in the browser

- [ ] **Step 1: Start dev server**

```bash
cd web && pnpm dev
```

- [ ] **Step 2: Sign in and check balance display**

Navigate to any page. After signing in, confirm the navbar shows e.g. `0.0000 ETH` and (if `NEXT_PUBLIC_MOCK_USDC_ADDRESS` is set) `0.00 USDC` in the right section.

- [ ] **Step 3: Verify ETH faucet dropdown**

If ETH balance is 0, click `Get ETH`. Confirm a dropdown appears with Alchemy, Chainlink, and Infura links. Click outside — confirm it closes.

- [ ] **Step 4: Verify USDC mint**

If USDC balance is 0 and `NEXT_PUBLIC_MOCK_USDC_ADDRESS` is set, click `Get USDC`. Confirm the button shows a spinner while the tx is in-flight, then the balance updates to `100.00 USDC` after confirmation.

- [ ] **Step 5: Verify mobile hidden**

Resize browser to < 640px. Confirm the balance pills are not visible (the wrapper uses `hidden sm:flex` — visible only from the `sm` breakpoint up).
