import { config as dotenvConfig } from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (../.env from src/, which lives at <pkg>/src) and also <pkg>/.env if present.
dotenvConfig({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenvConfig({ path: path.resolve(__dirname, '..', '.env') });

const schema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(20, 'DISCORD_BOT_TOKEN is required'),
  DISCORD_BOT_PORT: z.coerce.number().default(8090),
  OPENVOICE_URL: z.string().url().default('http://localhost:5005'),
  TAARS_SERVER_URL: z.string().url().default('http://localhost:8080'),
  /**
   * Fallback voice profile to try if the requested voiceId is unknown to
   * OpenVoice (e.g. ENS taars.voice points at a content hash but the bundle
   * was never re-uploaded). Defaults to 'fabian' which is part of the seeded
   * voice set.
   */
  DEFAULT_VOICE_FALLBACK: z.string().default('fabian'),
});

export const env = schema.parse(process.env);
