'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import type { MintStepKey } from '@/lib/api';

export type StepState = 'pending' | 'running' | 'done' | 'error';

export interface StepUI {
  key: MintStepKey;
  label: string;
  description: string;
}

export const MINT_STEPS: StepUI[] = [
  {
    key: 'voice',
    label: 'Voice profile',
    description: 'Cloning your voice via OpenVoice (TEE-equivalent path on 0G Compute in production).',
  },
  {
    key: 'encrypt',
    label: 'Encrypt artifacts',
    description: 'AES-256-GCM over your soul, skills, and voice config.',
  },
  {
    key: 'storage',
    label: '0G Storage upload',
    description: 'Encrypted blobs go to decentralized storage. Returns merkle roots.',
  },
  {
    key: 'inft',
    label: 'Mint INFT',
    description: 'ERC-7857 Intelligent NFT minted on 0G Galileo testnet.',
  },
  {
    key: 'ens.subname',
    label: 'Reserve ENS subname',
    description: 'NameWrapper.setSubnodeRecord — your taar gets a human-readable address.',
  },
  {
    key: 'ens.records',
    label: 'Write ENS records',
    description: 'Multicall: 11 text records (INFT pointer, storage root, price, voice, owner, …).',
  },
  {
    key: 'ens.transfer',
    label: 'Transfer to owner',
    description: 'NameWrapper.safeTransferFrom — your wallet becomes the on-chain owner.',
  },
];

interface Props {
  states: Record<MintStepKey, StepState>;
  details: Partial<Record<MintStepKey, Record<string, unknown>>>;
  errorStep?: MintStepKey | 'unknown' | null;
  errorMessage?: string | null;
}

export function StepProgress({ states, details, errorStep, errorMessage }: Props) {
  return (
    <ol className="relative space-y-3">
      {MINT_STEPS.map((s, i) => {
        const state = states[s.key];
        const isErr = errorStep === s.key;
        return (
          <motion.li
            key={s.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`relative flex items-start gap-4 rounded-2xl border bg-white p-4 transition-all ${
              isErr
                ? 'border-destructive/40'
                : state === 'done'
                  ? 'border-accent/30'
                  : state === 'running'
                    ? 'border-accent shadow-md shadow-accent/10'
                    : 'border-surface-dark/60'
            }`}
          >
            {/* Icon */}
            <div className="mt-0.5 shrink-0">
              {state === 'done' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white"
                >
                  <Check className="h-4 w-4" />
                </motion.div>
              )}
              {state === 'running' && (
                <div className="grid h-7 w-7 place-items-center rounded-full bg-accent/10 text-accent">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {state === 'pending' && (
                <div className="grid h-7 w-7 place-items-center rounded-full bg-surface text-muted-foreground/60 text-xs font-mono">
                  {i + 1}
                </div>
              )}
              {state === 'error' && (
                <div className="grid h-7 w-7 place-items-center rounded-full bg-destructive/10 text-destructive">
                  !
                </div>
              )}
            </div>

            {/* Label + description */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className={`font-coolvetica text-base ${
                    state === 'pending' ? 'text-muted-foreground/70' : 'text-foreground'
                  }`}
                >
                  {s.label}
                </p>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    state === 'done'
                      ? 'text-accent'
                      : state === 'running'
                        ? 'text-accent animate-pulse'
                        : 'text-muted-foreground/50'
                  }`}
                >
                  {state === 'done' ? 'done' : state === 'running' ? 'running' : state === 'error' ? 'failed' : 'queued'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>

              {/* Inline detail surface */}
              <AnimatePresence>
                {state === 'done' && details[s.key] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 overflow-hidden"
                  >
                    <DetailSummary step={s.key} detail={details[s.key]!} />
                  </motion.div>
                )}
              </AnimatePresence>

              {isErr && errorMessage && (
                <p className="mt-2 break-words text-xs text-destructive">{errorMessage}</p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function DetailSummary({ step, detail }: { step: MintStepKey; detail: Record<string, unknown> }) {
  const items: Array<[string, string]> = [];
  const truncate = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n)}…` : s);

  if (step === 'voice' && detail.voiceId)
    items.push(['voiceId', String(detail.voiceId)]);
  if (step === 'storage') {
    if (detail.storageRoot) items.push(['root', truncate(String(detail.storageRoot), 24)]);
    if (typeof detail.blobs === 'number') items.push(['blobs', String(detail.blobs)]);
  }
  if (step === 'inft') {
    if (detail.tokenId) items.push(['tokenId', String(detail.tokenId)]);
    if (detail.txHash) items.push(['tx', truncate(String(detail.txHash), 14)]);
  }
  if (step === 'ens.subname' && detail.txHash)
    items.push(['tx', truncate(String(detail.txHash), 14)]);
  if (step === 'ens.records') {
    if (detail.txHash) items.push(['tx', truncate(String(detail.txHash), 14)]);
    if (typeof detail.recordCount === 'number')
      items.push(['records', String(detail.recordCount)]);
  }
  if (step === 'ens.transfer') {
    if (detail.alreadyOwned) {
      items.push(['status', 'already owned']);
    } else if (detail.txHash) {
      items.push(['tx', truncate(String(detail.txHash), 14)]);
    }
    if (detail.newOwner) items.push(['owner', truncate(String(detail.newOwner), 14)]);
  }

  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
      {items.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5"
        >
          <span className="opacity-60">{k}</span>
          <span className="text-foreground">{v}</span>
        </span>
      ))}
    </div>
  );
}
