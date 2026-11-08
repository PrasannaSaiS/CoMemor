/**
 * JSONL storage: Append-only persistent store with cross-platform advisory locking.
 * ADR-002 compliant.
 *
 * Phase 1 hardening: proper-lockfile used for cross-process mutual exclusion.
 * Combined with in-process promise chaining to guarantee no interleaved writes
 * across concurrent callers in the same process or across processes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { lock, lockSync } from 'proper-lockfile';
import type { MemoryRecord } from '../types.js';

const LOCK_RETRIES = 10;
const LOCK_STALE_MS = 10_000; // 10 s — stale lock recovery
const LOCK_RETRY_WAIT_MS = 50;

/** In-process queue to serialize concurrent write operations to the same file */
const fileQueues = new Map<string, Promise<void>>();

function getFileQueue(resolvedPath: string): Promise<void> {
  return fileQueues.get(resolvedPath) ?? Promise.resolve();
}

function setFileQueue(resolvedPath: string, promise: Promise<void>): void {
  fileQueues.set(resolvedPath, promise);
}

/**
 * Appends a line or object atomically under a cross-process advisory lock.
 */
export async function appendLockedJsonl(filePath: string, data: unknown): Promise<void> {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(resolved)) {
    fs.writeFileSync(resolved, '', { encoding: 'utf8' });
  }

  const line = (typeof data === 'string' ? data : JSON.stringify(data)) + '\n';

  const operation = async () => {
    const release = await lock(resolved, {
      retries: {
        retries: LOCK_RETRIES,
        minTimeout: LOCK_RETRY_WAIT_MS,
        factor: 1.5,
      },
      stale: LOCK_STALE_MS,
      realpath: false,
    });

    try {
      await fs.promises.appendFile(resolved, line, { encoding: 'utf8' });
    } finally {
      await release();
    }
  };

  const queue = getFileQueue(resolved);
  const next = queue.then(operation, operation);
  setFileQueue(resolved, next);
  return next;
}

/**
 * Synchronous append under cross-process lock for CLI / policy call paths.
 */
export function appendLockedJsonlSync(filePath: string, data: unknown): void {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(resolved)) {
    fs.writeFileSync(resolved, '', { encoding: 'utf8' });
  }

  const line = (typeof data === 'string' ? data : JSON.stringify(data)) + '\n';
  const release = lockSync(resolved, {
    stale: LOCK_STALE_MS,
    realpath: false,
  });

  try {
    fs.appendFileSync(resolved, line, { encoding: 'utf8' });
  } finally {
    release();
  }
}

export class JsonlStorage {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Ensure the file exists so proper-lockfile can lock it
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', { encoding: 'utf8' });
    }
  }

  /**
   * Appends a record atomically under a cross-process advisory lock.
   * Uses proper-lockfile for Windows + Linux compatibility.
   */
  async append(record: MemoryRecord): Promise<void> {
    return appendLockedJsonl(this.filePath, record);
  }

  /**
   * Reads all records from the JSONL file.
   * Corrupted lines (invalid JSON) are skipped with a stderr warning.
   * Recovery: re-run the SQLite index rebuild from valid lines only.
   */
  async readAll(): Promise<MemoryRecord[]> {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    const content = await fs.promises.readFile(this.filePath, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    const records: MemoryRecord[] = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        records.push(JSON.parse(lines[i] ?? '') as MemoryRecord);
      } catch {
        // CORRUPTED LINE: log to stderr (never stdout) and skip.
        // The SQLite index remains authoritative; re-index by re-reading valid records.
        process.stderr.write(
          JSON.stringify({
            level: 'warn',
            event: 'jsonl_corrupted_line',
            file: this.filePath,
            lineNumber: i + 1,
            preview: (lines[i] ?? '').slice(0, 80),
            recovery: 'line skipped; re-run index rebuild from valid lines',
          }) + '\n',
        );
      }
    }
    return records;
  }
}
