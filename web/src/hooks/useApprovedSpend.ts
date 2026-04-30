'use client';
import { useCallback, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { MOCK_USDC_ABI } from '@/lib/billing';

export interface UseApprovedSpendResult {
  allowance: bigint;
  isLoadingAllowance: boolean;
  hasEnough: boolean;
  approve: () => void;
  isApproving: boolean;
  approveTxHash: `0x${string}` | undefined;
  isApprovalConfirming: boolean;
  isApprovalConfirmed: boolean;
  refetch: () => void;
}

/**
 * Reads the user's USDC allowance for `billingContract` and exposes an
 * `approve(amount)` action that funds at least `amount` of headroom.
 *
 * If `billingContract` or `usdcAddress` is empty, behaves as a no-op
 * (returns hasEnough=true, never reads/writes) so the chat UI keeps working
 * before the contracts are deployed.
 */
export function useApprovedSpend(
  billingContract: `0x${string}` | '',
  usdcAddress: `0x${string}` | '',
  amount: bigint
): UseApprovedSpendResult {
  const { address } = useAccount();
  const enabled = Boolean(address && billingContract && usdcAddress);

  const allowanceQuery = useReadContract({
    address: usdcAddress || undefined,
    abi: MOCK_USDC_ABI,
    functionName: 'allowance',
    args: address && billingContract ? [address, billingContract as `0x${string}`] : undefined,
    query: { enabled },
  });

  const allowance = (allowanceQuery.data as bigint | undefined) ?? BigInt(0);

  const { writeContract, data: approveTxHash, isPending: isApproving } = useWriteContract();

  const txReceipt = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: Boolean(approveTxHash) },
  });

  const approve = useCallback(() => {
    if (!enabled) return;
    writeContract({
      address: usdcAddress as `0x${string}`,
      abi: MOCK_USDC_ABI,
      functionName: 'approve',
      args: [billingContract as `0x${string}`, amount],
    });
  }, [enabled, writeContract, usdcAddress, billingContract, amount]);

  const hasEnough = useMemo(() => {
    if (!enabled) return true; // pre-deployment: don't block the user
    return allowance >= amount;
  }, [enabled, allowance, amount]);

  return {
    allowance,
    isLoadingAllowance: allowanceQuery.isLoading,
    hasEnough,
    approve,
    isApproving,
    approveTxHash,
    isApprovalConfirming: txReceipt.isLoading,
    isApprovalConfirmed: txReceipt.isSuccess,
    refetch: () => void allowanceQuery.refetch(),
  };
}
