import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { health } from './routes/health.js';
import { mint } from './routes/mint.js';
import { resolve } from './routes/resolve.js';
import { chat } from './routes/chat.js';
import { deploy } from './routes/deploy.js';
import { transfer } from './routes/transfer.js';
import { personality } from './routes/personality.js';
import { agents } from './routes/agents.js';
import { billing } from './routes/billing.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());
app.route('/health', health);
app.route('/mint', mint);
app.route('/resolve', resolve);
app.route('/chat', chat);
app.route('/deploy', deploy);
app.route('/transfer', transfer);
app.route('/personality', personality);
app.route('/agents', agents);
app.route('/billing', billing);

app.onError((err, c) => {
  console.error('[server error]', err);
  return c.json({ ok: false, error: err.message }, 500);
});

const port = env.SERVER_PORT;
serve({ fetch: app.fetch, port }, () => {
  console.log(`taars server listening on http://localhost:${port}`);
});
