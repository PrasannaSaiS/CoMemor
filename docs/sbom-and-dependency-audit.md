# SBOM & Dependency Audit Note

> **Document Status:** Released — Version 0.1.0  
> **Auditor:** Senior Security & Supply-Chain Reviewer  
> **Target MCP Specification:** 2026-07-28  

---

## 1. Executive Summary

This document provides the complete Software Bill of Materials (SBOM), dependency vulnerability audit, and supply-chain risk assessment for the `CoMemor` ecosystem, comprising:
1. **`CoMemor`** (MCP server daemon over stdio)
2. **`agent-memory-dashboard-bridge`** (Read-only local bridge API on `127.0.0.1:3737`)
3. **`agent-memory-dashboard-frontend`** (Static React/Vite dashboard client)

All dependencies have been pinned to exact or minimum safe versions. A dedicated audit was conducted for disclosed vulnerabilities in MCP tooling, notably **CVE-2025-49596**.

---

## 2. MCP Inspector Security Audit (CVE-2025-49596)

### 2.1 Vulnerability Overview
* **CVE Identifier:** CVE-2025-49596
* **Severity:** Critical (CVSS 9.4)
* **Vulnerability Type:** Missing Authentication for Critical Function (CWE-306) / DNS Rebinding RCE
* **Affected Package:** `@modelcontextprotocol/inspector` versions `< 0.14.1`
* **Vulnerability Description:**
  In unpatched versions of `@modelcontextprotocol/inspector`, the local proxy process lacked authentication and CSRF/origin validation. An attacker executing malicious web content in a developer's browser could perform a DNS rebinding attack or cross-origin request to `localhost`, issuing arbitrary MCP commands to execute host processes over `stdio` with user privileges.

### 2.2 Mitigation & Pinned Version
* **Pinned Version:** `@modelcontextprotocol/inspector` **`0.14.1`** (in `package.json` devDependencies).
* **Patch Verification:** Version 0.14.1 incorporates mandatory per-session bearer tokens, strict HTTP `Origin`/`Host` header validation, and binds exclusively to `127.0.0.1` rather than wildcard interfaces.
* **Server-Side Isolation:** The `CoMemor` server itself only accepts input via `process.stdin` and enforces strict Zod schema validation on every tool call, rendering unauthenticated external injection impossible through stdio.

---

## 3. Dependency Inventory & Supply Chain Analysis

### 3.1 Core Server (`CoMemor`)

| Package | Version | Type | License | Justification & Risk Review |
| :--- | :--- | :--- | :--- | :--- |
| `@modelcontextprotocol/sdk` | `1.17.0` | Production | MIT | Official MCP TypeScript SDK targeting 2026-07-28 spec. Implements JSON-RPC 2.0 stdio framing. |
| `pino` | `9.7.0` | Production | MIT | Low-overhead structured JSON logging. Configured strictly with `destination: process.stderr` to prevent JSON-RPC stdout pollution. |
| `uuid` | `11.1.0` | Production | MIT | Generates cryptographically secure RFC 4122 UUIDv4 identifiers for records and approvals. |
| `zod` | `3.25.67` | Production | MIT | Runtime input validation. Ensures all incoming tool payloads strictly conform to input schemas before reaching memory logic. |
| `node:sqlite` | Built-in | Node Core | Node.js | Native SQLite engine available in Node `>=22.5.0`. Zero C++ native build toolchain dependencies (no `node-gyp` supply-chain risk). |

### 3.2 Dashboard Bridge (`dashboard/bridge`)

| Package | Version | Type | License | Justification & Risk Review |
| :--- | :--- | :--- | :--- | :--- |
| `fastify` | `5.4.0` | Production | MIT | High-performance local HTTP server. Bound strictly to `127.0.0.1`. |
| `@fastify/cors` | `11.0.1` | Production | MIT | Restricts Cross-Origin requests to the local Vite dashboard dev server origin. |
| `@fastify/static` | `8.1.1` | Production | MIT | Serves built static dashboard assets without directory traversal. |
| `node:sqlite` | Built-in | Node Core | Node.js | Opened in `readOnly: true` mode. Hard-rejects any SQL write attempts. |

### 3.3 Dashboard Frontend (`dashboard/frontend`)

| Package | Version | Type | License | Justification & Risk Review |
| :--- | :--- | :--- | :--- | :--- |
| `react` / `react-dom` | `19.1.0` | Production | MIT | Modern UI rendering library. |
| `recharts` | `2.15.3` | Production | MIT | Visualizes benchmark latency, Wilson confidence bounds, and match distributions. |
| `tailwindcss` | `3.4.17` | Build | MIT | Utility-first CSS styling engine. |
| `vite` | `^6.4.3` | Build | MIT | Fast frontend bundler and dev server. |

---

## 4. Architectural Security Invariants

1. **Stdio Protocol Channel Separation:**
   - ESLint rule `no-console: "error"` is enforced across `src/**/*.ts`.
   - `process.stdout.write` is solely utilized by `@modelcontextprotocol/sdk` for JSON-RPC messages.
   - All server diagnostics, error traces, and warnings are written to `process.stderr` or `.agent-memory/logs.jsonl`.
2. **Dashboard Isolation:**
   - The dashboard bridge has zero pipe or socket connection to the MCP server's stdio stream.
   - The SQLite index is opened in read-only mode by the bridge; attempts to execute `INSERT`, `UPDATE`, or `DELETE` throw runtime SQLITE_READONLY errors.
   - The only write capability granted to the bridge is appending human operator decisions to `.agent-memory/approvals-resolved.jsonl`.
3. **No External Network Egress:**
   - Neither the MCP server nor the bridge initiates outbound network connections.
   - All state is strictly local to the repository's `.agent-memory` directory.
