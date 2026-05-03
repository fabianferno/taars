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

  const { data: ethBalance } = useBalance({ address });

  const usdcEnabled = !!MOCK_USDC_ADDRESS;
  const { data: usdcRaw, queryKey: usdcQueryKey } = useReadContract({
    address: MOCK_USDC_ADDRESS || undefined,
    abi: MOCK_USDC_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: usdcEnabled },
  });

  const { writeContract, data: mintTxHash, isPending: isMinting } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: mintConfirmed } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  useEffect(() => {
    if (mintConfirmed) {
      queryClient.invalidateQueries({ queryKey: usdcQueryKey });
    }
  }, [mintConfirmed, queryClient, usdcQueryKey]);

  const ethValue = ethBalance ? Number(ethBalance.value) / 1e18 : null;
  const usdcValue = usdcRaw !== undefined ? atomicToUsd(usdcRaw as bigint) : null;

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
      {ethValue !== null && (
        <div className="relative flex items-center gap-1" ref={ethIsZero ? dropdownRef : undefined}>
          <span className="font-mono text-xs text-muted-foreground">
            {ethValue.toFixed(4)} ETH
          </span>
          {ethIsZero && (
            <>
              <button
                onClick={() => setEthFaucetOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/20 transition-colors"
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
