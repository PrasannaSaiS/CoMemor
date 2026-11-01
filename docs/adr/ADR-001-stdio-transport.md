# ADR-001: Transport — stdio JSON-RPC vs HTTP (MCP spec 2026-07-28)

**Status:** Accepted
**Date:** 2026-09-10
**Deciders:** Project team
**Spec reference:** https://modelcontextprotocol.io/specification/2026-07-28

---

## Context

The MCP specification 2026-07-28 introduced a materially updated protocol surface compared to the November-2025 baseline used in earlier planning documents. Key changes relevant to transport selection:

1. **Stateless protocol core** — the spec now explicitly models a stateless request/response core, making HTTP a natural fit for hosted/multi-client deployments.
2. **Header-based routing** — session and correlation IDs are carried in headers, enabling reverse-proxy and load-balancer topologies.
3. **Multi round-trip requests** — some tool interactions may span multiple JSON-RPC exchanges.
4. **Authorization hardening** — the 2026-07-28 spec introduces issuer validation, issuer-bound client credentials, and Client ID Metadata Documents (CIMD). These are designed primarily for OAuth-enabled, network-accessible server deployments.
5. **Cacheable list results** — `list_tools`, `list_resources`, `list_prompts` results are now cacheable; clients signal capability.

The spec still supports stdio transport as a first-class, officially-maintained option for local process communication.

## Decision

**Use stdio JSON-RPC transport.**

### Rationale

CoMemor is a **local, single-developer (or single-team) tool** run as a subprocess of a local MCP host. Evaluating each 2026-07-28 change:

| 2026-07-28 change | Impact on this project |
|---|---|
| Stateless protocol core | No impact — stdio sessions are already single-client, single-process. The stateless framing is transport-agnostic. |
| Header-based routing | Not needed — no reverse proxies, no multi-client routing. |
| Multi round-trip requests | Compatible with stdio — the SDK handles this transparently. |
| Authorization hardening (issuer, CIMD) | **Out of scope for local tool.** Auth hardening targets hosted, network-accessible servers. Our trust boundary is OS process isolation. Document as future work if ever exposed over HTTP. |
| Cacheable list results | SDK-transparent — no transport change required. |

Additionally:

- stdio gives **zero network attack surface** — no port to bind, no TLS to configure, no SSRF risk.
- stdio is **simpler to test** with MCP Inspector (pin version post-CVE-2025-49596 fix).
- The spec's own build-server guide continues to recommend stdio for local developer tools.
- The dashboard bridge uses a separate HTTP server on localhost only — this is not the MCP transport.

### What we are NOT doing

We are not implementing HTTP/SSE or StreamableHTTP transport. If the project is ever extended to a hosted, multi-user deployment, this ADR must be revisited and the 2026-07-28 authorization model (issuer validation, CIMD, OAuth) implemented in full.

## Consequences

- `src/server.ts` uses `@modelcontextprotocol/sdk` `StdioServerTransport`.
- stdout is **reserved for JSON-RPC only**. ESLint `no-console` rule enforced. Protocol tests assert stdout is valid JSON-RPC.
- All diagnostic logging goes to stderr AND `.agent-memory/logs.jsonl`.
- Multi round-trip support is available via the SDK — no custom framing needed.
- Future HTTP transport requires a new ADR and full 2026-07-28 auth implementation.
