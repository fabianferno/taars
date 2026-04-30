import { config as dotenvConfig } from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, '..', '..', '.env') });

const schema = z.object({
  SERVER_PORT: z.coerce.number().default(8080),
  DEPLOYER_PRIVATE_KEY: z
    .string()
    .regex(/^(0x)?[a-fA-F0-9]{64}$/)
    .transform((v) => (v.startsWith('0x') ? v : `0x${v}`) as `0x${string}`),
  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  SEPOLIA_RPC_URL: z.string().url().default('https://rpc.sepolia.org'),
  OG_RPC_URL: z.string().url().default('https://evmrpc-testnet.0g.ai'),
  OG_INDEXER_URL: z.string().url().default('https://indexer-storage-testnet-turbo.0g.ai'),
  OG_CHAIN_ID: z.coerce.number().default(16602),
  TAARS_INFT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  PARENT_ENS_NAME: z.string().default('taars.eth'),
  OPENVOICE_URL: z.string().url().default('http://localhost:5005'),
  DISCORD_BOT_URL: z.string().url().default('http://localhost:8090'),
  // chat / x402 / billing
  OPENAI_API_KEY: z.string().optional(),
  OG_BROKER_PROVIDER: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  TAARS_BILLING_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  MOCK_USDC_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  MOCK_INFT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

export const env = schema.parse(process.env);
