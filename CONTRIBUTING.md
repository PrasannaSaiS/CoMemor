# Contributing to CoMemor

Thank you for your interest in contributing to `CoMemor`! This project provides a repository-scoped, git-synced error-fix memory MCP server adhering to the Model Context Protocol specification.

---

## 1. Prerequisites & Environment Setup

* **Node.js:** Version `>= 22.5.0` is strictly required. The architecture utilizes native `node:sqlite DatabaseSync`, which is available in Node 22.5+.
* **Package Manager:** `npm` (v10+ recommended).
* **Git:** Required for provenance tracking.

```bash
# Clone the repository
git clone https://github.com/PrasannaSaiS/CoMemor.git
cd CoMemor

# Install dependencies
npm install

# Verify build
npm run build
```

---

## 2. Critical Architectural Invariant: Stdio Isolation

> [!IMPORTANT]
> **Zero stdout pollution.**
> The MCP protocol relies on `process.stdout` exclusively for JSON-RPC message framing.
> - **NEVER** use `console.log()` anywhere in server source code.
> - **NEVER** write informational or debug messages to `stdout`.
> - All application logging must be routed through the Pino logger configured in `src/core/logger.ts`, which directs output to `process.stderr` and `.agent-memory/logs.jsonl`.

Any PR that introduces `console.log` or writes raw strings to `stdout` will be rejected by CI.

---

## 3. Development Workflow & Verification Commands

Before opening a pull request, run the unified verification script:

```bash
# Runs typecheck, lint, format check, and all test suites
npm run check
```

Individual commands:
* **Typecheck:** `npm run typecheck`
* **Linting:** `npm run lint` (or `npm run lint:fix`)
* **Formatting:** `npm run format:check` (or `npm run format`)
* **Unit Tests:** `npm run test:unit`
* **Integration Tests:** `npm run test:integration`
* **Security & Poisoning Tests:** `npm run test:security`
* **Full Test Suite:** `npm test`
* **Test Coverage:** `npm run test:coverage`

---

## 4. Pull Request Guidelines

1. **Test Coverage:** Every new feature, bug fix, or security rule must include corresponding unit or integration tests.
2. **Never Weaken Assertions:** Do not weaken test assertions or remove test cases to make CI pass. If a test fails, resolve the root cause.
3. **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `docs:`, `security:`, `test:`).
4. **Documentation:** If modifying schemas, tools, or policy engines, update the corresponding documentation in `docs/` and `CHANGELOG.md`.
