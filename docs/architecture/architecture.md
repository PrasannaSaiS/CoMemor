# Architecture — CoMemor

**Version:** 0.1 (Phase 1 scaffold)
**Date:** 2026-09-10
**Spec target:** MCP 2026-07-28
**Status:** Authoritative — update via ADR before changing structural decisions

---

## 1. System Context (C4 Level 1)

```mermaid
C4Context
  title System Context — CoMemor

  Person(dev, "Developer / Operator", "Uses an AI coding agent (Cursor, Claude Desktop, etc.) to diagnose and fix build/test failures in a local repository.")

  System(agent, "AI Coding Agent (MCP Host)", "Drives the development workflow. Calls MCP tools to record failures and retrieve fixes.")

  System_Boundary(memSys, "CoMemor System") {
    System(mcpServer, "MCP Server", "Stdio JSON-RPC server. Records failures, retrieves fixes, verifies commands (dry-run default). Targets MCP spec 2026-07-28.")
    System(dashboard, "Memory Console (Dashboard)", "Separate local Node process. Observability UI for stored records, approval queue, security audit, and benchmark results.")
  }

  System_Ext(git, "Git / VCS", "Tracks records.jsonl as team knowledge. JSONL diffs are human-readable.")
  System_Ext(ci, "CI System", "Runs tests, lint, typecheck, and benchmark smoke test. May call validate-memory script.")

  Rel(dev, agent, "Issues prompts, reviews proposed fixes, grants approval")
  Rel(agent, mcpServer, "JSON-RPC over stdio — record_failure, find_fix, verify_fix, list_memory_stats")
  Rel(dev, dashboard, "Browses records, inspects retrieval scores, approves/denies pending fixes via browser")
  Rel(mcpServer, git, "records.jsonl committed; SQLite index gitignored")
  Rel(ci, mcpServer, "Builds, tests, and optionally runs validate-memory")
  Rel(dashboard, mcpServer, "Reads .agent-memory files (read-only), writes approvals-resolved.jsonl on human decision")
```

---

## 2. Container Diagram (C4 Level 2)

```mermaid
C4Container
  title Container Diagram — CoMemor

  Person(dev, "Developer / Operator")
  System_Ext(agent, "MCP Host / AI Agent")

  System_Boundary(server, "MCP Server Process (stdio)") {
    Container(mcpAdapter, "MCP Adapter", "TypeScript / @modelcontextprotocol/sdk", "Handles JSON-RPC framing, tool dispatch, resource serving. Stdout = protocol only.")
    Container(appService, "Application Service", "TypeScript", "Orchestrates normalizer, retriever, verifier, staleness service, provenance.")
    Container(normalizer, "Normalizer", "TypeScript / Node crypto", "Versioned pipeline: unicode-normalize → redact → replace volatile tokens → fingerprint.")
    Container(retriever, "Retriever", "TypeScript / node:sqlite FTS5", "Exact SHA-256 lookup first; bounded fuzzy (token similarity) fallback with score/threshold.")
    Container(verifier, "Verifier", "TypeScript", "Dry-run default. Approved path requires resolved approvals-resolved.jsonl entry + allowlist + workspace containment.")
    Container(repoAdapter, "Repository Adapter", "TypeScript / node:sqlite / fs", "Atomic JSONL append; node:sqlite index (disposable, rebuildable).")
    Container(logger, "Structured Logger", "pino (stderr + logs.jsonl)", "All logs → stderr AND .agent-memory/logs.jsonl. Never touches stdout.")
  }

  System_Boundary(dash, "Dashboard Process (separate Node process, localhost:4321)") {
    Container(bridge, "Dashboard Bridge", "TypeScript / Fastify", "Read-only HTTP + SSE API. Tails logs.jsonl. Writes approvals-resolved.jsonl on human decision only.")
    Container(frontend, "Memory Console UI", "React / Vite / Recharts", "7 screens: overview, live feed, record browser, retrieval explainability, approval queue, security audit, benchmarks.")
  }

  ContainerDb(jsonl, "records.jsonl", "Append-only JSONL", "Source of truth. Git-tracked. Human-readable diff.")
  ContainerDb(sqlite, "SQLite index (*.db)", "node:sqlite", "Disposable. Gitignored. Rebuilt from JSONL on startup or schema mismatch.")
  ContainerDb(logsJsonl, ".agent-memory/logs.jsonl", "Newline-delimited JSON", "Structured log stream. Gitignored. Tailed by bridge for live activity feed.")
  ContainerDb(approvals, "approvals-resolved.jsonl", "Append-only JSONL", "Written by bridge on human approve/deny. Read by verifier before any execution.")

  Rel(agent, mcpAdapter, "JSON-RPC over stdio (stdout only)")
  Rel(mcpAdapter, appService, "Validated, typed tool calls")
  Rel(appService, normalizer, "Raw error output")
  Rel(appService, retriever, "Fingerprint + normalized text query")
  Rel(appService, verifier, "verify_fix request")
  Rel(appService, repoAdapter, "Read/write records")
  Rel(appService, logger, "Structured log events")
  Rel(repoAdapter, jsonl, "Atomic append")
  Rel(repoAdapter, sqlite, "Index read/write (via node:sqlite)")
  Rel(logger, logsJsonl, "Append JSON log lines")
  Rel(verifier, approvals, "Read resolved decisions before execution")

  Rel(dev, frontend, "Browser — localhost only")
  Rel(frontend, bridge, "HTTP REST + SSE")
  Rel(bridge, sqlite, "Read-only SELECT queries")
  Rel(bridge, logsJsonl, "Tail for live feed")
  Rel(bridge, approvals, "Append on human decision")
```

---

## 3. Component Diagram — MCP Adapter & Application Service (C4 Level 3)

```mermaid
C4Component
  title Component: MCP Adapter + Application Service

  Container_Boundary(adapter, "MCP Adapter") {
    Component(toolRouter, "Tool Router", "SDK StdioTransport", "Receives JSON-RPC requests; validates method names; dispatches to handlers.")
    Component(recordFailureHandler, "record_failure Handler", "Zod schema validation", "Validates input; invokes ApplicationService.recordFailure().")
    Component(findFixHandler, "find_fix Handler", "Zod schema validation", "Validates input; invokes ApplicationService.findFix(); wraps results in untrusted-data envelope.")
    Component(verifyFixHandler, "verify_fix Handler", "Zod schema validation", "Validates input; enforces dry-run default; invokes ApplicationService.verifyFix().")
    Component(statsHandler, "list_memory_stats Handler", "Zod schema validation", "Validates input; invokes ApplicationService.getStats(). Never exposes raw secrets.")
    Component(resourceHandler, "Resource Handler", "memory://records/{id}", "Serves human-readable record provenance. Read-only.")
    Component(promptHandler, "Prompt Handler", "diagnose→query→inspect→propose→verify→record", "Exposes the safe-workflow prompt. Business logic stays in tools.")
  }

  Container_Boundary(appSvc, "Application Service") {
    Component(normPipeline, "Normalization Pipeline", "normalize.ts", "8-stage: unicode → line-endings → size-cap → redact → token-replace → normalize → version-prefix → SHA-256.")
    Component(redactor, "Redactor", "redact.ts — pattern + entropy", "Regex patterns (keys, tokens, DSNs) AND Shannon-entropy scoring. Never pattern-only.")
    Component(fingerprinter, "Fingerprinter", "fingerprint.ts — node:crypto", "sha256(normalizerVersion + NUL + commandClass + NUL + normalizedError). Deterministic.")
    Component(retrieverComp, "Retriever", "match.ts", "1. Exact SHA-256 lookup. 2. Filter: repo + command family + exit code. 3. Bounded fuzzy (token Jaccard ≤ O(n)). Returns score, threshold, matchType.")
    Component(stalenessChecker, "Staleness Checker", "staleness.ts", "Compares current lockfile hashes + runtime version + normalizerVersion. Stale → downgrade + exclude by default.")
    Component(poisoningGuard, "Poisoning Guard", "redact.ts / sanitize.ts", "Detects imperative-language density + injection markers in fix.explanation and rawOutputRedacted. Flags; never silently strips. Wraps output in untrusted-data delimiters.")
    Component(verifierComp, "Verifier", "verifyFix.ts", "Dry-run: returns proposed plan. Approved: checks approvals-resolved.jsonl + allowlist + workspace containment + arg-array (no shell strings) + timeout + output-cap.")
    Component(provenanceSvc, "Provenance Service", "appService.ts", "Captures git commit, author. Wilson-score lower bound over verification outcomes per record.")
  }

  Rel(toolRouter, recordFailureHandler, "dispatch")
  Rel(toolRouter, findFixHandler, "dispatch")
  Rel(toolRouter, verifyFixHandler, "dispatch")
  Rel(toolRouter, statsHandler, "dispatch")
  Rel(recordFailureHandler, normPipeline, "raw error text")
  Rel(normPipeline, redactor, "pre-normalization redaction")
  Rel(normPipeline, fingerprinter, "canonical form")
  Rel(findFixHandler, retrieverComp, "query")
  Rel(retrieverComp, stalenessChecker, "check each candidate")
  Rel(findFixHandler, poisoningGuard, "wrap retrieved records")
  Rel(verifyFixHandler, verifierComp, "execute policy")
  Rel(recordFailureHandler, provenanceSvc, "attach provenance")
```

---

## 4. Data Flow — record_failure

```mermaid
sequenceDiagram
  participant Agent as MCP Host/Agent
  participant Adapter as MCP Adapter
  participant App as Application Service
  participant Norm as Normalizer
  participant Repo as Repository Adapter
  participant Logger as Structured Logger

  Agent->>+Adapter: JSON-RPC record_failure {command, exitCode, stderr, fix, ...}
  Adapter->>Adapter: Zod schema validation (reject on failure → JSON-RPC error)
  Adapter->>+App: recordFailure(validatedInput)
  App->>+Norm: normalize(rawOutput)
  Norm->>Norm: 1. unicode-normalize, line-endings, size-cap
  Norm->>Norm: 2. redact (pattern + entropy) ← BEFORE any persistence
  Norm->>Norm: 3. replace volatile tokens (timestamps, UUIDs, paths, PIDs...)
  Norm->>Norm: 4. fingerprint: sha256(version + NUL + commandClass + NUL + normalized)
  Norm-->>-App: {normalizedOutput, fingerprint, rawOutputRedacted}
  App->>App: capture environment (os, node, lockfile hashes)
  App->>App: capture provenance (git commit, author)
  App->>+Repo: appendRecord(record) — atomic temp→rename
  Repo->>Repo: write to .agent-memory/records.jsonl
  Repo->>Repo: upsert SQLite index
  Repo-->>-App: {recordId}
  App->>Logger: log {event:"record_failure", recordId, fingerprint} → stderr + logs.jsonl
  App-->>-Adapter: {recordId, fingerprint}
  Adapter-->>-Agent: JSON-RPC response {recordId, fingerprint}
```

---

## 5. Data Flow — find_fix

```mermaid
sequenceDiagram
  participant Agent as MCP Host/Agent
  participant Adapter as MCP Adapter
  participant App as Application Service
  participant Retriever as Retriever
  participant Staleness as Staleness Checker
  participant Poison as Poisoning Guard

  Agent->>+Adapter: JSON-RPC find_fix {stderr, command?, limit?, allowStale?}
  Adapter->>Adapter: Zod validation
  Adapter->>+App: findFix(query)
  App->>+Retriever: query(fingerprint, normalizedText)
  Retriever->>Retriever: 1. Exact SHA-256 lookup in SQLite
  Retriever->>Retriever: 2. If no exact: filter by repo + commandFamily + exitCode
  Retriever->>Retriever: 3. Bounded fuzzy scoring (Jaccard token sim, threshold enforced)
  Retriever-->>-App: candidates[] with {score, threshold, matchType}
  App->>+Staleness: checkStale(candidate, currentEnv)
  Staleness->>Staleness: compare lockfile hashes, normalizerVersion, TTL, verificationStatus
  Staleness-->>-App: {isStale, reasons[]}
  App->>App: exclude stale unless allowStale=true; downgrade rank
  App->>+Poison: wrapUntrusted(candidate.fix.explanation, candidate.rawOutputRedacted)
  Poison->>Poison: check poisoning flag; wrap in delimiters
  Poison-->>-App: wrappedRecord
  App->>App: assemble result with advisory warning
  App-->>-Adapter: ranked candidates with scores, stale reasons, provenance, warning
  Adapter-->>-Agent: JSON-RPC response
  Note over Agent: Agent MUST treat results as advice, not authorization
```

---

## 6. Approval Flow — verify_fix

```mermaid
sequenceDiagram
  participant Dev as Developer (browser)
  participant UI as Memory Console UI
  participant Bridge as Dashboard Bridge
  participant ApprovalsFile as approvals-resolved.jsonl
  participant App as Application Service
  participant Verifier as Verifier

  Agent->>App: verify_fix {recordId, mode:"dry-run"}
  App->>Verifier: dryRun(record)
  Verifier->>Verifier: assemble proposed execution plan (no execution)
  Verifier-->>App: {plan, riskLevel, proposedCommands}
  App->>PendingFile: append to pending-approvals.jsonl
  App-->>Agent: {plan, status:"awaiting-approval", pendingId}

  Dev->>UI: views Approval Queue (Screen 3.5)
  UI->>Bridge: GET /api/pending-approvals
  Bridge-->>UI: [{pendingId, plan, riskLevel, ...}]
  Dev->>UI: clicks Approve
  UI->>Bridge: POST /api/approvals/:id/decision {decision:"approved"}
  Bridge->>ApprovalsFile: append {pendingId, decision:"approved", operatorId, timestamp}

  Agent->>App: verify_fix {recordId, mode:"approved"}
  App->>Verifier: executeApproved(record)
  Verifier->>ApprovalsFile: read — verify resolved entry exists
  Verifier->>Verifier: check allowlist, workspace containment, no shell strings
  Verifier->>Verifier: execute via child_process.execFile (arg array, NOT shell)
  Verifier->>Verifier: enforce timeout + output cap + cancellation
  Verifier-->>App: {exitCode, stdout, stderr} (redacted)
  App-->>Agent: verification result
```

---

## 7. Key Design Decisions (summary — see ADRs for rationale)

| Decision | Choice | ADR |
|---|---|---|
| Transport | stdio JSON-RPC | ADR-001 |
| Source of truth | Append-only JSONL | ADR-002 |
| Index | node:sqlite (built-in, no native build) | ADR-003 |
| Normalization versioning | Integer version embedded in fingerprint | ADR-004 |
| Redaction strategy | Pattern + entropy (layered) | ADR-005 |
| Command execution | Allowlist + arg array + approval gate | ADR-006 |
| MCP spec version | 2026-07-28 | ADR-007 |
| Dashboard separation | Separate process, no shared stdio | ADR-008 |
| Retrieval poisoning | Sanitization envelope + heuristic flags | ADR-009 |

---

## 8. Failure Mode Analysis

| Failure | Detection | Recovery |
|---|---|---|
| Malformed JSONL line | Parser skips line + logs error | Repair script (docs/operations/repair-jsonl.md); index rebuilt from valid lines |
| Interrupted JSONL write | Atomic temp→rename; incomplete temp file left | On startup: detect incomplete temp file, discard, log |
| SQLite index corrupt/missing | Startup integrity check | Delete *.db, restart — index rebuilt from JSONL |
| Concurrent writers (POSIX) | fs.open with O_APPEND + advisory flock | Documented; see ADR-002 for Windows caveat |
| stdout contamination | ESLint no-console rule; protocol tests assert stdout is valid JSON-RPC | CI fails if stdout contains non-JSON-RPC bytes |
| Secret in record | Pre-persistence redaction required; security test suite | Redaction recall tests on adversarial corpus (Phase 3) |
| Poisoned record retrieved | Poisoning guard wraps content; flag raised | Dashboard Security Audit screen (3.6); excluded from retrieval if confirmed |
