'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: (blob: Blob) => void;
  maxSeconds?: number;
}

export function VoiceRecorder({ onComplete, maxSeconds = 60 }: Props) {
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur">
      <p className="mb-3 text-sm text-neutral-400">
        Record up to {maxSeconds}s of natural speech. Voice character matters more than what you say.
      </p>
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
    </div>
  );
}
