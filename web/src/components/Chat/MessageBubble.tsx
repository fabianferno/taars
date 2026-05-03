'use client';
import { useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useChatSession';

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const audioUrl = useMemo(() => {
    if (!message.audioBase64) return null;
    const mime = message.audioMime ?? 'audio/wav';
    try {
      return URL.createObjectURL(base64ToBlob(message.audioBase64, mime));
    } catch {
      return null;
    }
  }, [message.audioBase64, message.audioMime]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  if (message.role === 'system') {
    return (
      <div className="my-2 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        {message.text}
      </div>
    );
  }

  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-1`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-accent text-white'
            : 'border border-surface-dark/60 bg-white text-foreground shadow-sm',
        ].join(' ')}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        {!isUser && message.provider === 'zerog' && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Powered by 0G Compute
          </div>
        )}
        {!isUser && audioUrl && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="inline-flex items-center gap-1 rounded-full border border-surface-dark/70 bg-surface/60 px-2.5 py-1 text-[11px] text-foreground transition hover:bg-surface"
            >
              {playing ? <Pause size={12} /> : <Play size={12} />}
              {playing ? 'Pause' : 'Play audio'}
            </button>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setPlaying(false)}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              preload="auto"
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
}
