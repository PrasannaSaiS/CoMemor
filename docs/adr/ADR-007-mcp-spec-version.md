# ADR-007: MCP Specification Version Target

**Status:** Accepted  
**Date:** 2026-09-10  
**Deciders:** Project team

## Context

The original project plan and implementation kit were authored against an MCP baseline that predates the current specification. The audit addendum (§2, issue #7) identifies this as a High-severity risk because the 2026-07-28 specification introduced materially different protocol surfaces (stateless protocol core, multi round-trip requests, header-based routing, cacheable list results, and authorization hardening).

## Decision

**Target: MCP specification version 2026-07-28.**

- Source: https://modelcontextprotocol.io/specification/2026-07-28
- SDK: `@modelcontextprotocol/sdk` pinned to `1.17.0` (verify this release targets spec 2026-07-28 before Phase 1 implementation begins).

Before beginning Phase 1 implementation, re-verify SDK release notes confirm compatibility with spec 2026-07-28. Update this ADR with the verification result.

## Verification Result (2026-11-08)

During Prompt 0/Prompt 1 audit verification:
- `@modelcontextprotocol/sdk` is pinned to `1.32.2` to resolve 8 security advisories (GHSA-345p-7cg4-v4c7, GHSA-w48q-cv73-mx4w, GHSA-8r9q-7v3j-jr4g, GHSA-6qxp-vccf-f47h, GHSA-46jr-4wx8-v453, GHSA-rvq5-wwqv-78pq, GHSA-f897-62hf-6gxq, GHSA-6prh-2h8m-c8cw).
- SDK 1.32.2 implements the MCP 1.x specification (protocol version `2024-11-05`). It does NOT implement the 2026-07-28 specification (which requires SDK v2+).
- **Decision:** Target MCP specification supported by SDK 1.32.2 (`2024-11-05` / 1.x). The SDK v2 / spec 2026-07-28 migration is decoupled from security hardening and tracked as a separate future milestone.

## Consequences

- All transport, authorization, and tool-schema assumptions derive from SDK 1.x baseline.
- Future migration to SDK v2+ and spec 2026-07-28 will be planned in an ADR once SDK v2 reaches production stability.
- MCP Inspector used during development must be a version released after CVE-2025-49596 fix. Pin the exact version in the dev-dependency policy.
