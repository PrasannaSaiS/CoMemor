/**
 * Phase 1 / Prompt 2 — All-Fields Redaction Test Suite.
 *
 * Asserts that ALL persisted and queried fields have credentials and secrets
 * stripped before storage, indexing, logging, or verification:
 * - command
 * - output (rawOutputRedacted)
 * - fix.commands
 * - fix.explanation
 * - tags
 * - verifyFix queries
 * - findFix queries
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryService } from '../../src/core/memoryService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'all-fields-redact-'));
}

describe('All-Fields Secret Redaction in MemoryService', () => {
  let tmpDir: string;
  let service: MemoryService;
  const mockGithubPat = 'ghp_' + 'A'.repeat(36);
  const mockSlackToken = 'xoxb-' + '123456789012-1234567890123-abcdefghijklmnopqrstuvwx';
  const mockAwsKey = 'AKIAIOSFODNN7EXAMPLE';
  const mockGoogleKey = 'AIzaSy' + 'A'.repeat(33);
  const mockBearerAuth =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M';

  beforeEach(() => {
    tmpDir = makeTmpDir();
    service = new MemoryService({
      memoryDir: path.join(tmpDir, '.agent-memory'),
      workspaceRoot: tmpDir,
    });
  });

  afterEach(() => {
    service.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('redacts sensitive tokens across all recordFailure fields', async () => {
    const recorded = await service.recordFailure({
      command: `npm test --token=${mockGithubPat}`,
      exitCode: 1,
      output: `Authentication failed: ${mockBearerAuth} is invalid for ${mockGoogleKey}`,
      fixCommands: [
        `npm run build --api-key=${mockAwsKey}`,
        `npm config set token ${mockSlackToken}`,
      ],
      explanation: `Set the authorization header with Bearer ${mockGithubPat} and export SLACK_TOKEN=${mockSlackToken}`,
      tags: [`key-${mockAwsKey}`, 'ci-fix'],
    });

    expect(recorded.status).toBe('recorded');

    // Retrieve raw record from service
    const record = service.getRecordById(recorded.id);
    expect(record).not.toBeNull();
    if (!record) throw new Error('Record not found');

    // 1. Check command field
    expect(record.command).not.toContain(mockGithubPat);
    expect(record.command).toContain('[REDACTED_GITHUB_TOKEN]');

    // 2. Check rawOutputRedacted field
    expect(record.rawOutputRedacted).not.toContain(mockBearerAuth);
    expect(record.rawOutputRedacted).not.toContain(mockGoogleKey);
    expect(record.rawOutputRedacted).toContain('[REDACTED_HIGH_ENTROPY]');
    expect(record.rawOutputRedacted).toContain('[REDACTED_GOOGLE_KEY]');

    // 3. Check fix.commands field
    expect(record.fix.commands[0]).not.toContain(mockAwsKey);
    expect(record.fix.commands[0]).toContain('[REDACTED_AWS_KEY]');
    expect(record.fix.commands[1]).not.toContain(mockSlackToken);
    expect(record.fix.commands[1]).toContain('[REDACTED_SLACK_TOKEN]');

    // 4. Check fix.explanation field
    expect(record.fix.explanation).not.toContain(mockGithubPat);
    expect(record.fix.explanation).not.toContain(mockSlackToken);
    expect(record.fix.explanation).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(record.fix.explanation).toContain('[REDACTED_ENV_SECRET]');

    // 5. Check tags field
    expect(record.tags[0]).not.toContain(mockAwsKey);
    expect(record.tags[0]).toContain('[REDACTED_AWS_KEY]');
    expect(record.tags[1]).toBe('ci-fix');

    // 6. Inspect canonical JSONL on disk directly
    const jsonlPath = path.join(tmpDir, '.agent-memory', 'records.jsonl');
    const diskContent = fs.readFileSync(jsonlPath, 'utf8');
    expect(diskContent).not.toContain(mockGithubPat);
    expect(diskContent).not.toContain(mockSlackToken);
    expect(diskContent).not.toContain(mockAwsKey);
    expect(diskContent).not.toContain(mockGoogleKey);
  });

  it('redacts sensitive tokens in findFix queries and matches successfully', async () => {
    // Record a failure containing a sensitive token in command and output
    await service.recordFailure({
      command: `npm test --token=${mockGithubPat}`,
      exitCode: 1,
      output: 'Error: Cannot find module lodash at line 42',
      fixCommands: ['npm install lodash'],
      explanation: 'Missing lodash dependency. Run npm install lodash.',
    });

    // Query findFix with identical sanitized command and error
    const query = await service.findFix({
      command: `npm test --token=${mockGithubPat}`,
      output: 'Error: Cannot find module lodash at line 42',
    });

    expect(query.matches.length).toBeGreaterThan(0);
    // Ensure returned envelopes contain no leaked query secrets
    for (const match of query.matches) {
      expect(match.sanitizationEnvelope).not.toContain(mockGithubPat);
      expect(match.sanitizationEnvelope).toContain('[REDACTED_GITHUB_TOKEN]');
    }
  });

  it('redacts sensitive tokens in verifyFix proposedCommand and approval queue', async () => {
    const result = await service.verifyFix({
      command: `npm test --token=${mockGithubPat}`,
      dryRun: false,
    });

    expect(result.status).toBe('pending_approval');
    expect(result.proposedCommand).toBeDefined();
    expect(result.proposedCommand).not.toContain(mockGithubPat);
    expect(result.proposedCommand).toContain('[REDACTED_GITHUB_TOKEN]');

    // Verify approvals-pending.jsonl on disk does not contain the secret
    const pendingPath = path.join(tmpDir, '.agent-memory', 'approvals-pending.jsonl');
    if (fs.existsSync(pendingPath)) {
      const pendingContent = fs.readFileSync(pendingPath, 'utf8');
      expect(pendingContent).not.toContain(mockGithubPat);
      expect(pendingContent).toContain('[REDACTED_GITHUB_TOKEN]');
    }
  });
});
