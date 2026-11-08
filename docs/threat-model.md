# Threat Model — CoMemor

**Version:** 1.0  
**Date:** 2026-09-10  
**Status:** Authoritative  
**Methodology:** STRIDE-per-Element & OWASP Top 10 for LLM Applications (2025/2026)  

---

## 1. System Boundary & Assets

### System Boundary
- **Inside Boundary:**
  - MCP Server process running via `stdio` (JSON-RPC).
  - Memory persistence directory `.agent-memory/` (`records.jsonl`, `index.db`, `logs.jsonl`, `approvals-*.jsonl`).
  - Redaction, normalization, fingerprinting, and retrieval scoring engines.
  - Dashboard Bridge & Web Console (`localhost:4321`, separate Node process).
- **Outside Boundary:**
  - MCP Host (Cursor, Claude Desktop, VS Code extension).
  - External Git repository and remotes.
  - Operating system shell and package registries (NPM, PyPI, Cargo).

### Critical Assets
1. **Developer Workstation Security:** Integrity of local filesystem, processes, and network.
2. **Secrets & Credentials:** API keys, cloud tokens, personal access tokens (PATs), SSH keys.
3. **Memory Store Integrity:** `records.jsonl` correctness, non-tampering, absence of malicious injection payloads.
4. **Agent Context Integrity:** Preventing prompt injection or malicious instructions from hijacking the host LLM.

---

## 2. Threat Actors & Attack Vectors

| Actor | Capability / Motivation | Attack Vector |
| :--- | :--- | :--- |
| **Malicious Package / Dependency** | Injects malicious output into stdout/stderr during build/test scripts. | Error output poisoning stored in `records.jsonl`. |
| **Untrusted Repository Contributor** | PR author modifying `.agent-memory/records.jsonl` or committing poisoned memory. | Injected malicious commands or prompt injection in `fix.explanation`. |
| **Compromised MCP Client / Tool** | Rogue extension or prompt-injected LLM calling MCP tools maliciously. | Excessive data exfiltration via `find_fix`, arbitrary command execution via `verify_fix`. |
| **Local Network Attacker** | Attacker on local network attempting to probe local services. | Probing dashboard bridge port (mitigated by localhost-only binding and read-only IPC). |

---

## 3. STRIDE Analysis & Mitigations

### 3.1 Spoofing (S)
- **Threat:** Malicious process impersonates the MCP server or tampers with records attributed to another developer.
- **Mitigation:**
  - Communication is locked to local stdio pipes established by the parent process (MCP host).
  - Provenance tracking records local Git commit hash, Git user signature, and timestamp. Records lacking valid local provenance are assigned lower trust weights.

### 3.2 Tampering (T)
- **Threat:** Direct modification or corruption of `.agent-memory/records.jsonl` or SQLite `index.db`.
- **Mitigation:**
  - Append-only atomic writes with write locks (`records.jsonl`).
  - SQLite database is treated as an ephemeral, rebuildable index (ADR-003). On mismatch or corruption, the index is automatically rebuilt from JSONL.
  - JSON Schema validation on every record before reading and writing.

### 3.3 Repudiation (R)
- **Threat:** Developer denies executing a dangerous remediation command or inserting a broken fix.
- **Mitigation:**
  - Structured, immutable audit trail written to `logs.jsonl`.
  - Approvals workflow logs who approved what command with timestamp and hash in `approvals-resolved.jsonl`.

### 3.4 Information Disclosure (I)
- **Threat:** Storing secrets, passwords, or API keys in `records.jsonl` and returning them via MCP tools or committing them to Git.
- **Mitigation:**
  - Multi-tier synchronous redaction pipeline before any persistence (ADR-005):
    - Layer 1: Pattern regexes for GitHub, AWS, OpenAI, Anthropic, JWT, PEM, connection URIs.
    - Layer 2: Shannon entropy scoring for high-entropy tokens.
  - Standard `.gitignore` templates recommend committing `records.jsonl` only after review, and explicitly ignoring `.agent-memory/*.db`, `logs.jsonl`, and pending approvals.

### 3.5 Denial of Service (D)
- **Threat:** Giant error outputs (e.g. 50MB minified stack trace) causing memory exhaustion or regex catastrophic backtracking (ReDoS).
- **Mitigation:**
  - Max raw output payload cap (e.g. 64KB). Outputs exceeding the cap are truncated before processing.
  - Linear-time / bounded regular expressions; no nested quantifiers.
  - Bounded retrieval queries: SQLite FTS5 queries enforce `LIMIT 10` and strict execution timeouts.

### 3.6 Elevation of Privilege (E)
- **Threat:** An agent executes malicious commands via `verify_fix` or is hijacked via Persisted-Retrieval Poisoning.
- **Mitigation:**
  - In-Process Execution Disabled: CoMemor does not execute remediation commands directly in-process. `verify_fix` acts as an advisory policy validation and risk assessment engine that returns a structured command proposal with required user-confirmation metadata (`requiresHostConfirmation: true`, `executedByServer: false`). Command execution remains strictly with the host IDE/agent under its native approval flow.
  - Command Policy Engine: Prohibits shell metacharacters and chaining, destructive commands, inline code execution flags (`python -c`, `bun -e`), unvetted remote URLs/downloads, and workspace path escapes.
  - Persisted-Retrieval Poisoning Defense (ADR-009): Sanitization envelopes around untrusted outputs, heuristic flagging for prompt injection tokens, and provenance-weighted trust decay.

---

## 4. Security Verification Checklist

- [x] Stdio transport ensures no open network ports for the MCP server core.
- [x] Dashboard bridge binds strictly to `127.0.0.1` and opens SQLite in read-only mode.
- [x] Zero raw outputs logged to stdout (stdio JSON-RPC channel integrity preserved).
- [x] Multi-tier secret redaction runs before fingerprinting or persistence.
- [x] All returned memories wrapped in sanitization XML envelopes.
- [x] Commands restricted to whitelist, and dry-run is required unless explicit human approval is resolved.

---

## 5. Persisted-Retrieval Poisoning Defense & Threat Boundaries (Phase 5)

### 5.1 What This Layer Defends Against
1. **Direct Imperative Prompt Injections:** Known second-person imperative markers (e.g., `ignore previous instructions`, `pretend to be`, `you are now`, `override directives`).
2. **Fake System Delimiters & Markers:** ChatML (`<|im_start|>`), LLaMA (`[INST]`, `<<SYS>>`), Alpaca delimiters (`BeginInstruction`), and pseudo-system notes mimicking LLM system prompts.
3. **Data Exfiltration Signatures:** Explicit keywords and HTTP exfiltration patterns (`curl -X POST`, `exfiltrate`, `send your system prompt to`, `post the conversation context to http://...`).
4. **Obfuscation Attempts:**
   - Zero-width and invisible Unicode characters (`\u200B-\u200F`, `\u2028`, `\uFEFF`, soft hyphens, word-joiners).
   - Unicode homoglyphs from Cyrillic, Greek, or fullwidth ASCII confusables attempting to bypass ASCII pattern matching.
5. **High Imperative-Verb Density:** Explanations with abnormal concentration of imperative action verbs (`execute`, `bypass`, `delete`, `override`) (> 8% density over 20+ words).
6. **Untrusted Data Containment via Sanitization Envelopes:** Wrapping retrieved records in explicit XML boundary tags (`<untrusted_historical_memory>`) with instruction-negation warnings and explicit quarantine tags (`<quarantine_warning>`).
7. **Provenance-Weighted Trust Decay:** Decaying retrieval rank scores when Git commit provenance is missing (0.8x), when poisoning flags are present (0.5x), or when Wilson lower bounds on historical verification outcomes are low.

### 5.2 What This Layer Does NOT Defend Against (Explicit Non-Goals & Limitations)
> [!WARNING]
> This subsystem is an application-level detection heuristic and containment envelope; **it is not, and does not claim to be, a mathematically provable or general prompt-injection defense**.

Specifically, it does NOT defend against:
1. **Novel or Paraphrased Semantic Injections:** Natural-language adversarial framing that does not use recognized keywords, delimiters, or high imperative density (e.g., subtle multi-turn gaslighting, plausible pseudo-technical arguments that mislead an agent into unintended actions).
2. **Context-Dependent Semantic Manipulation:** Legitimate-sounding commands that are subtly malicious in a specific repository environment (e.g., suggesting an innocent-looking `npm install <typosquatted-package>` or altering a configuration flag that weakens security).
3. **Model-Level Tokenizer & Attention Exploits:** Adversarial token sequences designed to disrupt LLM attention mechanisms or trigger unintended tokenizer merge states.
4. **Execution-Level Sandboxing:** The server does NOT execute, sandbox, or isolate runtime processes; safety at execution time relies strictly on host IDE/agent approval mechanisms. CoMemor never treats `shell: false`, binary allowlists, dashboard buttons, or workspace-editable files (`approvals-resolved.jsonl`) as OS-level sandboxes or strong human authorization boundaries. All in-process command execution is disabled.
5. **Protocol Specification:** The server is pinned to `@modelcontextprotocol/sdk@1.32.2` implementing the standard MCP 1.x stream (2024-11-05 baseline).
6. **Pre-Compromised Upstream Repositories:** If the Git repository itself is attacker-controlled, commit provenance checks can be satisfied legitimately by the attacker.
7. **Blind Automated Execution by Consuming Agents:** If a consuming agent ignores the `<untrusted_historical_memory>` warning delimiters and blindly feeds the content directly into an unconstrained system or execution context, the envelope cannot enforce compliance at the LLM level.
