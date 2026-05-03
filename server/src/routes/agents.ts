import { Hono } from 'hono';
import { listAgents, getAgentByEnsLabel } from '../services/agents.js';

export const agents = new Hono();

agents.get('/', async (c) => {
  const all = await listAgents();
  const featured = c.req.query('featured');
  const filtered = featured === '1' ? all.filter((a) => a.featured) : all;
  return c.json({ ok: true, agents: filtered });
});

agents.get('/:label', async (c) => {
  const label = c.req.param('label');
  const agent = await getAgentByEnsLabel(label);
  if (!agent) return c.json({ ok: false, error: 'not_found' }, 404);
  return c.json({ ok: true, agent });
});
