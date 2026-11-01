# Retrieval Benchmark Results — CoMemor

**Date:** 2026-09-10  
**Environment:** Node.js v24.11.0, Windows x64  
**Engine:** SQLite (node:sqlite DatabaseSync) with FTS5 / BM25 index  
**Benchmark Script:** `scripts/benchmark-retrieval.ts`  

---

## 1. Executive Summary

Benchmarks were executed across three dataset scales: 100, 1,000, and 10,000 failure-fix records in `.agent-memory/records.jsonl` and indexed in `index.db`.

Retrieval performance remains sub-80ms even at 10,000 records, comfortably exceeding the developer interactive threshold (<200ms).

| Scale (Records) | Exact Fingerprint Match Latency (ms) | Conservative Fuzzy Fallback Latency (ms) | Notes |
| :--- | :--- | :--- | :--- |
| **100** | **5.14 ms** | **4.63 ms** | Sub-6ms instantaneous retrieval |
| **1,000** | **7.26 ms** | **6.86 ms** | Sub-10ms instantaneous retrieval |
| **10,000** | **75.90 ms** | **75.42 ms** | FTS5 candidate filtering prevents O(N*L) full scan |

---

## 2. Methodology & Findings

1. **Exact Lookup:**
   - Filtered by `repository_id` and `command_family`.
   - Uses B-tree index on `idx_records_fingerprint` and `idx_records_repo_family`.

2. **Conservative Fuzzy Fallback:**
   - Evaluated when exact fingerprint does not match (e.g. slight line number or token shift).
   - Uses SQLite FTS5 with BM25 ranking (`bm25(records_fts)`) to select top candidate failure traces, then applies Token Jaccard (60%) + Trigram similarity (40%) scoring.
   - Preserves strict separation: candidates with scores $\ge 0.65$ threshold are returned as `matchType: 'fuzzy'`; they are never silently converted into `exact` fixes.
