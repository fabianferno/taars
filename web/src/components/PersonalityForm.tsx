'use client';
import type { PersonalityAnswers } from '@taars/sdk';

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

export function PersonalityForm({
  value,
  onChange,
}: {
  value: PersonalityAnswers;
  onChange: (v: PersonalityAnswers) => void;
}) {
  return (
    <div className="space-y-4">
      {QUESTIONS.map((q) => (
        <label key={q.key} className="block">
          <div className="mb-1 text-sm text-neutral-300">{q.label}</div>
          <textarea
            value={value[q.key] ?? ''}
            onChange={(e) => onChange({ ...value, [q.key]: e.target.value })}
            placeholder={q.placeholder}
            rows={q.rows ?? 2}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 text-sm transition focus:border-neutral-500 focus:outline-none"
          />
        </label>
      ))}
    </div>
  );
}
