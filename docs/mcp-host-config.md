# MCP Host Configuration

> **Compatibility notice**: These examples reflect the MCP specification as of `2026-07-28` and **CoMemor v0.1.0**.
> Configuration formats change across MCP host releases. Verify against your host documentation. These examples have **not** been end-to-end tested against a live host — manual testing required before claiming compatibility.

---

## Claude Desktop (`~/.config/claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["/absolute/path/to/CoMemor/dist/server.js"],
      "env": {
        "AGENT_MEMORY_DIR": "/absolute/path/to/project/.agent-memory",
        "AGENT_MEMORY_REPO": "my-project"
      }
    }
  }
}
```

- `args[0]` must point to compiled `dist/server.js` (run `npm run build` first).
- `AGENT_MEMORY_DIR` must be absolute — do not rely on relative paths.
- Claude Desktop may not inherit your shell PATH; use absolute binary paths.

---

## Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["/absolute/path/to/CoMemor/dist/server.js"],
      "env": {
        "AGENT_MEMORY_DIR": "${workspaceFolder}/.agent-memory",
        "AGENT_MEMORY_REPO": "${workspaceFolderBasename}"
      }
    }
  }
}
```

`${workspaceFolder}` substitution depends on your Cursor version — fall back to absolute paths if unsupported.

---

## Windsurf / VS Code with MCP extension (`.vscode/mcp.json`)

```json
{
  "servers": {
    "agent-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/server.js"],
      "env": {
        "AGENT_MEMORY_DIR": "${workspaceFolder}/.agent-memory",
        "AGENT_MEMORY_REPO": "my-project"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_MEMORY_DIR` | `<cwd>/.agent-memory` | Absolute path to the memory store directory |
| `AGENT_MEMORY_REPO` | `basename(cwd)` | Repository ID scoped to all stored records |

---

## Exposed Capabilities

| Type | Name / URI | Description |
|---|---|---|
| Tool | `record_failure` | Store a failure + fix |
| Tool | `find_fix` | Retrieve matching past fixes |
| Tool | `verify_fix` | Dry-run or approved execution |
| Tool | `list_memory_stats` | Aggregate statistics (matches dashboard Overview) |
| Prompt | `agent_memory_safe_workflow` | 8-step safe repair workflow |
| Resource | `memory://records/{id}` | Read any stored record as JSON |

---

## stdout/stderr Invariant

The MCP server **never** writes non-JSON-RPC data to stdout. All logs go to stderr and `$AGENT_MEMORY_DIR/logs.jsonl`. If a host surfaces the MCP server stderr as a log panel, structured JSON log lines are expected and correct.
