#!/usr/bin/env node
/**
 * taars MCP server.
 *
 * Exposes the taars product (ENS-addressable AI replicas backed by 0G INFTs)
 * as Model Context Protocol tools that any MCP-aware agent framework
 * (Claude Desktop, Cursor, LangChain, ElizaOS, CrewAI, etc.) can call.
 *
 * Speaks MCP over stdio. All logging MUST go to stderr because stdout is
 * the protocol transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

const SERVER_URL = (process.env.TAARS_SERVER_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const SERVER_NAME = 'taars';
const SERVER_VERSION = '0.0.1';

/**
 * Internal HTTP helper. Surfaces network/server errors as plain Error
 * objects with useful messages so the MCP layer can return tool errors.
 */
async function httpJson<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  const url = `${SERVER_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...headers,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`network error contacting taars server at ${url}: ${msg}`);
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const errMsg =
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : null) ?? `HTTP ${res.status}`;
    throw new Error(`taars server ${method} ${path} failed: ${errMsg}`);
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// Tool definitions (JSON Schemas + descriptions visible to agent frameworks).
// ---------------------------------------------------------------------------
const TOOLS: Tool[] = [
  {
    name: 'taars.resolve',
    description:
      'Resolve an ENS subname under taars.eth (Sepolia) and return the on-chain replica metadata: owner, INFT tokenId on 0G testnet, 0G storage merkle root, per-minute USD rate, voice profile id, and description. Use this before chatting to discover what a replica costs and who owns it.',
    inputSchema: {
      type: 'object',
      properties: {
        ensLabel: {
          type: 'string',
          description: 'The label part of the ENS name (e.g. "alice" for alice.taars.eth).',
        },
      },
      required: ['ensLabel'],
      additionalProperties: false,
    },
  },
  {
    name: 'taars.chat',
    description:
      'Send a text message to a taars replica identified by its ENS label. If sessionId is omitted, a new billable chat session is started first. Returns the assistant text reply, sessionId (reuse to continue), and the per-minute USD rate. Audio is omitted from this tool to keep payloads small. Call taars.voice if you need spoken audio, and taars.endSession to settle billing.',
    inputSchema: {
      type: 'object',
      properties: {
        ensLabel: {
          type: 'string',
          description: 'The taars subname label (e.g. "alice" for alice.taars.eth).',
        },
        callerAddress: {
          type: 'string',
          description: 'EVM address (0x...) of the caller, used for billing/auth.',
        },
        message: {
          type: 'string',
          description: 'The user message to send to the replica.',
        },
        sessionId: {
          type: 'string',
          description: 'Optional existing session id. Omit to start a new session.',
        },
      },
      required: ['ensLabel', 'callerAddress', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'taars.voice',
    description:
      'Send a message to an existing chat session and receive both text and base64-encoded audio (synthesised with the replica\'s cloned voice). Use within an existing session opened by taars.chat. Audio is base64 - decode and play in your client.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Existing session id from taars.chat.',
        },
        message: {
          type: 'string',
          description: 'The user message to send.',
        },
      },
      required: ['sessionId', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'taars.endSession',
    description:
      'End an active chat session and return the settlement receipt: total seconds chatted and expected USD owed. The server records this for x402/USDC billing.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session id to close.',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers.
// ---------------------------------------------------------------------------
type ResolveArgs = { ensLabel: string };
type ChatArgs = {
  ensLabel: string;
  callerAddress: string;
  message: string;
  sessionId?: string;
};
type VoiceArgs = { sessionId: string; message: string };
type EndArgs = { sessionId: string };

async function handleResolve(args: ResolveArgs) {
  const ensLabel = String(args.ensLabel ?? '').trim();
  if (!ensLabel) throw new Error('ensLabel is required');
  return httpJson<Record<string, unknown>>(
    'GET',
    `/resolve/${encodeURIComponent(ensLabel)}`
  );
}

async function handleChat(args: ChatArgs) {
  const ensLabel = String(args.ensLabel ?? '').trim();
  const callerAddress = String(args.callerAddress ?? '').trim();
  const message = String(args.message ?? '');
  if (!ensLabel) throw new Error('ensLabel is required');
  if (!callerAddress) throw new Error('callerAddress is required');
  if (!message) throw new Error('message is required');

  let sessionId = args.sessionId;
  let ratePerMinUsd: string | undefined;
  if (!sessionId) {
    const start = await httpJson<{
      sessionId: string;
      ratePerMinUsd: string;
      voiceId?: string;
      ensFullName?: string;
    }>('POST', '/chat/start', { ensLabel, callerAddress });
    sessionId = start.sessionId;
    ratePerMinUsd = start.ratePerMinUsd;
  }

  const reply = await httpJson<{ text: string; audioBase64?: string }>(
    'POST',
    '/chat/message',
    { sessionId, message },
    { 'X-Taars-Session': sessionId }
  );

  return {
    sessionId,
    text: reply.text,
    ratePerMinUsd: ratePerMinUsd ?? null,
  };
}

async function handleVoice(args: VoiceArgs) {
  const sessionId = String(args.sessionId ?? '').trim();
  const message = String(args.message ?? '');
  if (!sessionId) throw new Error('sessionId is required');
  if (!message) throw new Error('message is required');

  const reply = await httpJson<{ text: string; audioBase64?: string }>(
    'POST',
    '/chat/message',
    { sessionId, message },
    { 'X-Taars-Session': sessionId }
  );
  return {
    sessionId,
    text: reply.text,
    audioBase64: reply.audioBase64 ?? '',
  };
}

async function handleEndSession(args: EndArgs) {
  const sessionId = String(args.sessionId ?? '').trim();
  if (!sessionId) throw new Error('sessionId is required');
  return httpJson<Record<string, unknown>>('POST', '/chat/end', { sessionId });
}

async function dispatch(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'taars.resolve':
      return handleResolve(args as unknown as ResolveArgs);
    case 'taars.chat':
      return handleChat(args as unknown as ChatArgs);
    case 'taars.voice':
      return handleVoice(args as unknown as VoiceArgs);
    case 'taars.endSession':
      return handleEndSession(args as unknown as EndArgs);
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// MCP server bootstrap.
// ---------------------------------------------------------------------------
async function main() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await dispatch(name, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[taars-mcp] tool ${name} failed:`, msg);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `taars MCP tool "${name}" failed: ${msg}`,
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[taars-mcp] ${SERVER_NAME} v${SERVER_VERSION} ready over stdio (server=${SERVER_URL})`
  );
}

main().catch((e) => {
  console.error('[taars-mcp] fatal:', e);
  process.exit(1);
});
