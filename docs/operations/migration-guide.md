# Migration Guide

> **Document Status:** Released — Version 0.1.0  
> **Target Schema Version:** 1  
> **Target MCP Specification:** 2026-07-28  

---

## 1. Overview of Changes in Version 0.1.0

Version 0.1.0 transitions `CoMemor` to a hardened, production-grade memory ecosystem with:
- **Strict Protocol Compliance:** Full adherence to MCP specification version `2026-07-28`.
- **Dual Storage Architecture:** Append-only `records.jsonl` as immutable source of truth paired with a fast, disposable `node:sqlite` index.
- **Sanitization Envelope & Poisoning Defenses:** Automated homoglyph neutralization, delimiter sanitization, and heuristic quarantine flags.
- **Human-in-the-Loop Command Execution Policy:** Mandatory approval queue (`approvals-pending.jsonl` and `approvals-resolved.jsonl`) with dry-run verification defaults.
- **Multi-Screen Observability Dashboard:** Read-only `dashboard-bridge` process and Vite/React `dashboard-frontend`.

---

## 2. Upgrading Data Files to Schema Version 1

Every record written by `CoMemor` includes `schemaVersion: 1`.

### 2.1 Backward Compatibility Invariant
If you have legacy JSONL files created during earlier experimental iterations:
1. `CoMemor` automatically treats missing `schemaVersion` fields as version 1 defaults where fields are backward compatible.
2. If custom fields exist, they are preserved in the raw JSON payload in SQLite's `data` column without schema violation.

### 2.2 Rebuilding the SQLite Index
The SQLite index (`.agent-memory/index.db`) is strictly a read accelerator and rebuildable cache. To rebuild the index at any time:

1. Stop the MCP server and dashboard bridge:
   ```bash
   # Ensure no active processes are holding index.db
   ```
2. Remove the existing index file:
   ```bash
   rm .agent-memory/index.db
   # On Windows PowerShell:
   Remove-Item .agent-memory/index.db -Force
   ```
3. Restart `CoMemor`. On startup, `MemoryService` detects the missing `index.db`, re-creates the schema tables (`records`, `meta`), and automatically re-indexes every valid record from `.agent-memory/records.jsonl`.

---

## 3. Handling Corrupted JSONL Lines

If a previous process terminated mid-write (e.g. system power cutoff), `records.jsonl` might contain a truncated trailing line:

1. On startup or when querying, `JsonlStorage.readAll()` parses each line individually inside a `try/catch` block.
2. Any malformed line is logged to `stderr` with event `jsonl_corrupted_line` (including file name, line number, and a preview of the corrupted line).
3. The server safely skips the corrupted line and loads all remaining valid records into the SQLite index.
4. To clean up the corrupted line permanently:
   - Open `.agent-memory/records.jsonl` in an editor.
   - Inspect the line indicated by the `jsonl_corrupted_line` log entry.
   - Remove or fix the truncated JSON record.
   - Delete `.agent-memory/index.db` to trigger an index rebuild.

---

## 4. MCP Host Configuration Migration

Host configurations must target MCP version `2026-07-28`.

### Claude Desktop / Gemini CLI Config
Replace any legacy server launch arguments with:
```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["<PATH_TO_REPO>/dist/server.js"],
      "env": {
        "AGENT_MEMORY_DIR": "<PATH_TO_WORKSPACE>/.agent-memory",
        "AGENT_MEMORY_REPO": "my-repository"
      }
    }
  }
}
```

Verify that `@modelcontextprotocol/inspector` is updated to `>= 0.14.1` to ensure protection against **CVE-2025-49596**.

---

## 5. Normalizer Version Upgrades

Normalizer rules are versioned (`CURRENT_NORMALIZER_VERSION = 1`). When normalizer logic is updated in future releases:
- The `records` SQLite table records `normalizer_version` per entry.
- Fingerprints are generated as `sha256(normalized_output)`.
- When updating normalizer rules, run a migration script to re-normalize historical outputs from `rawOutputRedacted` and update their fingerprints in `records.jsonl`.
