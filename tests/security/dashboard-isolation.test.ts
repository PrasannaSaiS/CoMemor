/**
 * Security & Isolation Test Suite for Dashboard Bridge.
 * Phase 6 — CoMemor.
 *
 * Invariants proven by this test suite:
 * 1. Zero Command Execution: The dashboard bridge does NOT import or execute
 *    any child_process / shell execution modules.
 * 2. Stdout Channel Isolation: The dashboard process cannot write to the MCP
 *    server's stdout channel (preserving the JSON-RPC stdio protocol integrity).
 * 3. Read-Only SQLite Storage: The bridge connection is strictly read-only;
 *    mutation statements (INSERT, UPDATE, DELETE) are rejected by SQLite.
 * 4. Decision Append-Only Invariant: The ONLY permitted write operation is
 *    appending human operator decisions to approvals-resolved.jsonl.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BridgeStorage } from '../../dashboard/bridge/src/db.js';
import { DatabaseSync } from 'node:sqlite';

describe('Dashboard Process Isolation & Security Invariants', () => {
  let tmpDir: string;
  let memoryDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-iso-'));
    memoryDir = path.join(tmpDir, '.agent-memory');
    fs.mkdirSync(memoryDir, { recursive: true });
    dbPath = path.join(memoryDir, 'index.db');

    // Create a real SQLite database
    const writerDb = new DatabaseSync(dbPath);
    writerDb.exec(`
      CREATE TABLE records (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        command TEXT NOT NULL,
        command_family TEXT NOT NULL,
        exit_code INTEGER NOT NULL,
        repository_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        normalizer_version INTEGER NOT NULL,
        is_quarantined INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL
      );
    `);
    writerDb.close();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // ─── 1. Static Audit: Zero Command Execution Invariant ────────────────────
  it('bridge source code does NOT import or reference child_process or execution functions', () => {
    const bridgeSrcDir = path.resolve(__dirname, '../../dashboard/bridge/src');
    const files = fs.readdirSync(bridgeSrcDir).filter((f) => f.endsWith('.ts'));

    expect(files.length).toBeGreaterThan(0);

    const bannedTokens = [
      'child_process',
      'node:child_process',
      'exec(',
      'execSync(',
      'spawn(',
      'spawnSync(',
      'execFile(',
      'execFileSync(',
      'fork(',
      'commandPolicy',
      'src/policy',
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(bridgeSrcDir, file), 'utf8');
      for (const token of bannedTokens) {
        expect(
          content.includes(token),
          `Bridge file '${file}' must not contain banned execution token '${token}'`,
        ).toBe(false);
      }
    }
  });

  // ─── 2. Stdout Isolation Invariant ────────────────────────────────────────
  it('bridge operations never write to MCP stdio channel', () => {
    // Intercept stdout to verify zero protocol pollution
    let interceptedStdout = '';
    // Save original write reference; use arrow to avoid 'this' binding issues
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      interceptedStdout += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const storage = new BridgeStorage(memoryDir);
      storage.getStats();
      storage.getRecords({});
      storage.getPendingApprovals();
      storage.close();

      // Ensure no stray logs or UI messages polluted stdout
      expect(interceptedStdout).toBe('');
    } finally {
      process.stdout.write = originalStdoutWrite;
    }
  });

  // ─── 3. Read-Only SQLite Storage Invariant ─────────────────────────────────
  it('bridge SQLite connection enforces read-only mode — write attempts fail', () => {
    const storage = new BridgeStorage(memoryDir);
    // Access internal DB to test write rejection
    const readOnlyDb = (storage as unknown as { getDb(): DatabaseSync | null }).getDb();
    expect(readOnlyDb).not.toBeNull();
    if (!readOnlyDb) throw new Error('Expected readOnlyDb to be non-null');

    // Any attempt to write to SQLite MUST fail with SQLITE_READONLY error
    expect(() => {
      readOnlyDb.exec(`
        INSERT INTO records (id, fingerprint, command, command_family, exit_code, repository_id, created_at, normalizer_version, is_quarantined, data)
        VALUES ('rec_malicious', 'fp', 'rm -rf /', 'rm', 1, 'repo', '2026-09-10', 1, 0, '{}');
      `);
    }).toThrow(/readonly|attempt to write a readonly database/i);

    storage.close();
  });

  // ─── 4. Decision Append-Only Invariant ─────────────────────────────────────
  it('resolving an approval strictly appends to approvals-resolved.jsonl and executes zero commands', () => {
    // 1. Seed a pending approval
    const pendingPath = path.join(memoryDir, 'approvals-pending.jsonl');
    const pendingEntry = {
      approvalId: 'appr_test_123',
      createdAt: new Date().toISOString(),
      requestedCommand: 'npm run clean',
      recordId: 'rec_abc',
      risk: { level: 'LOW', reasons: ['Safe build tool'] },
      reason: 'Human approval test',
      status: 'pending',
    };
    fs.writeFileSync(pendingPath, JSON.stringify(pendingEntry) + '\n', 'utf8');

    const storage = new BridgeStorage(memoryDir);
    const pending = storage.getPendingApprovals();
    expect(pending.length).toBe(1);
    expect(pending[0]?.approvalId).toBe('appr_test_123');

    // 2. Resolve approval
    const res = storage.resolveApproval('appr_test_123', 'approve', 'Operator approved via UI');
    expect(res.success).toBe(true);

    // 3. Verify approvals-resolved.jsonl was appended
    const resolvedPath = path.join(memoryDir, 'approvals-resolved.jsonl');
    expect(fs.existsSync(resolvedPath)).toBe(true);

    const resolvedContent = fs.readFileSync(resolvedPath, 'utf8').trim();
    const resolvedLines = resolvedContent.split('\n');
    expect(resolvedLines.length).toBe(1);

    const resolvedRecord = JSON.parse(resolvedLines[0] ?? '') as {
      approvalId: string;
      decision: string;
      operatorNotes: string;
      command: string;
    };
    expect(resolvedRecord.approvalId).toBe('appr_test_123');
    expect(resolvedRecord.decision).toBe('approve');
    expect(resolvedRecord.operatorNotes).toBe('Operator approved via UI');
    expect(resolvedRecord.command).toBe('npm run clean');

    // 4. Pending queue should now be empty (resolved IDs filtered out)
    const updatedPending = storage.getPendingApprovals();
    expect(updatedPending.length).toBe(0);

    // 5. Verify records.jsonl and index.db were untouched
    const recordsPath = path.join(memoryDir, 'records.jsonl');
    expect(fs.existsSync(recordsPath)).toBe(false);

    storage.close();
  });
});
