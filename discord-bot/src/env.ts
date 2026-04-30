import { config as dotenvConfig } from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (../.env from src/, which lives at <pkg>/src) and also <pkg>/.env if present.
dotenvConfig({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenvConfig({ path: path.resolve(__dirname, '..', '.env') });

const schema = z.object({
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_BOT_PORT: z.coerce.number().default(8090),
  OPENVOICE_URL: z.string().url().default('http://localhost:5005'),
  TAARS_SERVER_URL: z.string().url().default('http://localhost:8080'),
});

export const env = schema.parse(process.env);
export const HAS_DISCORD_TOKEN = Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_BOT_TOKEN.length > 0);
