'use client';
import { useState } from 'react';
import { Loader2, Sparkles, Link2, FileText } from 'lucide-react';
import type { PersonalityAnswers } from '@taars/sdk';
import { importPersonality } from '@/lib/api';

const QUESTIONS: {
  key: keyof PersonalityAnswers;
  label: string;
  placeholder: string;
  rows?: number;
}[] = [
  {
    key: 'vibe',
    label: 'How would a close friend describe your vibe?',
    placeholder: 'warm, direct, a bit chaotic',
    rows: 2,
  },
  {
    key: 'expertise',
    label: 'What three things do you know more about than 99% of people?',
    placeholder: 'rollups, climbing, ramen',
    rows: 2,
  },
  {
    key: 'catchphrases',
    label: 'Phrases or words you say constantly',
    placeholder: 'frankly, like, you know what I mean',
    rows: 1,
  },
  {
    key: 'avoid',
    label: 'Topics your replica should not engage with',
    placeholder: 'family details, salary',
    rows: 1,
  },
  { key: 'example1Q', label: 'Sample question #1', placeholder: 'How would you fix Ethereum scaling?', rows: 1 },
  { key: 'example1A', label: 'Sample answer #1 (in your voice)', placeholder: 'Honestly, I think...', rows: 3 },
  { key: 'example2Q', label: 'Sample question #2', placeholder: 'Best book you read this year?', rows: 1 },
  { key: 'example2A', label: 'Sample answer #2', placeholder: '...', rows: 3 },
  { key: 'example3Q', label: 'Sample question #3', placeholder: "What's your hot take on AI agents?", rows: 1 },
  { key: 'example3A', label: 'Sample answer #3', placeholder: '...', rows: 3 },
];

export const emptyPersonality: PersonalityAnswers = {
  vibe: '',
  expertise: '',
  catchphrases: '',
  avoid: '',
  example1Q: '',
  example1A: '',
  example2Q: '',
  example2A: '',
  example3Q: '',
  example3A: '',
};

type ImportMode = 'url' | 'text';

function PersonalityImporter({
  onImported,
}: {
  onImported: (p: PersonalityAnswers) => void;
}) {
  const [mode, setMode] = useState<ImportMode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit =
    !busy && (mode === 'url' ? url.trim().length > 0 : text.trim().length >= 40);

  async function handleImport() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await importPersonality(
        mode === 'url'
          ? { source: 'url', value: url.trim() }
          : { source: 'text', value: text }
      );
      onImported(res.personality);
      setSuccess(
        `Filled from ${mode === 'url' ? 'URL' : 'pasted text'}${
          res.provider ? ` (via ${res.provider})` : ''
        }. Edit anything below.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-surface-dark/60 bg-surface/50 p-4">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="font-medium">Auto-fill from your writing</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Paste a Twitter/X profile, blog URL, or a chunk of your own writing — we&rsquo;ll extract a
        personality profile and pre-fill the form.
      </p>

      <div className="mt-3 inline-flex rounded-full border border-surface-dark/70 bg-white p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
            mode === 'url'
              ? 'bg-accent text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode('text')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
            mode === 'text'
              ? 'bg-accent text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Paste text
        </button>
      </div>

      <div className="mt-3">
        {mode === 'url' ? (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://twitter.com/yourname  ·  https://yourblog.com/post"
            className="w-full rounded-xl border border-surface-dark/70 bg-white p-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition focus:border-accent focus:outline-none"
          />
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a few paragraphs of your own writing — tweets, blog excerpts, journal entries, whatever sounds like you."
            rows={6}
            className="w-full rounded-xl border border-surface-dark/70 bg-white p-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition focus:border-accent focus:outline-none"
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-h-[1rem] text-xs">
          {error && <span className="text-destructive">{error}</span>}
          {success && !error && <span className="text-emerald-600">{success}</span>}
        </div>
        <button
          type="button"
          onClick={handleImport}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Auto-fill personality
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function PersonalityForm({
  value,
  onChange,
}: {
  value: PersonalityAnswers;
  onChange: (v: PersonalityAnswers) => void;
}) {
  return (
    <div className="space-y-4">
      <PersonalityImporter onImported={onChange} />

      {QUESTIONS.map((q) => (
        <label key={q.key} className="block">
          <div className="mb-1 text-sm text-foreground">{q.label}</div>
          <textarea
            value={value[q.key] ?? ''}
            onChange={(e) => onChange({ ...value, [q.key]: e.target.value })}
            placeholder={q.placeholder}
            rows={q.rows ?? 2}
            className="w-full rounded-xl border border-surface-dark/70 bg-white p-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition focus:border-accent focus:outline-none"
          />
        </label>
      ))}
    </div>
  );
}
