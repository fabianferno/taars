'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: (blob: Blob) => void;
  maxSeconds?: number;
  mode?: 'record' | 'upload';
  onModeChange?: (mode: 'record' | 'upload') => void;
  /** Shown while recording so the user has scripted text for a consistent voice sample. */
  samplePrompt?: string;
}

export function VoiceRecorder({
  onComplete,
  maxSeconds = 60,
  mode = 'record',
  onModeChange,
  samplePrompt,
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
      setRecordedUrl(URL.createObjectURL(blob));
      onComplete(blob);
      stream.getTracks().forEach((t) => t.stop());
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
    setUploadedUrl(URL.createObjectURL(file));
    onComplete(file);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur">
      {mode === 'record' ? (
        <>
          <p className="mb-3 text-sm text-white">
            Record up to {maxSeconds}s of natural speech. Voice character matters more than what you say.
          </p>
          {recording && samplePrompt && (
            <div className="mb-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                Read this aloud
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/95">{samplePrompt}</p>
            </div>
          )}
          {recording ? (
            <button
              onClick={stop}
              className="rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-600"
            >
              Stop ({secondsLeft}s)
            </button>
          ) : (
            <button
              onClick={start}
              className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
            >
              {recordedUrl ? 'Re-record' : 'Start recording'}
            </button>
          )}
          {recordedUrl && <audio src={recordedUrl} controls className="mt-3 w-full" />}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-400">
            Upload an audio file. Accepted: any format supported by OpenVoice (wav, mp3, m4a, flac, ogg…).
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-100">
            {uploadedUrl ? 'Replace file' : 'Choose file'}
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {uploadedUrl && <audio src={uploadedUrl} controls className="mt-3 w-full" />}
        </>
      )}

      {onModeChange && (
        <button
          onClick={() => onModeChange(mode === 'record' ? 'upload' : 'record')}
          className="mt-4 block text-xs text-white underline-offset-2 hover:underline"
        >
          {mode === 'record' ? 'or upload a file instead' : 'or record instead'}
        </button>
      )}
    </div>
  );
}
