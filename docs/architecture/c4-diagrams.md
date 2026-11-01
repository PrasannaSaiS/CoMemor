# C4 Architecture Diagrams — CoMemor

This document contains standalone, detailed Mermaid C4 diagrams for `CoMemor`.

---

## 1. System Context Diagram (C4 Level 1)

```mermaid
C4Context
  title System Context Diagram — CoMemor

  Person(developer, "Developer", "Interacts with AI coding agents and reviews stored failure-fix records")
  System(mcpHost, "AI Coding Agent / MCP Host", "Drives code generation and invokes MCP tools (Cursor, Claude Desktop, VS Code)")
  
  System_Boundary(b1, "CoMemor System") {
    System(mcpServer, "CoMemor Server", "Stdio MCP server providing memory capture, fingerprinting, retrieval, and verification")
    System(dashboard, "Memory Console UI & Bridge", "Local web dashboard (localhost:4321) for inspecting memory, audit trails, and approvals")
  }

  System_Ext(git, "Git VCS", "Tracks records.jsonl for collective repository knowledge")
  System_Ext(workspace, "Workspace / Filesystem", "The local project codebase and runtime environment")

  Rel(developer, mcpHost, "Issues prompts and approves changes")
  Rel(developer, dashboard, "Views retrieval explainability, approvals queue, security audit")
  Rel(mcpHost, mcpServer, "Invokes tools over stdio (JSON-RPC 2.0)")
  Rel(mcpServer, workspace, "Inspects lockfiles, verifies commands within workspace boundary")
  Rel(mcpServer, git, "Appends to .agent-memory/records.jsonl; reads commit provenance")
  Rel(dashboard, git, "Reads records.jsonl and index.db (read-only); writes approvals-resolved.jsonl")
```

---

## 2. Container Diagram (C4 Level 2)

```mermaid
C4Container
  title Container Diagram — CoMemor

  Person(developer, "Developer")
  Container(host, "MCP Host (LLM Agent)", "TypeScript/Python", "Sends tool call requests via stdio")

  System_Boundary(serverBound, "MCP Server Process (Node.js stdio)") {
    Container(protocol, "MCP Stdio Transport", "@modelcontextprotocol/sdk", "Framing and JSON-RPC message dispatch")
    Container(service, "Application Orchestrator", "TypeScript", "Coordinates normalizer, store, and verifier")
    Container(pipeline, "Processing Pipeline", "TypeScript", "Redaction (Tier 1+2), Normalization, Fingerprinting (SHA-256)")
    Container(store, "Storage Engine", "TypeScript / node:sqlite / fs", "JSONL append-only log + SQLite rebuildable FTS5 index")
    Container(policy, "Command Policy Engine", "TypeScript", "Command whitelist validation, dry-run enforcement, approvals queue")
  }

  System_Boundary(dashBound, "Dashboard Process (Node.js localhost:4321)") {
    Container(bridge, "Dashboard Fastify Bridge", "Fastify / TypeScript", "Read-only SQLite query service and SSE log streamer")
    Container(webApp, "Memory Console UI", "React / Vite / Tailwind", "Visual interface for memory, approvals, and benchmarks")
  }

  Rel(host, protocol, "JSON-RPC via stdin/stdout")
  Rel(protocol, service, "Dispatches find_fix, record_failure, verify_fix, list_memory_stats")
  Rel(service, pipeline, "Passes raw errors for redaction and normalization")
  Rel(service, store, "Reads/writes records and queries SQLite index")
  Rel(service, policy, "Validates execution requests before running or queueing")
  Rel(bridge, store, "Reads records.jsonl, index.db (ro), tails logs.jsonl")
  Rel(webApp, bridge, "HTTP REST & SSE")
  Rel(developer, webApp, "Interacts via browser")
```

---

## 3. Component Diagram: MCP Server (C4 Level 3)

```mermaid
C4Component
  title Component Diagram — MCP Server Internals

  Container_Boundary(mcpCore, "MCP Server Internal Components") {
    Component(toolHandler, "Tool Handlers", "TypeScript", "recordFailure, findFix, verifyFix, memoryStats")
    Component(redactor, "Redaction Service", "TypeScript", "Regex catalog + Shannon entropy analyzer")
    Component(normalizer, "Normalizer", "TypeScript", "Path scrub, volatile token replacement, unicode normalization")
    Component(fingerprinter, "Fingerprinter", "Node crypto", "SHA-256 canonical hashing of normalized trace")
    Component(retriever, "Retriever", "node:sqlite", "Exact fingerprint match + FTS5 BM25 fallback ranking")
    Component(poisonScanner, "Poisoning Scanner", "TypeScript", "Heuristic scanning for prompt injection and structural escaping")
    Component(jsonlStorage, "JSONL Storage", "Node fs", "Atomic append-only writer with lockfile")
    Component(sqliteIndex, "SQLite Indexer", "node:sqlite", "FTS5 table manager, index rebuild routines")
    Component(verifierComp, "Execution Verifier", "Node child_process", "Sandboxed execution runner adhering to command policy")
  }

  Rel(toolHandler, redactor, "Scrub secrets from raw output")
  Rel(redactor, normalizer, "Feed clean string to normalizer")
  Rel(normalizer, fingerprinter, "Generate deterministic hash")
  Rel(toolHandler, poisonScanner, "Audit fix explanations & outputs")
  Rel(toolHandler, retriever, "Query exact & fuzzy matches")
  Rel(retriever, sqliteIndex, "Execute parameterized SQL / FTS5 queries")
  Rel(toolHandler, jsonlStorage, "Append MemoryRecord")
  Rel(jsonlStorage, sqliteIndex, "Sync index entries")
  Rel(toolHandler, verifierComp, "Execute dry-run or approved verification")
```

---

## 4. Deployment / Process Diagram

```mermaid
graph TD
  subgraph Developer Machine
    subgraph Process: MCP Host IDE
      IDE[Cursor / Claude Desktop]
    end

    subgraph Process: MCP Server Node.js
      direction TB
      StdioIn[stdin] --> ServerCore[MCP Server Core]
      ServerCore --> StdioOut[stdout]
      ServerCore --> StderrLog[stderr - Pino logs]
    end

    subgraph Process: Memory Console Node.js
      Bridge[Dashboard Bridge :4321]
      Static[Static React Frontend]
    end

    subgraph Filesystem: .agent-memory/
      JSONL[(records.jsonl<br/>Source of Truth)]
      DB[(index.db<br/>Rebuildable SQLite)]
      LOGS[(logs.jsonl<br/>Audit Log)]
      APP_PEND[(approvals-pending.jsonl)]
      APP_RES[(approvals-resolved.jsonl)]
    end
  end

  IDE <==>|stdio JSON-RPC| Process: MCP Server Node.js
  ServerCore -->|Append| JSONL
  ServerCore <-->|Read / Write| DB
  ServerCore -->|Append| LOGS
  ServerCore <-->|Queue / Read| APP_PEND
  ServerCore -->|Read Approval| APP_RES

  Bridge -.->|Read Only| JSONL
  Bridge -.->|Read Only| DB
  Bridge -.->|Tail| LOGS
  Bridge -.->|Read| APP_PEND
  Bridge -->|Write Approval| APP_RES

  Bridge --- Static
```
