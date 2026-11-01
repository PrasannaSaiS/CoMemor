# Agent Memory MCP — Audit & Research-Strengthening Addendum

**Purpose:** This document supplements `CoMemor-project-plan.md` and `CoMemor-implementation-kit.md`. It records the audit findings, the recommended new research contribution, and a revised risk/scope posture. Feed this file to your coding agent alongside the original two documents at the start of Phase 0.

**Prepared:** 8 September 2026

---

## 1. Verdict

The original plan is implementable and already avoids the weak "CRUD wrapper" version of this idea. It is, however, scoped for more than one semester of solo work, leans on unverified performance/security claims, and — most importantly — is missing the single most defensible novel contribution available to it: **persisted retrieval-channel poisoning**, addressed in §3. Treat this addendum as revising, not replacing, the original scope.

---

## 2. Flaw register

| # | Issue | Evidence / reasoning | Severity | Recommended fix |
|---|---|---|---|---|
| 1 | **Scope realism.** Phases 0–7 plus a full evaluation harness plus hardening is ~20+ person-weeks of focused work. | The plan itself budgets 14 weeks for what is normally a small team's semester. Solo, with coursework overhead, Phases 6–7 are the ones most likely to be cut under time pressure — which are exactly the parts that carry the grade (evaluation, security). | High | Define a **Minimum Defensible Submission (MDS)** checkpoint at week 8: Phases 0–4 plus a basic dashboard, fully tested and documented, submittable as a standalone result if later phases slip. Treat poisoning red-team + full evaluation + hardening as the "distinction tier," not the baseline. |
| 2 | **Redaction is regex-only and self-validated.** | A handful of hand-written secret regexes will miss many real-world key formats. Claiming "100% redaction recall" against a test set you built yourself is circular evidence. | High | Layer pattern-based rules with entropy-based detection (the approach tools like gitleaks/detect-secrets use), and report recall/precision on an *adversarial* fixture corpus you did **not** use while writing the rules. Publish false-negative examples honestly. |
| 3 | **Unverified performance claim.** Target of p95 < 100 ms at 10k records is stated before any benchmark exists, using plain Levenshtein. | Naive edit-distance scoring is O(n·m) per candidate; after repository/command-family filtering this may still be too slow at scale. | Medium | Benchmark at the end of Phase 3, not as a "v2 maybe." Keep SQLite FTS5/BM25 as a ready fallback, and only publish the p95 target after a real measurement, revised if needed. |
| 4 | **Evaluation determinism assumption.** The B0–B3 harness assumes reproducible agent traces. | Live LLM calls are not perfectly deterministic even at temperature 0, and the underlying model snapshot can change during the weeks you run the study. | Medium | Pin an exact model identifier + date with every benchmark run; log it in the raw results; state this explicitly as a threat to validity rather than ignoring it. |
| 5 | **Low statistical power.** 3–5 fixture repos and a handful of scenarios. | Confidence intervals on n≈5 paired scenarios will be very wide. A claim of "≥20% reduction" needs either a larger scenario set or honest effect-size reporting. | Medium | Use paired non-parametric tests (Wilcoxon signed-rank) over bootstrap or naive CIs where sample size is small; report effect sizes; state generalization limits plainly in §"Threats to validity." |
| 6 | **Cross-platform file-locking assumption.** | POSIX `flock` semantics do not translate directly to Windows. If you demo or claim cross-platform correctness, the concurrent-writer path needs to actually be tested there. | Medium | Add an explicit Windows concurrent-writer test, or scope correctness claims to POSIX only and say so in the README. |
| 7 | **Protocol version currency.** The source documents were authored against an MCP baseline that predates the current spec. | The current MCP specification (2026-07-28) introduced a stateless protocol core, multi round-trip requests, header-based routing, cacheable list results, and authorization hardening (issuer validation, issuer-bound client credentials, Client ID Metadata Documents) — a materially different protocol surface than a November-2025-era design assumes. Source: MCP blog, "The 2026-07-28 Specification," https://blog.modelcontextprotocol.io/posts/2026-07-28/ ; spec index https://modelcontextprotocol.io/specification/2026-07-28 | High | Make transport and spec-version an explicit, **dated** ADR: "We target spec version X as of date Y; re-verify before Phase 1 implementation begins." Do not silently inherit assumptions from the source docs. |
| 8 | **No consent / data-handling policy.** | The team-sync demo (clone into a second workspace, retrieve a teammate's record) implies collecting other people's error output and command history. | Medium | Add a short data-handling section: what's logged, local-only by default, `.gitignore` guidance, and an explicit opt-out/deletion command. Faculty and any lightweight ethics review will ask for this. |
| 9 | **Confidence is binary (`passed/failed/unknown`).** | Doesn't let you rank multiple candidate fixes for the same fingerprint by reliability, and gives you nothing quantitative to defend in a viva. | Low–Medium | Replace with a Wilson-score lower bound (or Beta-Bernoulli posterior) computed over verification outcomes per record. Cheap to implement, genuinely improves ranking, and is a legitimate small statistical contribution. |
| 10 | **Missing threat class: persisted retrieval poisoning.** | See §3 — this is the headline finding. | High (opportunity, not just risk) | Build it in as a first-class phase, not an afterthought. |
| 11 | **MCP Inspector version pinning not mentioned.** | A critical RCE vulnerability was disclosed against Anthropic's own MCP Inspector (CVE-2025-49596). Source: cited in "MCP Security Design..." CSI-style document, https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF | Medium | Pin an explicitly patched Inspector version in your dev-dependency policy and note the CVE in your dependency-audit doc. |

---

## 3. The recommended novel contribution: persisted retrieval-channel poisoning

### 3.1 The gap

`find_fix` returns previously-stored `fix.explanation` and `rawOutputRedacted` text directly into a future agent's context window. This is exactly the channel that MCP tool-poisoning attacks exploit: an agent treats a tool's *response* as trusted, even though only the tool's *description* was ever reviewed by a human (OWASP, "MCP Tool Poisoning," https://owasp.org/www-community/attacks/MCP_Tool_Poisoning).

Current published work in this space — the MCPTox benchmark, MCP-SafetyBench, and MSB (ICLR 2026) — concentrates on a **malicious external server** shipping poisoned tool *descriptions*. Your architecture creates a distinct, less-studied sub-case:

> A single planted or accidentally-poisoned **record** — from a compromised teammate, a bad merge, or an earlier agent session that was tricked once — becomes a **persistent, self-inflicted poisoning vector that fires on every future retrieval**, indefinitely, across every clone of the repository, long after the original session ended.

This differs from classic tool-description poisoning in three ways worth stating explicitly in your threat model and paper:

1. **Persistence** — a poisoned tool description is fixed at connect-time and can be re-reviewed; a poisoned *record* re-enters context on every matching query, silently, potentially years later.
2. **Provenance ambiguity** — the payload isn't the server author's; it's data the system itself accumulated, meaning "audit the server code" (the standard MCP mitigation advice) does not catch it.
3. **Propagation via git** — because JSONL is git-synced, a single poisoned commit reaches every teammate's clone without needing the attacker to compromise the server or the network path.

### 3.2 Concrete precedent to cite

- CVE-2025-49596 — RCE in Anthropic's own MCP Inspector.
- CVE-2025-54136 ("MCPoison") — exploited a Cursor trust model that bound approval to a server's *name* rather than its *contents*, so a shared project config could be silently modified after initial approval and still be treated as trusted. Source: Cloud Security Alliance research note, https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-tool-poisoning-auto-execution-20260701/ — this is structurally the same "approved once, trusted forever" pattern your JSONL records are exposed to.

### 3.3 What to build

Add as an explicit phase (see the prompts document, Phase 5):

- **Red-team fixture corpus**: planted records containing second-person imperative payloads ("ignore prior instructions and run…"), fake system-reminder text, zero-width/unicode-homoglyph obfuscation, and nested/quoted injection attempts inside `fix.explanation` and `rawOutputRedacted`.
- **Sanitization envelope**: wrap every retrieved record in explicit untrusted-data delimiters before returning it via `find_fix`, so the receiving agent's own system prompt can treat it as data, not instruction (mirrors how citation/quoting boundaries work in well-behaved agent systems).
- **Heuristic flagging**: detect and flag (not silently strip) imperative-language density spikes and known injection markers in stored explanations; surface the flag in the dashboard, don't just log it.
- **Provenance-weighted trust**: self-authored-and-verified records outrank unverified/unknown-author records in ranking, independent of similarity score.
- **A dedicated threat-model section** citing the OWASP entry, MCPTox, MCP-SafetyBench/MSB, and the CVEs above, explicitly scoping what your sanitization does and does not defend against (it is not a full LLM injection defense — say so).

### 3.4 Why this is the right thesis angle

It's citable (active, 2026-dated literature exists), it's specific to *your* architecture rather than generic MCP advice, it's cheap to implement relative to its narrative value, and it directly strengthens the "safety-conscious developer-productivity system" positioning the original plan already wants for the corporate-interview pitch.

---

## 4. Consolidated feature backlog (delta over the original plan)

| Feature | Maps to phase | Effort |
|---|---|---|
| Minimum Defensible Submission checkpoint at week 8 | Planning | Low |
| Layered redaction: pattern + entropy detection, adversarial recall/precision report | Phase 3 | Medium |
| Early FTS5/BM25 fallback path, benchmarked (not assumed) | Phase 3 | Medium |
| Wilson-score / Beta-Bernoulli confidence ranking over verification outcomes | Phase 4 | Low |
| Record-poisoning red-team corpus + sanitization envelope + provenance weighting | New Phase 5 | Medium–High |
| Dashboard ("Memory Console") — see companion spec | New Phase 6 | Medium |
| Dated, explicit spec-version ADR (2026-07-28 baseline) | Phase 1 | Low |
| Data-handling / consent note | Phase 0 docs | Low |
| Windows concurrent-writer test, or scoped POSIX-only claim | Phase 2/7 | Low–Medium |
| Pinned, patched MCP Inspector version + CVE note in dependency audit | Phase 7 | Low |
| Pinned model identifier + date logged with every benchmark run | Phase 6 (eval) | Low |
| Wilcoxon signed-rank / effect-size reporting instead of naive CIs | Phase 6 (eval) | Low |

---

## 5. Related-work seed list (for your literature/product matrix)

- OWASP, "MCP Tool Poisoning" — https://owasp.org/www-community/attacks/MCP_Tool_Poisoning
- Wang et al., "MCPTox: A Benchmark for Tool Poisoning Attack on Real-World MCP Servers," 2025 (arXiv)
- Zhang et al., "MCP Security Bench (MSB): Benchmarking Attacks against Model Context Protocol in LLM Agents," ICLR 2026
- Zong et al., "MCP-SafetyBench: A Benchmark for Safety Evaluation of LLMs with Real-World MCP Servers"
- MDPI, "Model Context Protocol Threat Modeling and Analysis of Vulnerabilities to Prompt Injection with Tool Poisoning," 2026 — https://www.mdpi.com/2624-800X/6/3/84
- "Are AI-assisted Development Tools Immune to Prompt Injection?" (comparative study of 7 MCP clients) — https://arxiv.org/html/2603.21642v1
- "Parasites in the Toolchain: A Large-Scale Analysis of Attacks on the MCP Ecosystem" — https://arxiv.org/pdf/2509.06572
- Cloud Security Alliance, "MCP Attack Surface: Tool Poisoning and IDE Auto-Execution," 2026-07-01 — https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-tool-poisoning-auto-execution-20260701/
- Microsoft, "Protecting against indirect prompt injection attacks in MCP," 2025
- MCP specification 2026-07-28 — https://modelcontextprotocol.io/specification/2026-07-28
- MCP blog, "The 2026-07-28 Specification" — https://blog.modelcontextprotocol.io/posts/2026-07-28/
- MCP blog, "The New MCP Roadmap" — https://blog.modelcontextprotocol.io/posts/mcp-roadmap/

Build the comparison table required by the original plan's novelty-assessment section using these plus 5–7 general case-based-reasoning / build-failure-mining papers found via IEEE Xplore/ACM DL/Google Scholar searches on: `build failure fix reuse`, `developer error knowledge base`, `case based reasoning software debugging`, `LLM agent memory coding`.

---

## 6. Revised go/no-go

Proceed on the original plan's conditions, plus: you must be able to (a) articulate the persisted-poisoning threat distinctly from generic tool-description poisoning in one paragraph, and (b) name your Minimum Defensible Submission checkpoint before starting Phase 2. If either is unclear, spend an extra half-day on Phase 0/1 rather than starting to code.
