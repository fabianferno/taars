import { Hono } from 'hono';
import { z } from 'zod';
import OpenAI, { toFile } from 'openai';
import { env } from '../env.js';
import {
  startSession,
  getSession,
  endSession,
  appendMessage,
  type ChatSession,
} from '../services/sessions.js';
import { getLLM, LLMUnavailableError, getLLMStatus, type ChatMessage } from '../services/llm.js';
import { synthesize } from '../services/voice.js';
import { settleSessionOnChain, startSessionOnChain } from '../services/billing.js';
import { x402Required } from '../middleware/x402.js';

export const chat = new Hono();

const startSchema = z.object({
  ensLabel: z.string().regex(/^[a-z0-9-]{2,32}$/),
  callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const messageSchema = z.object({
  sessionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  message: z.string().min(1).max(4000),
});

const endSchema = z.object({
  sessionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

function billingTerms(session: ChatSession) {
  return {
    usdc: env.MOCK_USDC_ADDRESS ?? null,
    billingContract: env.TAARS_BILLING_ADDRESS ?? null,
    network: 'sepolia' as const,
    payTo: env.TAARS_BILLING_ADDRESS ?? null,
    billingActive: Boolean(env.TAARS_BILLING_ADDRESS),
    ratePerMinUsd: session.ratePerMinUsd,
  };
}

// POST /chat/start  — free, creates a session
chat.post('/start', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.message }, 400);
  }
  try {
    const session = await startSession({
      ensLabel: parsed.data.ensLabel,
      callerAddress: parsed.data.callerAddress,
    });
    // Open the billing session on chain so /chat/end can settle it. Failure
    // here shouldn't block chat; settleSessionOnChain will retry the open.
    try {
      await startSessionOnChain(session.sessionId, session.tokenId);
    } catch (e) {
      console.warn(
        `[chat/start] startSessionOnChain failed for ${session.sessionId}: ${(e as Error).message?.slice(0, 200)}`
      );
    }
    return c.json({
      ok: true,
      sessionId: session.sessionId,
      ensLabel: session.ensLabel,
      ensFullName: session.ensFullName,
      ratePerMinUsd: session.ratePerMinUsd,
      voiceId: session.voiceId,
      startedAt: session.startedAt,
      billingTerms: billingTerms(session),
    });
  } catch (e) {
    console.error('[chat/start] failed:', e);
    return c.json({ ok: false, error: (e as Error).message }, 500);
  }
});

// POST /chat/message  — gated by x402 (session header required)
chat.post('/message', x402Required, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.message }, 400);
  }
  const session = getSession(parsed.data.sessionId);
  if (!session) {
    return c.json({ ok: false, error: 'session_not_found' }, 404);
  }
  if (session.endedAt) {
    return c.json({ ok: false, error: 'session_ended' }, 410);
  }

  const userMsg: ChatMessage = { role: 'user', content: parsed.data.message };
  appendMessage(session.sessionId, userMsg);

  const llm = getLLM();
  const systemMsg: ChatMessage = { role: 'system', content: session.systemPrompt };
  let assistantText = '';
  try {
    assistantText = await llm.complete([systemMsg, ...session.messages], {
      temperature: 0.7,
      maxTokens: 400,
    });
  } catch (e) {
    if (e instanceof LLMUnavailableError) {
      return c.json(
        {
          ok: false,
          error: 'llm_unavailable',
          reason: e.reason,
          status: getLLMStatus(),
        },
        503
      );
    }
    console.error('[chat/message] llm failed:', e);
    return c.json(
      { ok: false, error: 'llm_failed', detail: (e as Error).message.slice(0, 200) },
      502
    );
  }
  const assistantMsg: ChatMessage = { role: 'assistant', content: assistantText };
  appendMessage(session.sessionId, assistantMsg);

  let audioBase64 = '';
  try {
    const wav = await synthesize(session.voiceId, assistantText);
    audioBase64 = Buffer.from(wav).toString('base64');
  } catch (e) {
    console.warn(
      `[chat/message] tts failed for voiceId=${session.voiceId}: ${(e as Error).message.slice(0, 120)}`
    );
  }

  return c.json({
    ok: true,
    sessionId: session.sessionId,
    text: assistantText,
    audioBase64,
    provider: llm.name,
  });
});

// POST /chat/end  — close session, attempt settlement
chat.post('/end', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.message }, 400);
  }
  const session = endSession(parsed.data.sessionId);
  if (!session) {
    return c.json({ ok: false, error: 'session_not_found' }, 404);
  }

  const durationSeconds = (session.endedAt ?? Math.floor(Date.now() / 1000)) - session.startedAt;
  const expectedUsd = expectedUsd2dp(session.ratePerMinUsd, durationSeconds);

  // Kick off settlement; race against ~5s.
  const settlePromise = settleSessionOnChain(
    session.sessionId,
    session.endedAt ?? Math.floor(Date.now() / 1000),
    session.ratePerMinUsd,
    durationSeconds,
    session.tokenId,
    session.ensFullName
  ).catch((e) => ({ skipped: true as const, reason: (e as Error).message }));

  const fastResult = await Promise.race([
    settlePromise.then((r) => ({ done: true as const, r })),
    new Promise<{ done: false }>((resolve) => setTimeout(() => resolve({ done: false }), 5000)),
  ]);

  if (fastResult.done) {
    const r = fastResult.r as
      | { skipped: true; reason: string }
      | { txHash: string; expectedUsd: string };
    if ('skipped' in r) {
      return c.json({
        ok: true,
        sessionId: session.sessionId,
        durationSeconds,
        ratePerMinUsd: session.ratePerMinUsd,
        expectedUsd,
        settlement: { settled: false, reason: r.reason },
      });
    }
    return c.json({
      ok: true,
      sessionId: session.sessionId,
      durationSeconds,
      ratePerMinUsd: session.ratePerMinUsd,
      expectedUsd,
      settlement: { settled: true, txHash: r.txHash, expectedUsd: r.expectedUsd },
    });
  }
  // pending: log eventual outcome
  settlePromise.then((r) => {
    const x = r as { skipped: true; reason: string } | { txHash: string; expectedUsd: string };
    if ('skipped' in x) {
      console.warn(`[chat/end] settlement deferred: ${x.reason}`);
    } else {
      console.log(`[chat/end] settlement completed for ${session.sessionId}: tx=${x.txHash}`);
    }
  });
  return c.json({
    ok: true,
    sessionId: session.sessionId,
    durationSeconds,
    ratePerMinUsd: session.ratePerMinUsd,
    expectedUsd,
    settlement: { settled: false, reason: 'pending' },
  });
});

// GET /chat/session/:sessionId  — metadata only
chat.get('/session/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId');
  const session = getSession(sessionId);
  if (!session) {
    return c.json({ ok: false, error: 'session_not_found' }, 404);
  }
  const now = Math.floor(Date.now() / 1000);
  const durationSeconds = (session.endedAt ?? now) - session.startedAt;
  return c.json({
    ok: true,
    sessionId: session.sessionId,
    ensLabel: session.ensLabel,
    ensFullName: session.ensFullName,
    callerAddress: session.callerAddress,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    durationSeconds,
    ratePerMinUsd: session.ratePerMinUsd,
    voiceId: session.voiceId,
    messageCount: session.messages.length,
    expectedUsd: expectedUsd2dp(session.ratePerMinUsd, durationSeconds),
    billingTerms: billingTerms(session),
  });
});

// POST /chat/transcribe — multipart audio → Whisper text. Gated by session.
chat.post('/transcribe', x402Required, async (c) => {
  if (!env.OPENAI_API_KEY) {
    return c.json({ ok: false, error: 'whisper_not_configured' }, 503);
  }
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ ok: false, error: 'invalid_form' }, 400);
  }
  const file = form.get('audio');
  if (!(file instanceof File)) {
    return c.json({ ok: false, error: 'missing_audio' }, 400);
  }
  // Cap upload at ~15 MB.
  if (file.size > 15 * 1024 * 1024) {
    return c.json({ ok: false, error: 'audio_too_large' }, 413);
  }
  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const upload = await toFile(
      Buffer.from(await file.arrayBuffer()),
      file.name || 'audio.webm',
      { type: file.type || 'audio/webm' }
    );
    const result = await client.audio.transcriptions.create({
      file: upload,
      model: 'whisper-1',
    });
    return c.json({ ok: true, text: result.text ?? '' });
  } catch (e) {
    console.error('[chat/transcribe] failed:', e);
    return c.json(
      { ok: false, error: 'transcribe_failed', detail: (e as Error).message.slice(0, 200) },
      502
    );
  }
});

chat.get('/llm-status', (c) => {
  return c.json({ ok: true, status: getLLMStatus() });
});

function expectedUsd2dp(ratePerMinUsd: string, durationSeconds: number): string {
  const rate = Number(ratePerMinUsd || '0');
  if (!Number.isFinite(rate) || rate <= 0) return '0.00';
  return (rate * (durationSeconds / 60)).toFixed(4);
}
