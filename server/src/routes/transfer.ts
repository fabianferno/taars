import { Hono } from 'hono';
import { z } from 'zod';
import { orchestrateTransfer } from '../services/transfer.js';

export const transfer = new Hono();

const requestSchema = z.object({
  tokenId: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  ensLabel: z.string().regex(/^[a-z0-9-]{2,32}$/),
  newOwner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

transfer.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = requestSchema.parse(body);
  const result = await orchestrateTransfer({
    tokenId: parsed.tokenId,
    ensLabel: parsed.ensLabel,
    newOwner: parsed.newOwner as `0x${string}`,
  });
  return c.json(
    {
      ...result,
      tokenId: result.tokenId,
    },
    result.ok ? 200 : 500
  );
});
