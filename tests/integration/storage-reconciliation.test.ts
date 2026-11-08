/**
 * Phase 1 / Prompt 2 — Storage Reconciliation & Self-Healing Projection Test Suite.
 *
 * Verifies that:
 * 1. JSONL is the single canonical source of truth.
 * 2. SQLite is a derived, rebuildable secondary index projection.
 * 3. Deleting index.db results in transparent, deterministic rebuild from JSONL.
 * 4. An index flagged dirty or out-of-sync triggers self-healing reconciliation.
 * 5. Corrupt or missing SQLite state never causes loss of canonical JSONL records.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryService } from '../../src/core/memoryService.js';
import { SqliteIndex } from '../../src/storage/index.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reconciliation-test-'));
}

describe('Storage Reconciliation & Self-Healing Projection', () => {
  it('rebuilds SQLite projection from scratch when index.db is deleted', async () => {
    const tmpDir = makeTmpDir();
    const memoryDir = path.join(tmpDir, '.agent-memory');

    // 1. Create service and record multiple failures
    let service = new MemoryService({ memoryDir, workspaceRoot: tmpDir });
    const rec1 = await service.recordFailure({
      command: 'npm test',
      exitCode: 1,
      output: 'TypeError: undefined is not a function at line 12',
      fixCommands: ['npm run build'],
      explanation: 'Fix build step first',
    });
    const rec2 = await service.recordFailure({
      command: 'cargo test',
      exitCode: 101,
      output: 'error[E0432]: unresolved import `crate::utils`',
      fixCommands: ['cargo check'],
      explanation: 'Import missing crate module',
    });
    service.close();

    // Verify records exist in JSONL
    const jsonlPath = path.join(memoryDir, 'records.jsonl');
    expect(fs.existsSync(jsonlPath)).toBe(true);
    const jsonlContent = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n');
    expect(jsonlContent.length).toBe(2);

    // 2. Completely delete index.db (simulating database wipe or corruption)
    const dbPath = path.join(memoryDir, 'index.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also remove WAL / SHM files if present
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    expect(fs.existsSync(dbPath)).toBe(false);

    // 3. Initialize a new MemoryService instance — startup reconciliation must rebuild index.db
    service = new MemoryService({ memoryDir, workspaceRoot: tmpDir });
    try {
      expect(fs.existsSync(dbPath)).toBe(true);

      // Verify records are queryable from rebuilt SQLite
      const found1 = service.getRecordById(rec1.id);
      expect(found1).not.toBeNull();
      expect(found1?.command).toBe('npm test');

      const found2 = service.getRecordById(rec2.id);
      expect(found2).not.toBeNull();
      expect(found2?.command).toBe('cargo test');

      const stats = service.getStats();
      expect(stats.totalRecords).toBe(2);
    } finally {
      service.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it('reconciles and rebuilds index when marked dirty in index_metadata', async () => {
    const tmpDir = makeTmpDir();
    const memoryDir = path.join(tmpDir, '.agent-memory');

    let service = new MemoryService({ memoryDir, workspaceRoot: tmpDir });
    const rec = await service.recordFailure({
      command: 'npm run lint',
      exitCode: 1,
      output: 'ESLint error: unused variable at line 5',
      fixCommands: ['npm run lint -- --fix'],
      explanation: 'Auto-fix lint errors',
    });
    service.close();

    const dbPath = path.join(memoryDir, 'index.db');
    const sqlite = new SqliteIndex(dbPath);
    // Mark index dirty
    sqlite.markIndexDirty(true);
    expect(sqlite.isIndexDirty()).toBe(true);
    sqlite.close();

    // Reopen service — reconcileOnStartup must detect dirty index and clear it
    service = new MemoryService({ memoryDir, workspaceRoot: tmpDir });
    try {
      const stats = service.getStats();
      expect(stats.totalRecords).toBe(1);

      const checkSqlite = new SqliteIndex(dbPath);
      expect(checkSqlite.isIndexDirty()).toBe(false);
      checkSqlite.close();

      const retrieved = service.getRecordById(rec.id);
      expect(retrieved?.command).toBe('npm run lint');
    } finally {
      service.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it('detects external JSONL appends and reconciles on startup', async () => {
    const tmpDir = makeTmpDir();
    const memoryDir = path.join(tmpDir, '.agent-memory');

    let service = new MemoryService({ memoryDir, workspaceRoot: tmpDir });
    await service.recordFailure({
      command: 'npm test',
      exitCode: 1,
      output: 'Test failure 1',
      fixCommands: ['npm test'],
      explanation: 'Explanation 1',
    });
    service.close();

    // Simulate an external tool appending directly to canonical records.jsonl
    const jsonlPath = path.join(memoryDir, 'records.jsonl');
    const externalRecord = {
      schemaVersion: 1,
      id: 'rec_ext_test_999',
      createdAt: new Date().toISOString(),
      repositoryId: 'default-repo',
      command: 'pytest tests/',
      exitCode: 1,
      rawOutputRedacted: 'AssertionError in test_app.py:55',
      normalizedOutput: 'AssertionError in test_app.py',
      fingerprint: 'sha256:1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      normalizerVersion: 2,
      fix: {
        commands: ['pytest --pdb'],
        explanation: 'Debug test failure',
        risk: 'low',
      },
      environment: {
        os: process.platform,
        node: process.version,
        packageManager: 'npm',
        lockfileHashes: {},
      },
      verification: {
        status: 'unknown',
        verifiedAt: null,
        method: 'dry_run',
        wilsonLowerBound: null,
      },
      provenance: { author: 'developer', commit: null },
      supersedes: null,
      tags: [],
      poisoningFlag: null,
    };
    fs.appendFileSync(jsonlPath, JSON.stringify(externalRecord) + '\n', 'utf8');

    // Startup reconciliation must synchronize SQLite with the newly added record
    service = new MemoryService({ memoryDir, workspaceRoot: tmpDir });
    try {
      const stats = service.getStats();
      expect(stats.totalRecords).toBe(2);

      const retrievedExternal = service.getRecordById('rec_ext_test_999');
      expect(retrievedExternal).not.toBeNull();
      expect(retrievedExternal?.command).toBe('pytest tests/');
    } finally {
      service.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);
});
