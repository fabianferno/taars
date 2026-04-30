import { Hono } from 'hono';

export const health = new Hono();

health.get('/', (c) =>
  c.json({
    ok: true,
    service: 'taars-server',
    ts: Date.now(),
  })
);
