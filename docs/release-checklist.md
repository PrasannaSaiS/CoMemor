# Release Checklist — Version 0.1.0

> **Document Status:** Released  
> **Release Target:** `v0.1.0` Production Release  
> **Date:** September 2026  

---

## 1. Quality Gates & Verification Matrix

Before tagging and releasing any version of `CoMemor`, every item in the following quality gate matrix MUST pass.

| Gate | Verification Command | Required Outcome | Status |
| :--- | :--- | :--- | :--- |
| **Root Typecheck** | `npm run typecheck` | 0 errors (`tsc -p tsconfig.test.json --noEmit`) | ✅ PASSED |
| **Root Linter** | `npm run lint` | 0 errors, 0 warnings (`eslint src tests`) | ✅ PASSED |
| **Root Formatting** | `npm run format:check` | All files match Prettier code style | ✅ PASSED |
| **Test Suite** | `npm run test` | 16 test files passed, 132 tests passed | ✅ PASSED |
| **Code Coverage** | `npm run test:coverage` | `>= 80%` lines, statements, functions (Achieved: 86.51% lines, 86.27% funcs) | ✅ PASSED |
| **Deterministic Benchmark** | `npm run benchmark:run` | 100% repair success on B2/B3; Wilcoxon $p < 0.05$ vs B0 | ✅ PASSED |
| **Bridge Typecheck** | `cd dashboard/bridge && npm run typecheck` | 0 errors | ✅ PASSED |
| **Bridge Linter** | `cd dashboard/bridge && npm run lint` | 0 errors | ✅ PASSED |
| **Bridge Formatting** | `cd dashboard/bridge && npm run format:check` | All files match Prettier code style | ✅ PASSED |
| **Frontend Typecheck** | `cd dashboard/frontend && npm run typecheck` | 0 errors | ✅ PASSED |
| **Frontend Linter** | `cd dashboard/frontend && npm run lint` | 0 errors | ✅ PASSED |
| **Frontend Formatting** | `cd dashboard/frontend && npm run format:check` | All files match Prettier code style | ✅ PASSED |
| **Frontend Build** | `cd dashboard/frontend && npm run build` | Production bundle compiled without errors | ✅ PASSED |
| **Packaging Test** | `npm pack --dry-run` (all 3 pkgs) | Clean tarball generation with no missing runtime files | ✅ PASSED |

---

## 2. Security & Supply-Chain Checklist

- [x] **CVE-2025-49596 Mitigated:** `@modelcontextprotocol/inspector` pinned to `0.14.1` (version >= 0.14.1 required for RCE fix). Documented in `docs/sbom-and-dependency-audit.md`.
- [x] **Stdio Protocol Safety Invariant:** No component writes un-framed data to `process.stdout`. Pino logger is routed to `process.stderr` and `logs.jsonl`. ESLint rule `no-console: "error"` enforced across `src/`.
- [x] **Dashboard Process Isolation:** Bridge runs on `127.0.0.1` only. Bridge SQLite connection is read-only (`readOnly: true`). Write capability is restricted solely to appending to `approvals-resolved.jsonl`. Tested in `tests/security/dashboard-isolation.test.ts`.
- [x] **Adversarial & Poisoning Defenses:** 44 tests in `tests/security/poisoning-corpus.test.ts` prove all planted injection payloads (imperative instructions, zero-width spaces, Cyrillic/Greek homoglyphs, delimiter breakouts) are neutralized by the sanitization envelope or quarantined.
- [x] **Command Policy Enforcement:** High-risk commands cannot execute without explicit human approval records. Dry-run verification mode is default. Tested in `tests/security/command-policy.test.ts`.
- [x] **Windows & POSIX Concurrency Verified:** Verified atomic append handling and resilience against corrupted JSONL lines. Tested in `tests/unit/storage.test.ts`.

---

## 3. Documentation Checklist

- [x] **Architecture & ADRs:** ADRs 001 through 009 finalized.
- [x] **Threat Model & Boundaries:** `docs/threat-model.md` and `docs/limitations.md` clearly specify what defenses cover and what they do not cover (cognitive LLM compliance, semantic logic bugs, compromised git provenance).
- [x] **Statistical Limitations:** Small-N ($N=6$) statistical caveats documented for the Wilcoxon signed-rank evaluation.
- [x] **Migration Guide:** `docs/operations/migration-guide.md` provides index rebuild instructions and schema versioning policy.
- [x] **Host Configuration:** Tested configuration examples documented in `docs/mcp-host-config.md`.

---

## 4. Release Steps

1. Commit all finalized files and ensure git working tree is clean.
2. Tag release commit:
   ```bash
   git tag -s v0.1.0 -m "Release v0.1.0: CoMemor"
   ```
3. Build all packages:
   ```bash
   npm run build
   cd dashboard/bridge && npm run build
   cd ../frontend && npm run build
   ```
4. Verify npm packages:
   ```bash
   npm pack --dry-run
   ```
5. Deploy or publish package artifacts according to organizational registry policy.
