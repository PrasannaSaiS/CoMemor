# .agent-memory

This directory is the runtime data directory for the `CoMemor` server.

## Files

| File | Description |
|---|---|
| `records.jsonl` | **Source of truth.** Append-only. Never edit manually; use the MCP tools. |
| `schema-version` | Current integer schema version. Increment triggers index rebuild. |
| `logs.jsonl` | Structured JSON log stream (stderr mirror). **Not committed.** |
| `pending-approvals.jsonl` | Verify-fix dry-run plans awaiting human approval. **Not committed.** |
| `approvals-resolved.jsonl` | Operator approve/deny decisions written by the dashboard. **Not committed.** |
| `*.db` | Disposable SQLite index. Rebuilt from `records.jsonl` on startup. **Not committed.** |

## Privacy and data handling

- Secrets are redacted before any record is persisted. Never commit `.env`, credentials, or token values.
- `records.jsonl` is git-tracked by design (team knowledge sharing); review diffs before committing.
- `logs.jsonl`, `pending-approvals.jsonl`, and `approvals-resolved.jsonl` are gitignored — they contain transient runtime state.
- To delete a record: use the deletion command (to be documented in `docs/operations/`) — do not edit `records.jsonl` manually, as this can corrupt the index.

## Index rebuild

```bash
node dist/scripts/rebuild-index.js
```

The index is always rebuildable. If it is missing or corrupt, delete the `.db` file and restart the server.
