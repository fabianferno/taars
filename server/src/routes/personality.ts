import { Hono } from 'hono';
import { z } from 'zod';
import { getLLM, type ChatMessage } from '../services/llm.js';
import type { PersonalityAnswers } from '@taars/sdk';

export const personality = new Hono();

const importSchema = z.object({
  source: z.enum(['url', 'text']),
  value: z.string().min(1).max(50_000),
});

const PERSONALITY_KEYS: (keyof PersonalityAnswers)[] = [
  'vibe',
  'expertise',
  'catchphrases',
  'avoid',
  'example1Q',
  'example1A',
  'example2Q',
  'example2A',
  'example3Q',
  'example3A',
];

const empty = (): PersonalityAnswers => ({
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
});

/** Strip tags, scripts, and collapse whitespace from raw HTML. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(p|br|div|li|h[1-6]|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

async function fetchUrlText(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid url: ${rawUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`unsupported protocol: ${url.protocol}`);
  }
  // Twitter/X blocks unauthenticated scraping — try the public profile but warn LLM if empty.
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; TaarsBot/1.0; +https://taars.eth.limo) PersonalityImporter',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`fetch ${url.host} failed: ${res.status}`);
  }
  const html = await res.text();
  const text = htmlToText(html);
  // Trim very long pages — LLM context is finite.
  return text.slice(0, 24_000);
}

function buildPrompt(corpus: string, hint: string): ChatMessage[] {
  const schema = `{
  "vibe": string,           // 1–2 sentences: how a close friend would describe their vibe
  "expertise": string,      // 3 things they know more about than 99% of people, comma-separated
  "catchphrases": string,   // phrases or words they use frequently, comma-separated
  "avoid": string,          // topics the replica should not engage with, comma-separated
  "example1Q": string,      // a plausible question someone would ask them
  "example1A": string,      // their answer in their voice (3–6 sentences)
  "example2Q": string,
  "example2A": string,
  "example3Q": string,
  "example3A": string
}`;
  return [
    {
      role: 'system',
      content:
        'You analyze a corpus of writing or social posts by a single person and extract a personality profile that captures how they speak. ' +
        'You MUST respond with ONLY a single JSON object — no prose, no markdown, no code fences. ' +
        'Match the schema exactly. Use the source material verbatim where possible (their phrasing, their cadence). ' +
        'If the corpus is sparse, infer reasonably but stay grounded in what is there. Never refuse — make your best inference.',
    },
    {
      role: 'user',
      content:
        `${hint}\n\n` +
        `Schema:\n${schema}\n\n` +
        `Source corpus (between <<<>>>):\n<<<\n${corpus}\n>>>\n\n` +
        `Return only the JSON object.`,
    },
  ];
}

/** Pull the first balanced JSON object out of an LLM reply. Tolerates code fences and prose. */
function extractJson(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

function coerceAnswers(parsed: unknown): PersonalityAnswers {
  const out = empty();
  if (!parsed || typeof parsed !== 'object') return out;
  const obj = parsed as Record<string, unknown>;
  for (const k of PERSONALITY_KEYS) {
    const v = obj[k];
    if (typeof v === 'string') out[k] = v.trim();
    else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string').join(', ');
  }
  return out;
}

personality.post('/import', async (c) => {
  let body: z.infer<typeof importSchema>;
  try {
    body = importSchema.parse(await c.req.json());
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 400);
  }

  let corpus: string;
  let hint: string;
  try {
    if (body.source === 'url') {
      corpus = await fetchUrlText(body.value);
      hint = `The user pointed to this URL: ${body.value}. The corpus below is the extracted text content.`;
    } else {
      corpus = body.value.slice(0, 24_000);
      hint = 'The user pasted their own writing below.';
    }
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 502);
  }

  if (corpus.trim().length < 40) {
    return c.json(
      { ok: false, error: 'corpus is too short to infer personality (need ~40+ chars)' },
      422
    );
  }

  const llm = getLLM();
  let raw: string;
  try {
    raw = await llm.complete(buildPrompt(corpus, hint), { temperature: 0.4, maxTokens: 1200 });
  } catch (err) {
    return c.json({ ok: false, error: `llm: ${(err as Error).message}` }, 502);
  }

  const json = extractJson(raw);
  if (!json) {
    return c.json({ ok: false, error: 'llm returned no JSON', raw: raw.slice(0, 400) }, 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return c.json(
      { ok: false, error: `bad JSON from llm: ${(err as Error).message}`, raw: json.slice(0, 400) },
      502
    );
  }

  const answers = coerceAnswers(parsed);
  return c.json({ ok: true, personality: answers, provider: llm.name });
});
