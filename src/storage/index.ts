/**
 * SQLite as rebuildable secondary index using node:sqlite DatabaseSync with FTS5.
 * ADR-003 compliant.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryRecord } from '../types.js';
import { extractCommandFamily } from '../core/match.js';

export class SqliteIndex {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  private init(): void {
    // Enable WAL mode for high concurrency
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS records (
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

      CREATE INDEX IF NOT EXISTS idx_records_fingerprint ON records(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_records_repo_family ON records(repository_id, command_family);

      CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
        id UNINDEXED,
        normalized_output
      );

      CREATE TABLE IF NOT EXISTS index_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /**
   * Checks whether the secondary SQLite index has been flagged as dirty.
   */
  isIndexDirty(): boolean {
    try {
      const row = this.db
        .prepare("SELECT value FROM index_metadata WHERE key = 'is_dirty'")
        .get() as { value: string } | undefined;
      return row?.value === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Marks the secondary index dirty or clean in index_metadata.
   */
  markIndexDirty(isDirty: boolean): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO index_metadata (key, value) VALUES ('is_dirty', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
        )
        .run(isDirty ? 'true' : 'false');
    } catch {
      // In case of database lock or disk failure, log or degrade gracefully
    }
  }

  /**
   * Retrieves the count of records recorded during last reconciliation.
   */
  getLastReconciledRecordCount(): number {
    try {
      const row = this.db
        .prepare("SELECT value FROM index_metadata WHERE key = 'reconciled_count'")
        .get() as { value: string } | undefined;
      return row ? parseInt(row.value, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Persists the count of records recorded during last reconciliation.
   */
  setLastReconciledRecordCount(count: number): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO index_metadata (key, value) VALUES ('reconciled_count', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
        )
        .run(String(count));
    } catch {
      // Ignore non-fatal metadata write error
    }
  }

  indexRecord(record: MemoryRecord): void {
    const commandFamily = extractCommandFamily(record.command);
    const isQuarantined = record.poisoningFlag !== null ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO records (
        id, fingerprint, command, command_family, exit_code, repository_id, created_at, normalizer_version, is_quarantined, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.fingerprint,
      record.command,
      commandFamily,
      record.exitCode,
      record.repositoryId,
      record.createdAt,
      record.normalizerVersion,
      isQuarantined,
      JSON.stringify(record),
    );

    // Maintain FTS5 index
    try {
      this.db.prepare('DELETE FROM records_fts WHERE id = ?').run(record.id);
      this.db
        .prepare('INSERT INTO records_fts (id, normalized_output) VALUES (?, ?)')
        .run(record.id, record.normalizedOutput);
    } catch {
      // Fallback if FTS5 is not required
    }
  }

  /**
   * Rebuilds the SQLite index transactionally from an array of MemoryRecords.
   */
  rebuildIndex(records: MemoryRecord[]): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec('DELETE FROM records; DELETE FROM records_fts;');
      for (const record of records) {
        this.indexRecord(record);
      }
      this.markIndexDirty(false);
      this.setLastReconciledRecordCount(records.length);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      this.markIndexDirty(true);
      throw e;
    }
  }

  /**
   * Reconciles the secondary SQLite projection against canonical records from JSONL.
   * If SQLite is marked dirty, record counts mismatch, or IDs are missing,
   * a transactional rebuild is executed automatically.
   */
  reconcileWithCanonical(canonicalRecords: MemoryRecord[]): {
    rebuilt: boolean;
    syncedCount: number;
  } {
    const isDirty = this.isIndexDirty();
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM records').get() as
      | { count: number }
      | undefined;
    const sqliteCount = countRow?.count ?? 0;

    if (isDirty || sqliteCount !== canonicalRecords.length) {
      this.rebuildIndex(canonicalRecords);
      return { rebuilt: true, syncedCount: canonicalRecords.length };
    }

    // Verify all canonical IDs exist in SQLite
    const existingIds = new Set(
      (this.db.prepare('SELECT id FROM records').all() as { id: string }[]).map((r) => r.id),
    );
    let missingFound = false;
    for (const rec of canonicalRecords) {
      if (!existingIds.has(rec.id)) {
        missingFound = true;
        break;
      }
    }

    if (missingFound) {
      this.rebuildIndex(canonicalRecords);
      return { rebuilt: true, syncedCount: canonicalRecords.length };
    }

    this.markIndexDirty(false);
    this.setLastReconciledRecordCount(canonicalRecords.length);
    return { rebuilt: false, syncedCount: canonicalRecords.length };
  }

  findByFingerprint(
    fingerprint: string,
    repositoryId?: string,
    commandFamily?: string,
    includeQuarantined = false,
  ): MemoryRecord | null {
    let sql = 'SELECT data FROM records WHERE fingerprint = ?';
    const params: (string | number)[] = [fingerprint];

    if (repositoryId) {
      sql += ' AND repository_id = ?';
      params.push(repositoryId);
    }
    if (commandFamily) {
      sql += ' AND command_family = ?';
      params.push(commandFamily);
    }
    if (!includeQuarantined) {
      sql += ' AND is_quarantined = 0';
    }
    sql += ' ORDER BY created_at DESC LIMIT 1';

    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as { data: string } | undefined;
    if (!row) {
      return null;
    }
    return JSON.parse(row.data) as MemoryRecord;
  }

  findById(id: string): MemoryRecord | null {
    const row = this.db.prepare('SELECT data FROM records WHERE id = ?').get(id) as
      | { data: string }
      | undefined;
    return row ? (JSON.parse(row.data) as MemoryRecord) : null;
  }

  /**
   * Fast candidates search using FTS5 BM25 or candidate fetch filtered by repo and command family.
   */
  findCandidates(
    repositoryId: string,
    commandFamily: string,
    searchQuery?: string,
    limit = 20,
    includeQuarantined = false,
  ): MemoryRecord[] {
    // If search query is provided and contains alphanumeric words, leverage FTS5
    if (searchQuery) {
      const cleanTokens = searchQuery
        .replace(/[^a-zA-Z0-9_\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 2)
        .slice(0, 10);

      if (cleanTokens.length > 0) {
        try {
          const ftsMatch = cleanTokens.map((t) => `"${t}"`).join(' OR ');
          let ftsSql = `
            SELECT r.data
            FROM records_fts f
            JOIN records r ON f.id = r.id
            WHERE records_fts MATCH ?
              AND r.repository_id = ?
              AND r.command_family = ?
          `;
          if (!includeQuarantined) {
            ftsSql += ' AND r.is_quarantined = 0';
          }
          ftsSql += ' ORDER BY bm25(records_fts) LIMIT ?';

          const stmt = this.db.prepare(ftsSql);
          const rows = stmt.all(ftsMatch, repositoryId, commandFamily, limit) as {
            data: string;
          }[];
          if (rows.length > 0) {
            return rows.map((row) => JSON.parse(row.data) as MemoryRecord);
          }
        } catch {
          // If FTS query fails or produces syntax issue, fall through to relational candidate scan
        }
      }
    }

    // Relational fallback filtered by repo and command family
    let sql = 'SELECT data FROM records WHERE repository_id = ? AND command_family = ?';
    if (!includeQuarantined) {
      sql += ' AND is_quarantined = 0';
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(repositoryId, commandFamily, limit) as { data: string }[];
    return rows.map((row) => JSON.parse(row.data) as MemoryRecord);
  }

  getStats(repositoryId?: string): {
    total: number;
    exactFingerprints: number;
    quarantined: number;
    verifiedCount: number;
    pendingApprovals: number;
  } {
    const whereClause = repositoryId ? 'WHERE repository_id = ?' : '';
    const params = repositoryId ? [repositoryId] : [];

    const countSql = `
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT fingerprint) as distinctFps,
        SUM(is_quarantined) as quarantined,
        SUM(CASE WHEN json_extract(data, '$.verification.status') IN ('passed','failed') THEN 1 ELSE 0 END) as verifiedCount
      FROM records ${whereClause}
    `;

    const row = (
      repositoryId ? this.db.prepare(countSql).get(...params) : this.db.prepare(countSql).get()
    ) as
      | {
          total: number;
          distinctFps: number;
          quarantined: number | null;
          verifiedCount: number | null;
        }
      | undefined;

    return {
      total: row?.total ?? 0,
      exactFingerprints: row?.distinctFps ?? 0,
      quarantined: row?.quarantined ?? 0,
      verifiedCount: row?.verifiedCount ?? 0,
      pendingApprovals: 0, // approvals live in JSONL; count is always 0 from SQLite
    };
  }

  listRecentIds(limit: number): string[] {
    const rows = this.db
      .prepare('SELECT id FROM records ORDER BY created_at DESC LIMIT ?')
      .all(limit) as { id: string }[];
    return rows.map((r) => r.id);
  }

  close(): void {
    this.db.close();
  }
}
