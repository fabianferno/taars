# Wallet Balance + Faucet in Navbar

**Date:** 2026-05-03

## Problem

When a wallet is connected, the navbar shows no balance information. Users can't tell if they have enough ETH for gas or USDC for sessions without leaving the app.

## Requirements

- Show native Sepolia ETH balance (4 decimal places) when wallet is connected.
- Show mock USDC balance (2 decimal places) when wallet is connected and `NEXT_PUBLIC_MOCK_USDC_ADDRESS` is set.
- When ETH balance is 0: show a `Get ETH` pill that opens a dropdown of Sepolia faucet links.
- When USDC balance is 0: show a `Get USDC` button that calls `mint(address, 100_000_000)` directly on the mock USDC contract.
- Both balance pills are hidden on mobile (`sm:hidden`) to avoid overflow.
- USDC section is fully absent if `MOCK_USDC_ADDRESS` env var is unset.

## Architecture

New file: `web/src/components/WalletBalance.tsx`
- Contains all balance-fetching and faucet logic.
- Uses `useBalance` (wagmi) for ETH, `useReadContract` for USDC `balanceOf`, `useWriteContract` for USDC `mint`.
- ETH faucet: dropdown with 3 links, closed on outside click via `useEffect` + `ref`.
- USDC faucet: single button, spinner while tx is pending, refetches balance on success.

Modified file: `web/src/components/TopNav.tsx`
- Import and render `<WalletBalance address={wallet} />` between the nav links and the user label, only when `authenticated`.

## Faucet Links (Sepolia ETH)

- Alchemy: `https://sepoliafaucet.com`
- Chainlink: `https://faucets.chain.link/sepolia`
- Infura: `https://www.infura.io/faucet/sepolia`

## USDC Mint

- Contract: `MOCK_USDC_ADDRESS` from `@/lib/billing`
- Function: `mint(to: address, amount: uint256)`
- Amount: `100_000_000` (100 USDC at 6 decimals)
- Uses `useWriteContract` + `useWaitForTransactionReceipt` to track tx, then invalidates the `balanceOf` query.

## Non-goals

- Multi-chain support (Sepolia only for now).
- On-chain ETH faucet (external links only).
- Balance polling interval (wagmi default refetch on focus/reconnect is sufficient).
