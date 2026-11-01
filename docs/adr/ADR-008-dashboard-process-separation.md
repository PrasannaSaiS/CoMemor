# ADR-008: Dashboard Process Separation — Out-of-Process Observability and Approval Bridge

**Status:** Accepted  
**Date:** 2026-09-10  
**Deciders:** Project team  

---

## Context

The CoMemor system provides a web-based management and inspection dashboard (Memory Console) for reviewing records, inspecting retrieval scores, managing approvals, and viewing audit/benchmark logs.

However:
- The MCP server communicates with its host (e.g. Claude Desktop, Cursor) over `stdio`. Any network listeners, ports, or long-running HTTP server loops within the MCP server process increase attack surface and risk protocol deadlock or stdout corruption.
- Stdio MCP servers should remain lightweight, ephemeral, and strictly protocol-compliant.
- A compromise of the dashboard web application must not compromise the integrity of the MCP server runtime or execute commands with the agent's permissions.

## Decision

The Dashboard and Bridge are implemented as a completely separate Node.js process and package (`dashboard/` directory):

1. **Independent Process Lifecycle:**
   - The dashboard is launched independently by the developer (e.g. `npm run dashboard`) listening on `localhost:4321`.
   - The MCP server has zero dependency on the dashboard running; if the dashboard is closed, the MCP server continues operating normally.

2. **File-Based IPC:**
   - Communication between the dashboard bridge and the MCP server is mediated strictly through files in `.agent-memory/`:
     - Reads: `records.jsonl`, `index.db` (read-only SQLite connection), `logs.jsonl` (streaming tail), `approvals-pending.jsonl`.
     - Writes: `approvals-resolved.jsonl` (atomic append on human approval or rejection).
   - The dashboard bridge has NO network connection or direct socket to the MCP server.

3. **Read-Only Enforcements:**
   - The dashboard bridge opens `index.db` in SQLite `readonly` mode (`mode: 'ro'`).
   - The dashboard bridge cannot modify records or invoke MCP server tools directly.

## Consequences

- **Positive:** Zero risk of dashboard HTTP server output leaking into the MCP stdio channel.
- **Positive:** Principle of least privilege: the dashboard UI is an observer and reviewer, not an execution engine.
- **Negative:** Human approvals require file-based polling or file-watching between the two processes.
