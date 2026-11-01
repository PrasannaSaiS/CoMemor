# Security Policy — CoMemor

## 1. Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported | Notes |
| :--- | :---: | :--- |
| **1.0.x** | ✅ | Current active production release. |
| **< 1.0.0** | ❌ | Development and preview milestones (upgrade to 1.0.x). |

---

## 2. Reporting a Vulnerability

If you believe you have discovered a security vulnerability in `CoMemor`, please do **not** open a public issue. Disclose responsibly through one of the following channels:

* **GitHub Security Advisory:** Submit a private vulnerability report via the [Security Advisories](https://github.com/PrasannaSaiS/CoMemor/security/advisories) tab.
* **Direct Email:** Email the maintainer team at `security@agent-memory.dev` with details, proof-of-concept steps, and environment information.

### Response SLA & Timeline Commitments
* **Initial Acknowledgment:** Within **48 hours** of report receipt.
* **Triage & Reproducibility Assessment:** Within **7 business days**.
* **Remediation & Patch Release:** Within **30 calendar days** for confirmed critical or high-severity vulnerabilities.
* **Public Disclosure:** Coordinated disclosure after patches are released.

---

## 3. Scope & Threat Boundaries

For full technical definitions of security invariants, consult [System Limitations & Threat Boundaries](docs/limitations.md).

### In-Scope Vulnerabilities
1. **Stdout Channel Invariant Violations:** Any behavior where unhandled errors, diagnostic logs, or third-party libraries write to `stdout`, corrupting the MCP JSON-RPC protocol framing.
2. **Command Policy Sandbox Escapes:** Bypassing `CommandPolicyEngine` allowlists, escaping workspace path containment, or unauthorized command execution via `verify_fix`.
3. **Approval Resolution Forgery:** Manipulating `.agent-memory/approvals-resolved.jsonl` or exploiting ID mismatches to execute unapproved live commands.
4. **Dashboard Process Isolation Failures:** Any scenario where the read-only dashboard bridge executes commands, mutates SQLite records directly, or binds to external network interfaces (bridge must strictly bind to `127.0.0.1`).
5. **Secret Redaction Flaws in Standard Credentials:** Failure to redact standard API tokens (AWS, GitHub, OpenAI, Anthropic, private keys, URI credentials) matching supported regex specifications.

### Out-of-Scope Threat Vectors (Design Limitations)
1. **Downstream LLM Cognitive Vulnerabilities:** If an LLM host ignores the `<untrusted_historical_memory>` delimiter tags and voluntarily executes prompt injection payloads contained in historical error records.
2. **Adversarial Secret Segmentation:** Secrets intentionally interleaved with whitespace (`g h p _ ...`) or URL percent-encoded (`%41%42...`) that circumvent contiguous token boundaries (documented in `docs/limitations.md`).
3. **Git Provenance Spoofing:** If an attacker possesses direct commit access to the target repository and forges valid git commits.
4. **Subtle Logic Regressions:** Benign code modifications (e.g. changing timeout values) that contain no imperative trigger words or destructive commands.
