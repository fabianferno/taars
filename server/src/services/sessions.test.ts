import { describe, it, expect, beforeEach } from 'vitest';
import { startSession, getSession, endSession, _setSessionHooks, _resetSessions } from './sessions.js';

describe('sessions.startSession', () => {
  beforeEach(() => {
    _resetSessions();
  });

  it('creates a session with system prompt from in-memory fixture', async () => {
    _setSessionHooks({
      readEnsRecords: async () => ({
        'taars.storage': '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed',
        'taars.voice': 'smoketest2',
        'taars.price': '0.50',
        'taars.version': 'taars-v1',
      }),
      fetchSoulBundle: async () => ({
        soul: '## vibe\nchill and analytical\n\n## expertise\ndistributed systems\n',
        voice: { voiceId: 'smoketest2' },
        personality: { vibe: 'chill and analytical', expertise: 'distributed systems' },
        version: 'taars-v1',
      }),
    });

    const session = await startSession({
      ensLabel: 'smoketest2',
      callerAddress: '0x5a09e3eC3EFDD91205Cbb097142a4f4dCEFc7f02',
    });

    expect(session.sessionId).toMatch(/^0x[a-f0-9]{64}$/);
    expect(session.ensLabel).toBe('smoketest2');
    expect(session.ensFullName.endsWith('.eth')).toBe(true);
    expect(session.voiceId).toBe('smoketest2');
    expect(session.ratePerMinUsd).toBe('0.50');
    expect(session.systemPrompt).toContain('smoketest2');
    expect(session.systemPrompt.toLowerCase()).toContain('chill');
    expect(session.messages).toEqual([]);
    expect(session.endedAt).toBeUndefined();

    const fetched = getSession(session.sessionId);
    expect(fetched?.sessionId).toBe(session.sessionId);
  });

  it('marks session ended on endSession', async () => {
    _setSessionHooks({
      readEnsRecords: async () => ({
        'taars.storage': '',
        'taars.voice': 'smoketest2',
        'taars.price': '0.10',
        'taars.version': 'taars-v1',
      }),
      fetchSoulBundle: async () => ({ personality: {}, voice: { voiceId: 'smoketest2' } }),
    });
    const s = await startSession({
      ensLabel: 'smoketest2',
      callerAddress: '0x5a09e3eC3EFDD91205Cbb097142a4f4dCEFc7f02',
    });
    const ended = endSession(s.sessionId);
    expect(ended?.endedAt).toBeTypeOf('number');
  });

  it('handles missing storage root without throwing', async () => {
    _setSessionHooks({
      readEnsRecords: async () => ({
        'taars.storage': '',
        'taars.voice': 'foo',
        'taars.price': '0',
      }),
    });
    const s = await startSession({
      ensLabel: 'foo',
      callerAddress: '0x5a09e3eC3EFDD91205Cbb097142a4f4dCEFc7f02',
    });
    expect(s.systemPrompt).toContain('foo');
    expect(s.voiceId).toBe('foo');
  });
});
