import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { validateStartupEnvironment } from '../../src/server.js';

describe('Startup Environment Validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-memory-startup-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('succeeds with default environment values', () => {
    const config = validateStartupEnvironment({});
    expect(config.memoryDir).toBe(path.join(process.cwd(), '.agent-memory'));
    expect(config.repositoryId).toBe(path.basename(process.cwd()));
  });

  it('succeeds with valid explicit AGENT_MEMORY_DIR and AGENT_MEMORY_REPO', () => {
    const targetDir = path.join(tmpDir, 'custom-memory');
    fs.mkdirSync(targetDir, { recursive: true });

    const config = validateStartupEnvironment({
      AGENT_MEMORY_DIR: targetDir,
      AGENT_MEMORY_REPO: 'custom-repo-name',
    });

    expect(config.memoryDir).toBe(path.resolve(targetDir));
    expect(config.repositoryId).toBe('custom-repo-name');
  });

  it('succeeds when AGENT_MEMORY_DIR does not exist yet but parent does', () => {
    const targetDir = path.join(tmpDir, 'will-be-created-later');
    expect(fs.existsSync(targetDir)).toBe(false);

    const config = validateStartupEnvironment({
      AGENT_MEMORY_DIR: targetDir,
      AGENT_MEMORY_REPO: 'test-repo',
    });

    expect(config.memoryDir).toBe(path.resolve(targetDir));
  });

  it('fails with structured stderr when AGENT_MEMORY_REPO is empty string', () => {
    const stderrMessages: string[] = [];
    expect(() => {
      validateStartupEnvironment(
        { AGENT_MEMORY_REPO: '   ' },
        { exitOnError: false, stderrWrite: (msg) => stderrMessages.push(msg) },
      );
    }).toThrow(/AGENT_MEMORY_REPO/);

    expect(stderrMessages.length).toBe(1);
    const parsed = JSON.parse(stderrMessages[0]!);
    expect(parsed.error).toBe('startup_validation_failed');
    expect(parsed.field).toBe('AGENT_MEMORY_REPO');
    expect(parsed.message).toContain('non-empty string');
    expect(parsed.timestamp).toBeDefined();
  });

  it('fails with structured stderr when AGENT_MEMORY_DIR is empty string', () => {
    const stderrMessages: string[] = [];
    expect(() => {
      validateStartupEnvironment(
        { AGENT_MEMORY_DIR: '   ' },
        { exitOnError: false, stderrWrite: (msg) => stderrMessages.push(msg) },
      );
    }).toThrow(/AGENT_MEMORY_DIR/);

    expect(stderrMessages.length).toBe(1);
    const parsed = JSON.parse(stderrMessages[0]!);
    expect(parsed.error).toBe('startup_validation_failed');
    expect(parsed.field).toBe('AGENT_MEMORY_DIR');
    expect(parsed.message).toContain('non-empty string');
  });

  it('fails with structured stderr when AGENT_MEMORY_DIR is an existing regular file', () => {
    const filePath = path.join(tmpDir, 'not-a-directory.txt');
    fs.writeFileSync(filePath, 'hello', 'utf8');

    const stderrMessages: string[] = [];
    expect(() => {
      validateStartupEnvironment(
        { AGENT_MEMORY_DIR: filePath },
        { exitOnError: false, stderrWrite: (msg) => stderrMessages.push(msg) },
      );
    }).toThrow(/not a directory/);

    expect(stderrMessages.length).toBe(1);
    const parsed = JSON.parse(stderrMessages[0]!);
    expect(parsed.error).toBe('startup_validation_failed');
    expect(parsed.field).toBe('AGENT_MEMORY_DIR');
    expect(parsed.message).toContain('not a directory');
  });

  it('fails with structured stderr when AGENT_MEMORY_DIR parent does not exist', () => {
    const nonExistentParent = path.join(tmpDir, 'nonexistent-parent', 'sub-dir');

    const stderrMessages: string[] = [];
    expect(() => {
      validateStartupEnvironment(
        { AGENT_MEMORY_DIR: nonExistentParent },
        { exitOnError: false, stderrWrite: (msg) => stderrMessages.push(msg) },
      );
    }).toThrow(/Parent directory/);

    expect(stderrMessages.length).toBe(1);
    const parsed = JSON.parse(stderrMessages[0]!);
    expect(parsed.error).toBe('startup_validation_failed');
    expect(parsed.field).toBe('AGENT_MEMORY_DIR');
    expect(parsed.message).toContain('Parent directory for AGENT_MEMORY_DIR does not exist');
  });

  it('terminates process with exit code 1 and emits structured JSON to stderr in CLI startup mode', () => {
    const regularFile = path.join(tmpDir, 'regular-file.txt');
    fs.writeFileSync(regularFile, 'hello', 'utf8');

    // Run node executing a script that imports and starts the server with invalid env
    const script = `
      import { validateStartupEnvironment } from './dist/server.js';
      validateStartupEnvironment(process.env, { exitOnError: true });
    `;

    const result = spawnSync('node', ['--input-type=module', '-e', script], {
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        AGENT_MEMORY_DIR: regularFile,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe(''); // Crucial stdio invariant: stdout must remain clean
    expect(result.stderr).toContain('"error":"startup_validation_failed"');
    expect(result.stderr).toContain('"field":"AGENT_MEMORY_DIR"');
    const parsed = JSON.parse(result.stderr.trim().split('\n')[0]!);
    expect(parsed.error).toBe('startup_validation_failed');
    expect(parsed.field).toBe('AGENT_MEMORY_DIR');
  }, 15000);
});
