# @taars/mcp

A standalone Model Context Protocol (MCP) server that exposes the **taars**
product as tools any agent framework can call: Claude Desktop, Cursor,
LangChain, ElizaOS, CrewAI, Claude Code, and so on.

taars is the agent framework where every personality is an ENS-addressable,
0G-anchored Intelligent NFT. This MCP server turns each replica into a
first-class tool that AI agents can discover and invoke without writing any
chain-specific code.

## What this is

The server speaks MCP over stdio. It is a thin proxy in front of the taars
HTTP backend (`server/`): it resolves ENS subnames under `taars.eth`
(Sepolia), opens chat sessions, and surfaces the cloned-voice TTS responses
back to any MCP-aware agent.

ENS layer: Sepolia, parent `taars.eth`.
INFT layer: 0G testnet, address `0xD2063f53Fd1c1353113796B56c45a78A65731d52`.

## Tools exposed

| Tool | Purpose |
| --- | --- |
| `taars.resolve` | Resolve `<label>.taars.eth`, return owner, INFT tokenId, 0G storage merkle root, per-minute USD rate, voice id, description. |
| `taars.chat` | Send a text message to a replica. Auto-starts a billable session if `sessionId` is omitted. Returns text + sessionId + rate. |
| `taars.voice` | Send a message in an existing session and get text plus base64 audio synthesised in the replica's cloned voice. |
| `taars.endSession` | Close a session and get the settlement receipt (`durationSeconds`, `expectedUsd`). |

## Run

```bash
# from the repo root
pnpm install
pnpm --filter @taars/mcp build
node mcp/dist/index.js
```

The server logs to **stderr** and speaks MCP on **stdout** — never `cat` its
output, hook it up to an MCP client.

## Wire it into Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taars": {
      "command": "node",
      "args": ["/Users/fabianferno/Documents/taars/mcp/dist/index.js"],
      "env": {
        "TAARS_SERVER_URL": "http://localhost:8080"
      }
    }
  }
}
```

Restart Claude Desktop. The four `taars.*` tools will appear in the tool
picker.

## Wire it into Cursor

`Settings -> MCP -> Add new MCP Server`:

```json
{
  "taars": {
    "command": "node",
    "args": ["/Users/fabianferno/Documents/taars/mcp/dist/index.js"],
    "env": { "TAARS_SERVER_URL": "http://localhost:8080" }
  }
}
```

## Run the LangChain example

```bash
# After `pnpm --filter @taars/mcp build` and with the taars server running:
pnpm --filter @taars/mcp example:langchain alice 0xYourCallerAddress
```

The example spawns the MCP server itself over stdio, lists the tools, projects
them into a LangChain-compatible tool spec, and invokes `taars.resolve` plus
`taars.chat` end-to-end. Drop the resulting tool spec into
`createOpenAIToolsAgent` or any tool-calling agent and you're done.

## Smoke test

```bash
pnpm --filter @taars/mcp smoke           # lists tools (no taars server needed)
pnpm --filter @taars/mcp smoke alice     # also calls taars.resolve
```

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `TAARS_SERVER_URL` | `http://localhost:8080` | Where the taars Hono server is reachable. |

## Constraints / notes

- All logs go to stderr (`console.error`). stdout is the MCP transport.
- Network and HTTP errors are returned as MCP tool errors (`isError: true`)
  with a human-readable message, so agents see a useful failure rather than
  a hung call.
- Audio is omitted from `taars.chat` to keep payloads small. Use
  `taars.voice` when you actually want audio bytes.
