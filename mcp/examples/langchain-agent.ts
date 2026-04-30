/**
 * Example: a LangChain-style agent consuming the taars MCP server.
 *
 * To keep the demo runnable without API keys, this script does NOT actually
 * spin up a LangChain LLM. Instead it shows exactly what a LangChain agent
 * would do: it spawns the taars MCP server over stdio, lists the tools,
 * presents them in a LangChain-compatible "tool spec" shape, and invokes
 * one of them directly via the MCP client. Plug this list into
 * `createOpenAIToolsAgent` (or any tool-calling agent) and it will work
 * with no further changes.
 *
 * Usage:
 *   pnpm --filter @taars/mcp example:langchain alice 0xabc...
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, '..', 'src', 'index.ts');

async function main() {
  const ensLabel = process.argv[2] ?? 'alice';
  const callerAddress =
    process.argv[3] ?? '0x0000000000000000000000000000000000000001';

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', SERVER_ENTRY],
    env: {
      ...process.env,
      TAARS_SERVER_URL: process.env.TAARS_SERVER_URL ?? 'http://localhost:8080',
    },
  });

  const client = new Client(
    { name: 'taars-langchain-demo', version: '0.0.1' },
    { capabilities: {} }
  );
  await client.connect(transport);

  // 1. Discover tools via MCP and project them into a LangChain tool spec.
  const list = await client.listTools();
  const langchainToolSpec = list.tools.map((t) => ({
    name: t.name,
    description: t.description,
    schema: t.inputSchema,
    // a LangChain `DynamicStructuredTool.func` would call back into MCP:
    invoke: async (input: Record<string, unknown>) => {
      const res = await client.callTool({ name: t.name, arguments: input });
      return res;
    },
  }));

  console.log('Discovered', langchainToolSpec.length, 'taars tools:');
  for (const t of langchainToolSpec) {
    console.log(`  * ${t.name}`);
  }

  // 2. Demonstrate the agent flow: resolve the replica, then chat.
  console.log(`\n[1/2] taars.resolve { ensLabel: "${ensLabel}" }`);
  const resolved = await langchainToolSpec
    .find((t) => t.name === 'taars.resolve')!
    .invoke({ ensLabel });
  console.log(JSON.stringify(resolved, null, 2));

  console.log(
    `\n[2/2] taars.chat { ensLabel: "${ensLabel}", callerAddress: "${callerAddress}", message: "..." }`
  );
  try {
    const chat = await langchainToolSpec
      .find((t) => t.name === 'taars.chat')!
      .invoke({
        ensLabel,
        callerAddress,
        message: 'Hi, can you introduce yourself?',
      });
    console.log(JSON.stringify(chat, null, 2));
  } catch (e) {
    console.error(
      'chat failed (likely because the taars server /chat endpoints are not up):',
      e
    );
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
