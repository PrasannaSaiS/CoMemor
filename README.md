# CoMemor

> **Repository-scoped AI agent memory** — an MCP server that remembers your errors and fixes so your AI coding tools never repeat the same mistake twice.

[![npm version](https://img.shields.io/npm/v/comemor)](https://www.npmjs.com/package/comemor)
[![Node ≥22.5](https://img.shields.io/badge/node-%3E%3D22.5-brightgreen)](https://nodejs.org)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-2026--07--28-blue)](https://spec.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it does

CoMemor is an **MCP (Model Context Protocol) server** that gives your AI agent a persistent, secure memory scoped to your project repository. When your agent hits an error, it records the command, exit code, and the fix that resolved it. Next time a similar error appears — even phrased differently — CoMemor surfaces the stored fix automatically.

**Key features:**
- Fuzzy semantic matching finds fixes even when commands differ slightly
- Multi-layer secret redaction (regex + Shannon entropy) — API keys never touch disk
- 7-layer prompt-injection poisoning defense before any record is persisted
- Human-in-the-loop approval gate for fix execution (`dry_run` is the safe default)
- SQLite FTS5 search index, rebuilt deterministically from an append-only JSONL source of truth
- **Memory Console** — a built-in local dashboard for live audit and observability (single command, no setup)

---

## Installation

**Requires Node.js ≥ 22.5.0** (uses the built-in `node:sqlite` module).

```bash
# Use without installing (recommended)
npx comemor

# Or install globally
npm install -g comemor

# Or install locally in your project
npm install comemor
```

---

## Connecting to your AI IDE

> **Not sure which config file to edit?**
> Skip the manual steps — copy the agent prompt for your IDE from the section below and paste it directly into your AI assistant. It will locate the right file and set everything up for you.

---

### Antigravity (Google)

**Manual config** — add to `~/.gemini/antigravity/mcp.json`:

```json
{
  "mcpServers": {
    "comemor": {
      "command": "npx",
      "args": ["comemor"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**Agent setup prompt** — paste this into Antigravity chat:

```
Set up the CoMemor MCP server for this project.

1. Open or create the file ~/.gemini/antigravity/mcp.json
2. Add a "comemor" entry under "mcpServers" with:
   - command: "npx"
   - args: ["comemor"]
   - cwd: "${workspaceFolder}"
3. If other MCP servers already exist in that file, merge this entry in — do not overwrite them.
4. Save the file.
5. Confirm what you added and tell me to restart Antigravity for the change to take effect.
```

---

### Claude Desktop

**Manual config** — edit:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "comemor": {
      "command": "npx",
      "args": ["comemor"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

> Replace `/absolute/path/to/your/project` with your actual project directory. Claude Desktop requires an absolute path.

**Agent setup prompt** — paste this into any AI assistant (Claude, ChatGPT, etc.):

```
Set up the CoMemor MCP server for Claude Desktop.

1. Find the Claude Desktop config file:
   - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Windows: %APPDATA%\Claude\claude_desktop_config.json
2. Add a "comemor" entry under "mcpServers" using the current working directory as the absolute "cwd" value.
   Use:
     "command": "npx"
     "args": ["comemor"]
3. If the file doesn't exist, create it with the full JSON structure.
4. If other MCP servers already exist, merge — do not overwrite them.
5. Show me the final file contents and remind me to fully quit and reopen Claude Desktop.
```

---

### Cursor

**Manual config** — create or update `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "comemor": {
      "command": "npx",
      "args": ["comemor"],
      "cwd": "."
    }
  }
}
```

**Agent setup prompt** — paste this into Cursor chat (Cmd/Ctrl+L):

```
Set up the CoMemor MCP server for this Cursor project.

1. Check if .cursor/mcp.json exists in the project root. If not, create it.
2. Add a "comemor" entry under "mcpServers" with:
   - command: "npx"
   - args: ["comemor"]
   - cwd: "."
3. If other MCP servers already exist in that file, merge — do not replace them.
4. Save the file, then show me the final content.
5. Tell me to go to Cursor Settings → MCP and click "Refresh" to load the new server.
```

---

### VS Code (GitHub Copilot / Continue)

**Manual config** — create or update `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "comemor": {
      "type": "stdio",
      "command": "npx",
      "args": ["comemor"]
    }
  }
}
```

**Agent setup prompt** — paste this into Copilot Chat or Continue:

```
Set up the CoMemor MCP server for VS Code.

1. Check if .vscode/mcp.json exists in the project root. If not, create it.
2. Add a "comemor" entry under "servers" with:
   - type: "stdio"
   - command: "npx"
   - args: ["comemor"]
3. If other servers already exist in that file, merge — do not replace them.
4. Save the file.
5. Show me the final content and remind me to run the "MCP: List Servers" command in VS Code to verify it loaded.
```

---

### Windsurf (Codeium)

**Manual config** — edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "comemor": {
      "command": "npx",
      "args": ["comemor"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**Agent setup prompt** — paste this into Windsurf chat (Cascade):

```
Set up the CoMemor MCP server for Windsurf.

1. Open or create ~/.codeium/windsurf/mcp_config.json
2. Add a "comemor" entry under "mcpServers" with:
   - command: "npx"
   - args: ["comemor"]
   - cwd: "${workspaceFolder}"
3. If other servers already exist, merge — do not overwrite.
4. Save the file and show me the final content.
5. Tell me to go to Windsurf Settings → MCP Servers and click Refresh.
```

---

## Telling your agent how to use CoMemor

Once the MCP server is connected, add this to your AI assistant's **system prompt** or **instructions** field so it uses CoMemor automatically:

```
You have access to the CoMemor MCP server which stores and retrieves error fixes for this project.

Rules:
1. Before retrying any failing command or debugging any error, ALWAYS call find_fix first with the failing command and error output. If a match is returned, apply it — do not guess.
2. After you confirm a fix works, call record_failure with the original command, exit code, the fix commands that resolved it, and a brief explanation.
3. Never skip these calls to save tokens. Accumulated memory reduces future debugging time significantly.
4. Secrets and credentials are automatically redacted before persistence — never suppress or modify this behavior.
```

---

## MCP Tools

| Tool | When to call |
|------|-------------|
| `find_fix` | Before retrying any error — searches for a matching stored fix |
| `record_failure` | After a fix is confirmed working — persists the record |
| `verify_fix` | Dry-run a stored fix before executing; requires human approval to actually run |
| `stats` | View aggregate memory statistics (record count, quarantine status, age) |

---

## Memory Console Dashboard

CoMemor ships with a built-in local dashboard — no separate install or setup needed.

```bash
# Start the dashboard (serves on http://localhost:4321)
npx comemor-dashboard
```

Then open **http://localhost:4321** in your browser.

The dashboard is a fully separate process from the MCP server — it never shares stdin/stdout with it. It connects to your `.agent-memory/` data directory automatically (same directory the MCP server uses).

**What you can see:**
- Live activity feed of agent tool calls (SSE stream)
- All stored fix records with full-text search
- Security audit — secret redaction layers, quarantined records, injection attempts
- Retrieval explainability — why a specific fix was or wasn't returned
- Approval queue for pending fix executions

---

## How data is stored

All data lives in `.agent-memory/` inside your project directory:

```
.agent-memory/
  records.jsonl      — Append-only fix records (safe to commit — secrets are redacted)
  index.db           — SQLite FTS5 index (gitignored, rebuilt automatically)
  logs.jsonl         — Operational logs (gitignored)
```

Add to your `.gitignore` (if not already present):

```gitignore
.agent-memory/*.db
.agent-memory/*.db-shm
.agent-memory/*.db-wal
.agent-memory/logs.jsonl
.agent-memory/pending-approvals.jsonl
.agent-memory/approvals-resolved.jsonl
```

The `records.jsonl` file is safe to commit — all API keys, tokens, and credentials are stripped before any record reaches disk.

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGENT_MEMORY_DIR` | `.agent-memory/` in cwd | Override the storage directory path |
| `AGENT_MEMORY_REPO` | Git repo name from cwd | Override the repository identifier used for staleness checks |
| `BRIDGE_PORT` | `4321` | Override the dashboard bridge port |

---

## Security

- `stdout` carries **JSON-RPC only** — no debug output ever written there
- Secrets stripped via regex patterns **and** Shannon entropy analysis (H > 4.5 bits/char)
- All retrieved record content is wrapped in explicit untrusted-data delimiters before return
- Fix execution requires explicit human approval; `dry_run` is the enforced safe default
- Quarantined records (detected prompt-injection attempts) are isolated and excluded from retrieval

---

## Repository structure

```
src/               MCP server source (TypeScript)
  server.ts        Entry point — stdio JSON-RPC transport
  core/            Normalize, fingerprint, redact, match, poison detection
  storage/         JSONL append + SQLite FTS5 index adapters
  tools/           MCP tool handlers
  policy/          Command allowlist and human-approval execution gate
dashboard/
  bridge/          Read-only Fastify HTTP bridge to .agent-memory data
  frontend/        React + Vite Memory Console (pre-built, ships in package)
tests/             168 tests — unit, integration, security, e2e
docs/              Architecture decisions (ADRs), operations guide, evaluation
```

---

## License

MIT — see [LICENSE](LICENSE)
