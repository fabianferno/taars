'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Power, Mic, Square, Loader2 } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { ReplicaProfile } from '@/lib/ens';
import { transcribeAudio } from '@/lib/api';
import { useChatSession } from '@/hooks/useChatSession';
import { useLlmStatus } from '@/hooks/useLlmStatus';
import { useApprovedSpend } from '@/hooks/useApprovedSpend';
import { usdToAtomic, atomicToUsd } from '@/lib/billing';
import { MessageList } from './MessageList';
import { SessionTimerBar } from './SessionTimerBar';
import { EndSessionDialog } from './EndSessionDialog';

const APPROVAL_MINUTES = 30;

export function ChatPanel({ profile }: { profile: ReplicaProfile }) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const ratePerMinUsd = profile.records['taars.price'] ?? '0';
  const ensLabel = profile.ensLabel;

  const chat = useChatSession(ensLabel);
  const llmStatus = useLlmStatus();
  const [input, setInput] = useState('');
  const [voiceMode, setVoiceMode] = useState(true);
  const [backendOffline, setBackendOffline] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Atomic-units allowance target = rate * APPROVAL_MINUTES
  const approvalAtomic = useMemo(() => {
    const rateAtomic = usdToAtomic(ratePerMinUsd || '0');
    return rateAtomic * BigInt(APPROVAL_MINUTES);
  }, [ratePerMinUsd]);

  const billingContract =
    (chat.session?.billingTerms.billingContract as `0x${string}` | '' | undefined) ?? '';
  const usdcAddress =
    (chat.session?.billingTerms.usdcAddress as `0x${string}` | '' | undefined) ?? '';

  const {
    hasEnough,
    approve,
    isApproving,
    isApprovalConfirming,
    isApprovalConfirmed,
    allowance,
    refetch: refetchAllowance,
  } = useApprovedSpend(billingContract, usdcAddress, approvalAtomic);

  useEffect(() => {
    if (isApprovalConfirmed) refetchAllowance();
  }, [isApprovalConfirmed, refetchAllowance]);

  // Auto-play the latest assistant audio in voice mode.
  const lastPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!voiceMode) return;
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== 'assistant' || !last.audioBase64) return;
    if (lastPlayedRef.current === last.id) return;
    lastPlayedRef.current = last.id;
    try {
      const bin = atob(last.audioBase64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const blob = new Blob([buf], { type: last.audioMime ?? 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      void audio.play().catch(() => {
        // autoplay blocked; user can press [Play audio] manually
      });
    } catch {
      // ignore
    }
  }, [chat.messages, voiceMode]);

  async function handleStart() {
    if (!wallet) return;
    setBackendOffline(false);
    const res = await chat.start(wallet.address as `0x${string}`);
    if (!res && chat.error?.toLowerCase().includes('failed to fetch')) {
      setBackendOffline(true);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || chat.sending) return;
    setInput('');
    await chat.send(text);
  }

  async function handleEnd() {
    await chat.end();
  }

  async function startRecording() {
    if (!chat.session || recording || transcribing || chat.sending) return;
    setMicError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicError('microphone not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (!chat.session || blob.size === 0) return;
        setTranscribing(true);
        try {
          const text = (await transcribeAudio(chat.session.sessionId, blob)).trim();
          if (text) await chat.send(text);
          else setMicError('no speech detected');
        } catch (e) {
          setMicError(e instanceof Error ? e.message : 'transcription failed');
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      setMicError(e instanceof Error ? e.message : 'microphone permission denied');
    }
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  // ----- Render branches -----

  if (!authenticated) {
    return (
      <Section title="Start a session">
        <p className="mb-3 text-sm text-muted-foreground">
          Sign in with email, Google, or wallet to begin chatting with {profile.ensFullName}.
        </p>
        <button
          onClick={login}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-light"
        >
          Sign in to start a session
        </button>
      </Section>
    );
  }

  if (!chat.session) {
    const billingActive = Boolean(billingContract && usdcAddress);
    return (
      <Section title="Start a session">
        <p className="text-sm text-muted-foreground">
          Per-minute rate{' '}
          <span className="font-mono text-foreground">${ratePerMinUsd}</span> · approval
          covers up to {APPROVAL_MINUTES} minutes.
        </p>
        {billingActive && (
          <p className="mt-2 text-xs text-muted-foreground">
            current allowance{' '}
            <span className="font-mono text-foreground">${atomicToUsd(allowance)}</span>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {billingActive && !hasEnough && (
            <button
              onClick={approve}
              disabled={isApproving || isApprovalConfirming}
              className="rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
            >
              {isApproving || isApprovalConfirming
                ? 'Approving USDC…'
                : `Approve $${atomicToUsd(approvalAtomic)} USDC`}
            </button>
          )}
          <button
            onClick={handleStart}
            disabled={chat.starting}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-light disabled:opacity-50"
          >
            {chat.starting ? 'Starting…' : 'Approve & Start session'}
          </button>
        </div>

        {(chat.error || backendOffline) && (
          <p className="mt-3 text-sm text-destructive">
            {backendOffline
              ? 'chat backend offline; verify the server is running on :8080'
              : chat.error}
          </p>
        )}
      </Section>
    );
  }

  // Active session
  return (
    <Section title="In session">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SessionTimerBar
            startedAt={chat.session.startedAt}
            ratePerMinUsd={chat.session.ratePerMinUsd}
          />
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={voiceMode}
                onChange={(e) => setVoiceMode(e.target.checked)}
                className="accent-accent"
              />
              auto-play voice
            </label>
            <button
              onClick={handleEnd}
              disabled={chat.ending}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/15 disabled:opacity-50"
            >
              <Power size={12} />
              {chat.ending ? 'Ending…' : 'End session'}
            </button>
          </div>
        </div>

        {llmStatus && !llmStatus.zerog.configured && !llmStatus.openai.configured && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            No LLM provider configured. Chat is disabled. Set <code>OG_BROKER_PROVIDER</code> (0G Compute) or <code>OPENAI_API_KEY</code> on the server.
          </div>
        )}
        {llmStatus?.lastError && llmStatus.zerog.configured && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            0G inference unavailable{llmStatus.openai.configured ? ' — using OpenAI fallback.' : '.'}
            <div className="text-xs opacity-70 mt-1">Reason: {llmStatus.lastError}</div>
          </div>
        )}

        <MessageList messages={chat.messages} sending={chat.sending} />

        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={recording ? 'Listening…' : transcribing ? 'Transcribing…' : 'Type a message…'}
            disabled={recording || transcribing}
            className="flex-1 rounded-xl border border-surface-dark/70 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none disabled:bg-surface-dark/20"
          />
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing || chat.sending}
            title={recording ? 'Stop recording' : 'Speak'}
            aria-label={recording ? 'Stop recording' : 'Speak'}
            className={`inline-flex items-center justify-center rounded-full px-3 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
              recording
                ? 'bg-destructive text-white hover:bg-destructive/90 animate-pulse'
                : 'border border-surface-dark/70 bg-white text-foreground hover:bg-surface-dark/10'
            }`}
          >
            {transcribing ? <Loader2 size={14} className="animate-spin" /> : recording ? <Square size={14} /> : <Mic size={14} />}
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || chat.sending || recording || transcribing}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-light disabled:opacity-50"
          >
            <Send size={14} />
            Send
          </button>
        </div>

        {chat.error && <p className="text-xs text-destructive">{chat.error}</p>}
        {micError && <p className="text-xs text-destructive">{micError}</p>}
      </div>

      {chat.receipt && (
        <EndSessionDialog receipt={chat.receipt} onClose={chat.clearReceipt} />
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-surface-dark/60 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-coolvetica text-xl text-foreground">{title}</h2>
      {children}
    </section>
  );
}
