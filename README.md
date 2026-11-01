# CoMemor

> **Repository-scoped AI agent memory** — an MCP server that remembers your errors and fixes so your AI coding tools don't repeat the same mistakes.

[![Node ≥22.5](https://img.shields.io/badge/node-%3E%3D22.5-brightgreen)](https://nodejs.org)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-2026--07--28-blue)](https://spec.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it does

CoMemor is an **MCP (Model Context Protocol) server** that gives your AI agent a persistent, secure memory scoped to your project repository. When your agent encounters an error, it records the command, exit code, and fix. The next time a similar error appears — even phrased differently — CoMemor surfaces the stored fix automatically.

**Key features:**
- Fuzzy semantic matching (normalisation + SHA-256 fingerprinting) — finds fixes even when commands differ slightly
- Multi-layer secret redaction — regex patterns (ADR-005) + Shannon entropy gate prevent API keys ever touching disk
- 7-layer prompt-injection poisoning defense before any record is persisted
- Human-in-the-loop approval gate for fix execution (`dry_run` is the safe default)
- SQLite FTS5 search index, rebuilt deterministically from an append-only JSONL source of truth
- Optional **Memory Console** dashboard (React + Vite) for live audit and observability

---

## Installation

### Option A — npx (no install needed)

Use directly from any project without a global install:

```bash
# In your project directory
npx comemor
```

### Option B — global install

```bash
npm install -g comemor
comemor
```

### Option C — local project install

```bash
npm install comemor
# Run via npx in the project
npx comemor
```

**Requires Node.js ≥ 22.5.0** (uses built-in `node:sqlite`).

---

## Connecting to your AI IDE

### Antigravity (Google)

Add to your Antigravity MCP config (`.gemini/antigravity/mcp.json` or workspace settings):

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

### Claude Desktop / Claude.app

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "comemor": {
      "command": "npx",
      "args": ["comemor"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

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

### VS Code (Copilot / Continue)

In `.vscode/mcp.json`:

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

---

## MCP Tools exposed

| Tool | Description |
|------|-------------|
| `record_failure` | Store a command failure with its fix and explanation |
| `find_fix` | Retrieve the best-matching stored fix for a command |
| `list_fixes` | List recent stored fixes with optional keyword filter |
| `get_stats` | Summary statistics (total records, quarantined, age distribution) |
| `verify_fix` | Approve or reject a pending fix execution (human gate) |

---

## How your agent uses it

Once connected, CoMemor works **transparently**. Your agent will:

1. **On error** — call `record_failure` with the failing command, exit code, fix commands, and a brief explanation.
2. **Before retrying** — call `find_fix` with the failing command. If a match is returned (score > threshold), apply the fix instead of guessing.
3. **On approval** — if `verify_fix` is available, the human confirms before any fix command executes (`dry_run: true` by default — safe).

You can instruct your agent with a system prompt like:

```
Before retrying any failing command, call the comemor find_fix tool.
After resolving any error, call comemor record_failure with the command,
exit code, fix steps, and a brief explanation.
```

---

## Optional: Memory Console Dashboard

CoMemor ships with a local observability dashboard for auditing your agent's memory in real time.

```bash
# 1. Start the read-only bridge (in your project root)
npx comemor-dashboard

# 2. In a second terminal, start the frontend
cd node_modules/comemor/dashboard/frontend
npm install && npm run dev

# Open http://localhost:5173
```

> The dashboard is a fully separate process — it never shares stdin/stdout with the MCP server.

---

## Data storage

All data lives in `.agent-memory/` inside your project directory:

```
.agent-memory/
  records.jsonl      # Append-only source of truth (git-trackable, secrets redacted)
  schema-version     # Integer schema version
  index.db           # Rebuildable SQLite FTS5 index (gitignored)
  logs.jsonl         # Structured server logs (gitignored)
```

Add this to your `.gitignore` if not already present:

```gitignore
.agent-memory/*.db
.agent-memory/*.db-shm
.agent-memory/*.db-wal
.agent-memory/logs.jsonl
```

The `records.jsonl` file is safe to commit — all secrets are redacted before persistence.

---

## Security guarantees

- `stdout` carries **JSON-RPC only** — no debug output, no secrets ever written there
- Secrets are stripped via regex patterns **and** Shannon entropy analysis (H > 4.5 bits/char)
- All record content is treated as untrusted — wrapped in explicit delimiters before return
- Fix execution requires explicit human approval; `dry_run` is the enforced default
- Quarantined records (prompt-injection attempts) are isolated and excluded from default retrieval

---

## Repository structure

```
src/               MCP server source (TypeScript)
  server.ts        Entry point — stdio JSON-RPC transport
  tools/           MCP tool handlers
  core/            Pure functions: normalize, fingerprint, redact, match
  storage/         JSONL + SQLite adapters
  policy/          Command allowlist and execution gate
tests/             168 tests — unit, integration, security, e2e
dashboard/
  bridge/          Read-only HTTP bridge to .agent-memory data
  frontend/        React + Vite Memory Console UI
docs/              Architecture decisions (ADRs), operations, evaluation
```

---

## License

MIT — see [LICENSE](LICENSE)
