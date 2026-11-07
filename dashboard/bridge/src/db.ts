/**
 * Read-only SQLite database and JSONL storage reader for Dashboard Bridge.
 * Hard invariant: Opened in readOnly mode. No commands or shell executions.
 *
 * Design note: getDb() reopens the connection on every call-group so that
 * WAL checkpoints written by the MCP server process are immediately visible.
 * SQLite read-only connections do not block writers and are cheap to open.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export interface RecordSummary {
  id: string;
  fingerprint: string;
  command: string;
  commandFamily: string;
  exitCode: number;
  repositoryId: string;
  createdAt: string;
  normalizerVersion: number;
  isQuarantined: boolean;
  wilsonLowerBound: number | null;
  verificationStatus: string;
  fixExplanation: string;
}

export interface PendingApproval {
  approvalId: string;
  createdAt: string;
  requestedCommand: string;
  recordId: string | null;
  risk: {
    level: string;
    reasons: string[];
  };
  reason: string;
  status: string;
}

export interface ResolvedApproval {
  approvalId: string;
  command?: string | undefined;
  decision: 'approve' | 'deny';
  operatorNotes?: string | undefined;
  resolvedAt: string;
}

export class BridgeStorage {
  private memoryDir: string;
  private dbPath: string;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
    this.dbPath = path.join(memoryDir, 'index.db');
  }

  /**
   * Open a read-only database connection.
   * Exposed as public/internal helper so security tests can verify read-only invariants.
   */
  public getDb(): DatabaseSync | null {
    if (!fs.existsSync(this.dbPath)) return null;
    try {
      return new DatabaseSync(this.dbPath, { readOnly: true });
    } catch (err) {
      console.error('[bridge] Failed to open SQLite read-only:', err);
      return null;
    }
  }

  /**
   * Execute query with an automatically managed connection that is closed immediately after,
   * guaranteeing zero locks and immediate visibility of newly flushed WAL records.
   */
  private withDb<T>(fn: (db: DatabaseSync) => T, fallback: T): T {
    const db = this.getDb();
    if (!db) return fallback;
    try {
      return fn(db);
    } finally {
      try { db.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Safe close helper retained for interface compatibility.
   */
  public close(): void {
    // Stateless per-query connection management; no-op
  }

  getStats(repoId?: string) {
    return this.withDb((db) => {
      const whereClause = repoId ? 'WHERE repository_id = ?' : '';
      const params: (string | number)[] = repoId ? [repoId] : [];

      const totalRow = db
        .prepare(`SELECT COUNT(*) as count FROM records ${whereClause}`)
        .get(...params) as { count: number } | undefined;
      const total = totalRow?.count ?? 0;

      const fpRow = db
        .prepare(`SELECT COUNT(DISTINCT fingerprint) as count FROM records ${whereClause}`)
        .get(...params) as { count: number } | undefined;
      const exactFingerprints = fpRow?.count ?? 0;

      const quarRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM records ${repoId ? 'WHERE repository_id = ? AND is_quarantined = 1' : 'WHERE is_quarantined = 1'}`,
        )
        .get(...params) as { count: number } | undefined;
      const quarantinedCount = quarRow?.count ?? 0;

      const allRecordsRows = db
        .prepare(`SELECT created_at, data FROM records ${whereClause}`)
        .all(...params) as Array<{ created_at: string; data: string }>;

      let verifiedCount = 0;
      let staleCount = 0;
      let wilsonSum = 0;
      let recordsWithWilson = 0;
      const now = Date.now();
      const ageDist = { under1h: 0, under24h: 0, under7d: 0, over7d: 0 };

      for (const r of allRecordsRows) {
        const ageMs = now - new Date(r.created_at).getTime();
        if (ageMs < 3600 * 1000) ageDist.under1h++;
        else if (ageMs < 86400 * 1000) ageDist.under24h++;
        else if (ageMs < 7 * 86400 * 1000) ageDist.under7d++;
        else ageDist.over7d++;

        try {
          const parsed = JSON.parse(r.data);
          if (parsed.verification?.status === 'verified_success') verifiedCount++;
          if (parsed.staleness?.isStale === true) staleCount++;
          if (
            parsed.verification?.wilsonLowerBound !== null &&
            parsed.verification?.wilsonLowerBound !== undefined
          ) {
            wilsonSum += parsed.verification.wilsonLowerBound;
            recordsWithWilson++;
          }
        } catch {
          // ignore parse error
        }
      }

      const avgWilson =
        recordsWithWilson > 0
          ? Number((wilsonSum / recordsWithWilson).toFixed(4))
          : verifiedCount > 0
            ? Number((verifiedCount / total).toFixed(4))
            : 0;

      return {
        totalRecords: total,
        exactFingerprints,
        quarantinedCount,
        verifiedCount,
        staleCount,
        successRate: avgWilson,
        ageDistribution: ageDist,
      };
    }, {
      totalRecords: 0,
      exactFingerprints: 0,
      quarantinedCount: 0,
      verifiedCount: 0,
      staleCount: 0,
      successRate: 0,
      ageDistribution: { under1h: 0, under24h: 0, under7d: 0, over7d: 0 },
    });
  }

  getRecords(filters: {
    repositoryId?: string | undefined;
    commandFamily?: string | undefined;
    isQuarantined?: boolean | undefined;
    query?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }) {
    return this.withDb((db) => {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (filters.repositoryId) {
        conditions.push('repository_id = ?');
        params.push(filters.repositoryId);
      }
      if (filters.commandFamily) {
        conditions.push('command_family = ?');
        params.push(filters.commandFamily);
      }
      if (filters.isQuarantined !== undefined) {
        conditions.push('is_quarantined = ?');
        params.push(filters.isQuarantined ? 1 : 0);
      }
      if (filters.query) {
        conditions.push('(command LIKE ? OR data LIKE ?)');
        params.push(`%${filters.query}%`, `%${filters.query}%`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit ?? 100;
      const offset = filters.offset ?? 0;

      const sql = `SELECT id, fingerprint, command, command_family, exit_code, repository_id, created_at, normalizer_version, is_quarantined, data FROM records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = db.prepare(sql).all(...params) as Array<{
        id: string;
        fingerprint: string;
        command: string;
        command_family: string;
        exit_code: number;
        repository_id: string;
        created_at: string;
        normalizer_version: number;
        is_quarantined: number;
        data: string;
      }>;

      return rows.map((row) => {
        let parsedData: {
          verification?: { wilsonLowerBound?: number; status?: string };
          fix?: { explanation?: string; commands?: string[] };
          poisoningFlag?: { raisedAt: string; reason: string; status: 'reviewed' | 'dismissed' | 'confirmed' } | null;
          provenance?: unknown;
        } = {};
        try {
          parsedData = JSON.parse(row.data) as typeof parsedData;
        } catch {}

        return {
          id: row.id,
          fingerprint: row.fingerprint,
          command: row.command,
          commandFamily: row.command_family,
          exitCode: row.exit_code,
          repositoryId: row.repository_id,
          createdAt: row.created_at,
          normalizerVersion: row.normalizer_version,
          isQuarantined: row.is_quarantined === 1,
          wilsonLowerBound: parsedData.verification?.wilsonLowerBound ?? null,
          verificationStatus: parsedData.verification?.status ?? 'unverified',
          fixExplanation: parsedData.fix?.explanation ?? '',
          fixCommands: parsedData.fix?.commands ?? [],
          poisoningFlag: parsedData.poisoningFlag ?? null,
          provenance: parsedData.provenance ?? {},
        };
      });
    }, []);
  }

  getRecordById(id: string) {
    return this.withDb((db) => {
      const row = db.prepare('SELECT data FROM records WHERE id = ?').get(id) as
        | { data: string }
        | undefined;
      if (!row) return null;
      try {
        return JSON.parse(row.data);
      } catch {
        return null;
      }
    }, null);
  }

  getPendingApprovals(): PendingApproval[] {
    const pendingPath = path.join(this.memoryDir, 'approvals-pending.jsonl');
    const resolvedPath = path.join(this.memoryDir, 'approvals-resolved.jsonl');

    const resolvedIds = new Set<string>();
    if (fs.existsSync(resolvedPath)) {
      const resolvedContent = fs.readFileSync(resolvedPath, 'utf8');
      for (const line of resolvedContent.split('\n')) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          if (item.approvalId) resolvedIds.add(item.approvalId);
        } catch {}
      }
    }

    if (!fs.existsSync(pendingPath)) return [];

    const results: PendingApproval[] = [];
    const pendingContent = fs.readFileSync(pendingPath, 'utf8');
    for (const line of pendingContent.split('\n')) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line) as PendingApproval;
        if (item.approvalId && !resolvedIds.has(item.approvalId)) {
          results.push(item);
        }
      } catch {}
    }

    return results;
  }

  resolveApproval(
    approvalId: string,
    decision: 'approve' | 'deny',
    operatorNotes?: string,
  ): { success: boolean; resolvedAt: string } {
    const resolvedPath = path.join(this.memoryDir, 'approvals-resolved.jsonl');
    const pending = this.getPendingApprovals().find((a) => a.approvalId === approvalId);

    const record: ResolvedApproval = {
      approvalId,
      command: pending?.requestedCommand,
      decision,
      operatorNotes: operatorNotes ?? '',
      resolvedAt: new Date().toISOString(),
    };

    fs.appendFileSync(resolvedPath, JSON.stringify(record) + '\n', 'utf8');
    return { success: true, resolvedAt: record.resolvedAt };
  }
}
