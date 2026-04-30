import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  SERVER_PORT: z.coerce.number().default(8080),
  DEPLOYER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  SEPOLIA_RPC_URL: z.string().url().default('https://rpc.sepolia.org'),
  OG_RPC_URL: z.string().url().default('https://evmrpc-testnet.0g.ai'),
  OG_INDEXER_URL: z.string().url().default('https://indexer-storage-testnet-turbo.0g.ai'),
  OG_CHAIN_ID: z.coerce.number().default(16602),
  TAARS_INFT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  PARENT_ENS_NAME: z.string().default('taars.eth'),
  OPENVOICE_URL: z.string().url().default('http://localhost:5005'),
});

export const env = schema.parse(process.env);
