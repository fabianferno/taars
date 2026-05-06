'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: (blob: Blob) => void;
  maxSeconds?: number;
  mode?: 'record' | 'upload';
  onModeChange?: (mode: 'record' | 'upload') => void;
  /** Shown while recording so the user has scripted text for a consistent voice sample. */
  samplePrompt?: string;
  /** Reject blobs larger than this (raw bytes, before base64). */
  maxBlobBytes?: number;
  onBlobRejected?: (message: string) => void;
}

export function VoiceRecorder({
  onComplete,
  maxSeconds = 60,
  mode = 'record',
  onModeChange,
  samplePrompt,
  maxBlobBytes,
  onBlobRejected,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function start() {
    chunksRef.current = [];
    setSecondsLeft(maxSeconds);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      stream.getTracks().forEach((t) => t.stop());
      if (maxBlobBytes !== undefined && blob.size > maxBlobBytes) {
        onBlobRejected?.(
          `Recording is too large (${(blob.size / (1024 * 1024)).toFixed(1)} MB). Try stopping sooner or use upload with a compressed file.`
        );
        return;
      }
      setRecordedUrl(URL.createObjectURL(blob));
      onComplete(blob);
    };
    rec.start();
    mediaRef.current = rec;
    setRecording(true);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stop();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (maxBlobBytes !== undefined && file.size > maxBlobBytes) {
      onBlobRejected?.(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB, max ~${(maxBlobBytes / (1024 * 1024)).toFixed(0)} MB raw before encoding).`
      );
      e.target.value = '';
      return;
    }
    setUploadedUrl(URL.createObjectURL(file));
    onComplete(file);
  }

  return (
    <div
      className={`rounded-2xl border border-surface-dark/60 bg-surface p-5 transition-shadow sm:p-6 ${
        recording ? 'shadow-md shadow-accent/10 ring-2 ring-accent/15' : 'shadow-sm'
      }`}
    >
      {mode === 'record' ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Record up to {maxSeconds}s of natural speech. Voice character matters more than what you
            say.
          </p>
          {recording && samplePrompt && (
            <div className="mb-4 rounded-xl border border-accent/20 bg-card-bg px-4 py-3 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-wider text-accent">
                Read this aloud
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{samplePrompt}</p>
            </div>
          )}
          {recording ? (
            <button
              onClick={stop}
              className="rounded-full bg-destructive px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Stop ({secondsLeft}s)
            </button>
          ) : (
            <button
              onClick={start}
              className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-light"
            >
              {recordedUrl ? 'Re-record' : 'Start recording'}
            </button>
          )}
          {recordedUrl && (
            <audio src={recordedUrl} controls className="mt-4 h-10 w-full rounded-lg accent-accent" />
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Upload an audio file. Accepted: any format supported by OpenVoice (wav, mp3, m4a, flac,
            ogg…).
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-light">
            {uploadedUrl ? 'Replace file' : 'Choose file'}
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {uploadedUrl && (
            <audio src={uploadedUrl} controls className="mt-4 h-10 w-full rounded-lg accent-accent" />
          )}
        </>
      )}

      {onModeChange && (
        <button
          type="button"
          onClick={() => onModeChange(mode === 'record' ? 'upload' : 'record')}
          className="mt-4 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {mode === 'record' ? 'or upload a file instead' : 'or record instead'}
        </button>
      )}
    </div>
  );
}
