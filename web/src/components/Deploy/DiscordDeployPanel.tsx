'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
  ChevronDown,
  ExternalLink,
  Hash,
  Loader2,
  PowerOff,
  Send,
} from 'lucide-react';
import {
  endDiscordDeploy,
  speakDiscordDeploy,
  startDiscordDeploy,
  type DiscordDeployEndResponse,
  type DiscordDeployStartResponse,
} from '@/lib/api';

interface DiscordDeployPanelProps {
  ensLabel: string;
  ensFullName: string;
  basePricePerMinUsd: string;
}

interface SpokenLine {
  id: string;
  text: string;
  durationMs: number;
  ts: number;
}

const DEFAULT_RATE_MULT = 2.5;
const BOT_INVITE_URL =
  'https://discord.com/oauth2/authorize?client_id=1500371820287885402&permissions=8&integration_type=0&scope=bot';

function formatSecs(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export function DiscordDeployPanel({
  ensLabel,
  ensFullName,
  basePricePerMinUsd,
}: DiscordDeployPanelProps) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [open, setOpen] = useState(false);
  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [textChannelId, setTextChannelId] = useState('');
  const [deploy, setDeploy] = useState<DiscordDeployStartResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakInput, setSpeakInput] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [lines, setLines] = useState<SpokenLine[]>([]);
  const [receipt, setReceipt] = useState<DiscordDeployEndResponse | null>(null);

  // Live timer.
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [botStatus, setBotStatus] = useState<{
    ready: boolean;
    botTag: string | null;
    error?: string;
  } | null>(null);

  // Poll bot health when the panel is open and idle.
  useEffect(() => {
    if (!open || deploy) return;
    let cancelled = false;
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:8080';
    const check = async () => {
      try {
        const res = await fetch(`${serverUrl}/deploy/health`);
        if (!res.ok) throw new Error(`server ${res.status}`);
        const data = await res.json();
        if (!cancelled)
          setBotStatus({
            ready: Boolean(data.bot?.discordReady),
            botTag: data.bot?.botTag ?? null,
          });
      } catch (e) {
        if (!cancelled)
          setBotStatus({
            ready: false,
            botTag: null,
            error: e instanceof Error ? e.message : 'unreachable',
          });
      }
    };
    void check();
    const t = window.setInterval(check, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [open, deploy]);
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!deploy || receipt) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000
    );
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [deploy, receipt]);

  const expectedRate =
    Number(basePricePerMinUsd || '0') > 0
      ? (Number(basePricePerMinUsd) * DEFAULT_RATE_MULT).toFixed(2)
      : '0.00';
  const elapsedSecs = deploy ? Math.max(0, now - deploy.startedAt) : 0;
  const elapsedUsd = deploy
    ? ((Number(deploy.ratePerMinUsd) || 0) * (elapsedSecs / 60)).toFixed(4)
    : '0.0000';

  async function handleStart() {
    if (!wallet) {
      void login();
      return;
    }
    setError(null);
    setReceipt(null);
    setLines([]);
    setStarting(true);
    try {
      const res = await startDiscordDeploy({
        ensLabel,
        guildId: guildId.trim(),
        channelId: channelId.trim(),
        textChannelId: textChannelId.trim(),
        ownerAddress: wallet.address as `0x${string}`,
      });
      setDeploy(res);
      setNow(Math.floor(Date.now() / 1000));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'deploy failed');
    } finally {
      setStarting(false);
    }
  }

  async function handleSpeak() {
    if (!deploy) return;
    const text = speakInput.trim();
    if (!text) return;
    setSpeaking(true);
    setError(null);
    try {
      const res = await speakDiscordDeploy(deploy.deployId, text);
      setLines((prev) => [
        ...prev,
        { id: `l_${Date.now()}`, text, durationMs: res.durationMs, ts: Date.now() },
      ]);
      setSpeakInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'speak failed');
    } finally {
      setSpeaking(false);
    }
  }

  async function handleEnd() {
    if (!deploy) return;
    setEnding(true);
    setError(null);
    try {
      const res = await endDiscordDeploy(deploy.deployId);
      setReceipt(res);
      setDeploy(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'end failed');
    } finally {
      setEnding(false);
    }
  }

  return (
    <section className="mt-8 mb-6 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/15">
            <DiscordLogo className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-coolvetica text-lg text-foreground">
              Deploy to Discord VC
            </h2>
            <p className="text-xs text-muted-foreground">
              Bot joins your voice channel and speaks in {ensLabel}'s voice ·
              live billing via x402
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deploy && !receipt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              live
            </span>
          )}
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
            ${expectedRate}/min
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {!authenticated && (
            <button
              type="button"
              onClick={() => void login()}
              className="w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Sign in to deploy
            </button>
          )}

          {authenticated && !deploy && !receipt && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200/70 bg-white px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  New here? Add the taars bot to your Discord server first.
                </div>
                <a
                  href={BOT_INVITE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
                >
                  Invite bot
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {botStatus && (
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    botStatus.ready
                      ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700'
                      : 'border-amber-300/60 bg-amber-50 text-amber-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      botStatus.ready ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {botStatus.ready ? (
                    <>
                      Bot online{botStatus.botTag ? ` as ${botStatus.botTag}` : ''}
                    </>
                  ) : (
                    <>
                      Bot offline{botStatus.error ? ` — ${botStatus.error}` : ''}.
                      Start the discord-bot process before deploying.
                    </>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Guild ID" hint="Discord server ID — right-click server, Copy Server ID">
                  <input
                    value={guildId}
                    onChange={(e) => setGuildId(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456789012345678"
                    className="w-full rounded-lg border border-surface-dark/70 bg-white px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none"
                  />
                </Field>
                <Field label="Voice Channel ID" hint="Right-click the voice channel → Copy Channel ID">
                  <input
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456789012345678"
                    className="w-full rounded-lg border border-surface-dark/70 bg-white px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none"
                  />
                </Field>
                <Field label="Text Channel ID" hint="Right-click the text channel where mentions should reply → Copy Channel ID">
                  <input
                    value={textChannelId}
                    onChange={(e) => setTextChannelId(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456789012345678"
                    className="w-full rounded-lg border border-surface-dark/70 bg-white px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none"
                  />
                </Field>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Make sure the taars bot is invited to your server with{' '}
                <span className="font-mono text-foreground">Connect</span> and{' '}
                <span className="font-mono text-foreground">Speak</span> permissions.
                You need <span className="font-mono">Developer Mode</span> on in
                Discord settings to copy IDs.
              </p>
              <button
                type="button"
                onClick={handleStart}
                disabled={starting || !guildId || !channelId || !textChannelId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Provisioning bot…
                  </>
                ) : (
                  <>
                    <DiscordLogo className="h-4 w-4" /> Deploy {ensFullName} to VC
                  </>
                )}
              </button>
            </>
          )}

          {deploy && !receipt && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <LiveStat label="Voice" value={deploy.voiceId} />
                <LiveStat label="Elapsed" value={formatSecs(elapsedSecs)} />
                <LiveStat label="Rate" value={`$${deploy.ratePerMinUsd}/min`} />
                <LiveStat label="Accrued" value={`$${elapsedUsd}`} />
              </div>
              <div className="rounded-lg border border-surface-dark/60 bg-surface/40 p-2 text-[11px] text-muted-foreground">
                <span className="font-mono">deployId:</span>{' '}
                <span className="font-mono text-foreground">{deploy.deployId}</span>{' '}
                · <span className="font-mono">guild:</span>{' '}
                <span className="font-mono text-foreground">{deploy.ensFullName}</span>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3" /> Make {ensLabel} say something
                </div>
                <div className="flex gap-2">
                  <input
                    value={speakInput}
                    onChange={(e) => setSpeakInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSpeak();
                      }
                    }}
                    placeholder="What should the taar say in the VC?"
                    disabled={speaking}
                    className="flex-1 rounded-lg border border-surface-dark/70 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleSpeak}
                    disabled={speaking || !speakInput.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {speaking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {lines.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-surface-dark/60 bg-surface/40 p-2 text-xs">
                  {lines
                    .slice()
                    .reverse()
                    .map((l) => (
                      <li
                        key={l.id}
                        className="flex items-start gap-2 text-foreground"
                      >
                        <span className="mt-0.5 shrink-0 text-[10px] text-muted-foreground">
                          {(l.durationMs / 1000).toFixed(1)}s
                        </span>
                        <span className="leading-snug">{l.text}</span>
                      </li>
                    ))}
                </ul>
              )}

              <button
                type="button"
                onClick={handleEnd}
                disabled={ending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/15 disabled:opacity-50"
              >
                {ending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Tearing down…
                  </>
                ) : (
                  <>
                    <PowerOff className="h-4 w-4" /> End session &amp; settle
                  </>
                )}
              </button>
            </div>
          )}

          {receipt && (
            <div className="space-y-3 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-xs">
              <div className="font-medium text-emerald-700">
                Deployment ended &amp; settled
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <LiveStat label="Duration" value={formatSecs(receipt.deployedSeconds)} />
                <LiveStat label="Rate" value={`$${receipt.ratePerMinUsd}/min`} />
                <LiveStat label="Total" value={`$${receipt.expectedUsd}`} />
                <LiveStat
                  label="Settled"
                  value={receipt.settlement.settled ? 'on-chain' : 'pending'}
                />
              </div>
              {receipt.settlement.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${receipt.settlement.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all font-mono text-[10px] text-emerald-700 underline"
                >
                  {receipt.settlement.txHash}
                </a>
              )}
              {!receipt.settlement.settled && receipt.settlement.reason && (
                <p className="text-[11px] text-muted-foreground">
                  {receipt.settlement.reason}
                </p>
              )}
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                deploy again
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function DiscordLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/discord-icon.jpg"
      alt="Discord"
      width={24}
      height={24}
      className={`${className ?? ''} rounded-md object-cover`}
    />
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-dark/60 bg-white px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-xs text-foreground">{value}</div>
    </div>
  );
}
