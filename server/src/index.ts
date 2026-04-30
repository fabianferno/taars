import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { health } from './routes/health.js';
import { mint } from './routes/mint.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());
app.route('/health', health);
app.route('/mint', mint);

app.onError((err, c) => {
  console.error('[server error]', err);
  return c.json({ ok: false, error: err.message }, 500);
});

const port = env.SERVER_PORT;
serve({ fetch: app.fetch, port }, () => {
  console.log(`taars server listening on http://localhost:${port}`);
});
