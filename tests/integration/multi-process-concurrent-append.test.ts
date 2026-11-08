import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { JsonlStorage } from '../../src/storage/jsonl.js';
import { SqliteIndex } from '../../src/storage/index.js';

describe('Multi-Process Concurrent Append Integration Test', () => {
  let tmpDir: string;
  let jsonlPath: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-memory-multi-proc-'));
    jsonlPath = path.join(tmpDir, 'records.jsonl');
    dbPath = path.join(tmpDir, 'index.db');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  function runAppendWorker(workerId: string, count: number, targetFile: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // Child process script that appends records sequentially
      const workerScript = `
        import { JsonlStorage } from './dist/storage/jsonl.js';

        const jsonl = new JsonlStorage(${JSON.stringify(targetFile)});
        const workerId = ${JSON.stringify(workerId)};
        const count = ${count};

        async function main() {
          for (let i = 0; i < count; i++) {
            const record = {
              schemaVersion: 1,
              id: workerId + '-' + i,
              createdAt: new Date().toISOString(),
              repositoryId: 'multi-proc-test',
              command: 'npm test',
              exitCode: 1,
              rawOutputRedacted: 'failure from ' + workerId + '-' + i,
              normalizedOutput: 'failure from ' + workerId + '-' + i,
              fingerprint: 'sha256:' + workerId + '-' + i,
              normalizerVersion: 1,
              fix: {
                commands: ['npm run fix'],
                explanation: 'Fix for ' + workerId + '-' + i,
                risk: 'low'
              },
              environment: {
                os: process.platform,
                node: process.version,
                packageManager: 'npm',
                lockfileHashes: {}
              },
              verification: {
                status: 'unknown',
                verifiedAt: null,
                method: 'dry_run',
                wilsonLowerBound: null
              },
              provenance: {
                author: 'Worker ' + workerId,
                commit: null
              },
              supersedes: null,
              tags: ['multi-proc'],
              poisoningFlag: null
            };
            await jsonl.append(record);
          }
        }

        main().catch((err) => {
          console.error(err);
          process.exit(1);
        });
      `;

      const child = spawn('node', ['--input-type=module', '-e', workerScript], {
        cwd: path.resolve('.'),
        stdio: ['ignore', 'inherit', 'inherit'],
      });

      child.on('close', (code) => {
        if (code === 0) resolve(code);
        else reject(new Error(`Worker ${workerId} exited with code ${code}`));
      });
      child.on('error', reject);
    });
  }

  it('two child processes concurrently append 50 records each without corruption or data loss', async () => {
    // Launch two separate OS child processes targeting the identical JSONL file concurrently
    const p1 = runAppendWorker('proc1', 50, jsonlPath);
    const p2 = runAppendWorker('proc2', 50, jsonlPath);

    await Promise.all([p1, p2]);

    // 1. Read all records using JsonlStorage
    const jsonl = new JsonlStorage(jsonlPath);
    const records = await jsonl.readAll();

    expect(records.length).toBe(100);

    const ids = new Set(records.map((r) => r.id));
    expect(ids.size).toBe(100);

    for (let i = 0; i < 50; i++) {
      expect(ids.has(`proc1-${i}`)).toBe(true);
      expect(ids.has(`proc2-${i}`)).toBe(true);
    }

    // 2. Rebuild SQLite index from the file and verify exactly 100 entries
    const sqlite = new SqliteIndex(dbPath);
    sqlite.rebuildIndex(records);

    const stats = sqlite.getStats();
    expect(stats.total).toBe(100);

    // Verify lookup works on both worker outputs
    const rec1 = sqlite.findByFingerprint('sha256:proc1-25');
    expect(rec1).not.toBeNull();
    expect(rec1?.id).toBe('proc1-25');

    const rec2 = sqlite.findByFingerprint('sha256:proc2-42');
    expect(rec2).not.toBeNull();
    expect(rec2?.id).toBe('proc2-42');

    sqlite.close();
  }, 15_000);
});
