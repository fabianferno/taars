/**
 * Smoke test: spawn the taars MCP server over stdio, list tools, and (if a
 * label is provided) call taars.resolve. Verifies that the protocol layer
 * works end to end without needing the taars HTTP server up.
 *
 * Usage:
 *   pnpm --filter @taars/mcp smoke              # just lists tools
 *   pnpm --filter @taars/mcp smoke alice         # also calls taars.resolve
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, '..', 'src', 'index.ts');

async function main() {
  const ensLabel = process.argv[2];

  const transport = new StdioClientTransport({
    command: process.execPath, // node binary
    args: ['--import', 'tsx', SERVER_ENTRY],
    env: {
      ...process.env,
      TAARS_SERVER_URL: process.env.TAARS_SERVER_URL ?? 'http://localhost:8080',
    },
  });

  const client = new Client({ name: 'taars-smoke', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);

  const list = await client.listTools();
  console.log('tools/list returned', list.tools.length, 'tools:');
  for (const t of list.tools) {
    console.log(`  - ${t.name}: ${t.description?.slice(0, 80) ?? ''}...`);
  }

  if (ensLabel) {
    console.log(`\ncalling taars.resolve(${ensLabel}) ...`);
    try {
      const out = await client.callTool({
        name: 'taars.resolve',
        arguments: { ensLabel },
      });
      console.log(JSON.stringify(out, null, 2));
    } catch (e) {
      console.error('resolve failed (expected if server is not up):', e);
    }
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
