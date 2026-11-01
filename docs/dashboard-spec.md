# Agent Memory MCP — Dashboard Specification

**Purpose:** Defines the observability/demo layer for the project. This is the artifact your faculty will actually look at, so it is treated as a first-class deliverable, not a UI afterthought. Feed this to your coding agent as Phase 6 context (see `03-agentic-build-prompts.md`).

**Prepared:** 8 September 2026

---

## 1. Why two tiers, not one

A backend-only MCP server is invisible in a demo — a reviewer sees a terminal and JSON-RPC traffic they can't parse in real time. But building a full custom UI for *protocol-level* testing (raw tool calls, schema validation, request/response inspection) duplicates a tool that already exists and is officially maintained. So:

- **Tier 1 — MCP Inspector** (official, free, already built) does protocol-level testing. Use it during development and as a "yes, this is a real conformant MCP server" demo moment. Zero engineering cost to you beyond pinning a patched version (a critical RCE, CVE-2025-49596, was previously disclosed against Inspector — pin a version released after the fix and note this in your dependency-audit doc).
- **Tier 2 — a small custom "Memory Console"** is what you actually build. It is *not* a protocol tester; it is a product-observability dashboard showing what the memory system is doing over time: what's stored, why a fix was or wasn't retrieved, staleness, the approval workflow, security-audit results, and your benchmark charts. This is your differentiator and the thing that makes the evaluation chapter visually legible in five minutes.

Don't try to make Tier 2 replace Tier 1. Use Inspector for "does this tool call work correctly," and Memory Console for "what does this system know, and can I trust it."

---

## 2. Hard architectural constraint

**The dashboard must never share a process, stdin/stdout, or in-memory state with the MCP stdio server.** The implementation kit is correct that stdout must carry JSON-RPC only — a dashboard bolted onto the same process risks violating that the moment someone adds a `console.log` for a UI feature. Keep them structurally separate:

```text
MCP host/agent
   | JSON-RPC over stdio (stdout = protocol only)
   v
CoMemor server (unchanged)
   +-- writes: .agent-memory/records.jsonl (source of truth)
   +-- writes: structured JSON logs to stderr AND to a local logs.jsonl file
   +-- writes: .agent-memory/pending-approvals.jsonl (verify_fix queue)
   +-- reads:  .agent-memory/approvals-resolved.jsonl (dashboard writes here)

dashboard-bridge (separate Node process, read-mostly, localhost-only)
   +-- reads:  SQLite index (read-only connection)
   +-- tails:  .agent-memory/logs.jsonl (for live activity feed)
   +-- reads:  benchmark output CSV/JSON from Phase 6 evaluation runs
   +-- exposes: local HTTP + SSE/WebSocket API to the frontend
   +-- writes: .agent-memory/approvals-resolved.jsonl ONLY when a human clicks Approve/Deny

dashboard-frontend (React/Vite, talks only to dashboard-bridge)
```

The approval flow is the one place the dashboard writes anything back: a human clicking "Approve" in the UI appends a record to `approvals-resolved.jsonl`, which the MCP server polls before ever executing a verified fix. **The dashboard itself never executes commands.** This preserves the "no command executes without explicit approval and policy checks" invariant from the original threat model — the dashboard is a human-approval surface, not an execution surface.

---

## 3. Screens

### 3.1 Overview
Record count, index status (fresh/rebuilding), age distribution histogram, overall success rate (Wilson-score lower bound, not raw percentage), count of stale records, count of records flagged by the poisoning heuristic. This is `list_memory_stats` visualized.

### 3.2 Live Activity Feed
A scrolling, real-time (SSE/WebSocket) log of tool calls as they happen during a demo: `record_failure` called → normalized → fingerprinted → appended; `find_fix` called → candidates scored → returned. This is the single most important screen for a live demo — it turns an invisible backend into a visible pipeline.

### 3.3 Record Browser & Detail
Searchable/filterable table of all records (by repository, command family, stale status, verification status). Clicking a record shows: raw vs. normalized text (redacted), fingerprint, environment fingerprint, provenance, verification history, and its `supersedes` chain rendered as a simple linked list ("this fix replaced an earlier one because the lockfile changed").

### 3.4 Retrieval Explainability
For a given `find_fix` query: show each candidate's score as a bar against the acceptance threshold (a horizontal line), the match type (exact/fuzzy), which filters it passed (repository, command family, exit code), and stale-reason badges. This is the screen that makes your "we don't silently turn fuzzy results into known fixes" design decision visible and defensible.

### 3.5 Approval Queue
Pending `verify_fix` dry-run plans awaiting human approval: shows the proposed command(s), the diff/plan, the risk level, and Approve/Deny buttons. This is where your safety story becomes interactive rather than a paragraph in a report.

### 3.6 Security & Redaction Audit
Redaction test-suite pass/fail (recall/precision on the adversarial fixture set from the audit addendum), count of poisoning-heuristic flags raised and their status (reviewed/dismissed/confirmed), and a list of any records currently excluded from retrieval due to a poisoning flag.

### 3.7 Benchmark & Evaluation Results
Once Phase 8 (evaluation) produces CSV/JSON output, render it here: bar charts comparing B0–B3 on time-to-repair, tool calls, success rate, false-reuse rate; a table of retrieval latency p50/p95; ablation results. This turns your dissertation's results chapter into something you can click through live instead of reading off slides.

---

## 4. Tech stack

- **Frontend:** React + Vite, Tailwind for layout, Recharts for the benchmark charts (simple, well-documented, no extra backend needed for chart data — it's just the CSV/JSON you already produce).
- **Bridge:** a small Fastify or Express server, Node, same language as the core project — reads SQLite with `better-sqlite3` in read-only mode, tails `logs.jsonl` with a simple `fs.watch`/`tail`-style reader, exposes:
  - `GET /api/stats`
  - `GET /api/records?filter=...`
  - `GET /api/records/:id`
  - `GET /api/pending-approvals`
  - `POST /api/approvals/:id/decision` (writes to `approvals-resolved.jsonl` only)
  - `GET /api/benchmarks/latest`
  - `GET /api/events` (SSE stream for the live activity feed)
- **Bind to `127.0.0.1` only.** No auth needed for a solo/demo project, but say explicitly in your report that this is a local-only trust boundary and note remote-auth as future work (the current MCP spec's authorization hardening — issuer validation, CIMD — is directly relevant future work to cite here).

---

## 5. Alternatives considered (and why not)

| Option | Why not chosen |
|---|---|
| Grafana + SQLite datasource | Fast to stand up but reads as "I plugged in a monitoring tool," not "I built a system" — weaker demo value for a final-year project, and the approval-workflow screen doesn't fit Grafana's model at all. |
| Retool / low-code admin panel | Same issue — faculty want to see engineering, and it doesn't cleanly support the SSE live-feed or the retrieval-explainability visualization. |
| MCP Inspector only, no custom dashboard | Inspector shows protocol calls, not your system's actual decisions (staleness, scoring, poisoning flags, benchmark results) — it can't carry your evaluation chapter. |
| Embedding the dashboard in the MCP server process itself | Violates the stdout-is-JSON-RPC-only invariant the first time anyone adds UI-driven logging; also couples two things that should fail independently. |

---

## 6. Build phase mapping

Build this as **Phase 6** in the revised phase list (after retrieval and staleness/verification exist, so there's real data to show; before the evaluation harness, so Phase 8's benchmark results have somewhere to render). See `03-agentic-build-prompts.md` for the exact prompt.
