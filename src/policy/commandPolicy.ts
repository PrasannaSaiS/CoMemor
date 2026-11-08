/**
 * Command Policy & Sandboxed Execution Engine.
 * Phase 4 implementation.
 *
 * ADR-006 compliant.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import { redactSensitiveData } from '../core/redact.js';
import { appendLockedJsonlSync } from '../storage/jsonl.js';
import type { Risk, VerifyFixOutput } from '../types.js';

export const ALLOWED_BINARIES = new Set([
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'bunx',
  'cargo',
  'pytest',
  'python',
  'python3',
  'go',
  'vitest',
  'tsc',
]);

const FORBIDDEN_SHELL_PATTERNS = [
  /[;&|]/, // Chaining, background, pipes
  /[><]/, // Redirection
  /\$\(/, // Command substitution $(...)
  /`/, // Backticks
  /[\r\n]/, // Newlines
];

const DESTRUCTIVE_COMMAND_PATTERNS = [
  /\brm\b/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b/i,
  /\bnpm\s+publish\b/i,
];

export interface ParsedCommand {
  binary: string;
  args: string[];
}

export interface ApprovalRecord {
  approvalId: string;
  createdAt: string;
  command: string;
  decision: 'approve' | 'reject';
  resolvedBy?: string;
  resolvedAt?: string;
}

export class CommandPolicyEngine {
  private workspaceRoot: string;
  private memoryDir: string;

  constructor(workspaceRoot: string, memoryDir?: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.memoryDir = memoryDir ?? path.join(this.workspaceRoot, '.agent-memory');
  }

  /**
   * Validates command against metacharacters, destructive commands, allowlisted binaries,
   * and path traversal outside workspace.
   */
  validateCommand(commandString: string): {
    allowed: boolean;
    reason?: string;
    parsed?: ParsedCommand;
    risk: Risk;
  } {
    if (!commandString || commandString.trim().length === 0) {
      return { allowed: false, reason: 'Empty command string', risk: 'high' };
    }

    const trimmed = commandString.trim();

    // 1. Check for forbidden shell metacharacters
    for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          reason: 'Shell metacharacters and chaining (; & | > < ` $) are strictly prohibited',
          risk: 'high',
        };
      }
    }

    // 2. Check for destructive commands
    for (const pattern of DESTRUCTIVE_COMMAND_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          reason: 'Destructive commands are permanently disallowed',
          risk: 'high',
        };
      }
    }

    // 3. Parse binary and arguments without shell evaluation
    const parts = trimmed.split(/\s+/);
    const rawBinary = parts[0] ?? '';
    const binary = path
      .basename(rawBinary)
      .toLowerCase()
      .replace(/\.(exe|cmd|bat|sh)$/i, '');
    const args = parts.slice(1);

    if (!ALLOWED_BINARIES.has(binary)) {
      return {
        allowed: false,
        reason: `Binary '${binary}' is not in the allowed execution list (${Array.from(ALLOWED_BINARIES).join(', ')})`,
        risk: 'high',
      };
    }

    // 4. Path containment checks on all arguments
    for (const arg of args) {
      const candidates = arg.includes('=') ? [arg.slice(arg.indexOf('=') + 1)] : [arg];
      for (const cand of candidates) {
        if (cand.startsWith('http://') || cand.startsWith('https://')) continue;
        if (cand.startsWith('-') && !cand.includes('/') && !cand.includes('\\')) continue;

        const isPathLike =
          cand.includes('/') ||
          cand.includes('\\') ||
          cand.includes('..') ||
          path.isAbsolute(cand) ||
          /^[a-zA-Z]:[\\/]/.test(cand);

        if (isPathLike) {
          const resolved = path.resolve(this.workspaceRoot, cand);
          const relative = path.relative(this.workspaceRoot, resolved);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return {
              allowed: false,
              reason: `Workspace escape attempt detected in argument: '${arg}' (resolves outside workspace root)`,
              risk: 'high',
            };
          }
        }
      }
    }

    // 5. Determine risk level
    let risk: Risk = 'low';
    if (binary === 'cargo' && args.includes('build')) risk = 'medium';
    if (binary === 'npm' && (args.includes('install') || args.includes('i'))) risk = 'medium';

    return {
      allowed: true,
      parsed: { binary, args },
      risk,
    };
  }

  /**
   * Checks if an execution has been explicitly approved in .agent-memory/approvals-resolved.jsonl.
   * Hardened against malformed JSON lines and approval ID hijacking.
   */
  hasResolvedApproval(commandString: string, approvalId?: string): boolean {
    const resolvedPath = path.join(this.memoryDir, 'approvals-resolved.jsonl');
    if (!fs.existsSync(resolvedPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          const parsed: unknown = JSON.parse(line);
          if (typeof parsed !== 'object' || parsed === null) {
            continue;
          }
          const record = parsed as Record<string, unknown>;
          if (
            typeof record.command !== 'string' ||
            typeof record.approvalId !== 'string' ||
            (record.decision !== 'approve' && record.decision !== 'reject')
          ) {
            continue; // Skip malformed lines
          }

          if (record.decision === 'approve') {
            const commandMatches = record.command.trim() === commandString.trim();
            if (approvalId) {
              if (record.approvalId === approvalId && commandMatches) {
                return true;
              }
            } else if (commandMatches) {
              return true;
            }
          }
        } catch {
          // Skip corrupted line and continue evaluating
          continue;
        }
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * Queues an approval request in .agent-memory/approvals-pending.jsonl.
   */
  queueApproval(commandString: string, risk: Risk, recordId?: string): string {
    const pendingPath = path.join(this.memoryDir, 'approvals-pending.jsonl');
    const dir = path.dirname(pendingPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const approvalId = `appr_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const entry = {
      approvalId,
      createdAt: new Date().toISOString(),
      requestedCommand: commandString,
      recordId: recordId ?? null,
      risk,
      reason: 'Requires human operator approval before live execution',
      status: 'pending',
    };

    appendLockedJsonlSync(pendingPath, entry);
    return approvalId;
  }

  /**
   * Executes a command within sandboxed constraints:
   * - No shell string execution (`shell: false`)
   * - Sanitized environment (credentials removed)
   * - Strict timeout (default 30s)
   * - Output buffer cap (64KB)
   * - Secret redaction on outputs
   */
  async executeSandboxed(
    parsed: ParsedCommand,
    timeoutMs = 30000,
    maxOutputBytes = 65536,
  ): Promise<{ exitCode: number; stdout: string; stderr: string; executionTimeMs: number }> {
    const start = performance.now();

    // Sanitize environment variables
    const safeEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!value) continue;
      // Scrub potential secrets from inherited environment
      if (
        /TOKEN|KEY|SECRET|PASSWORD|AUTH|CREDENTIAL/i.test(key) &&
        !key.startsWith('npm_config_')
      ) {
        continue;
      }
      safeEnv[key] = value;
    }

    return new Promise((resolve) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let completed = false;

      // On Windows, node npm/npx/yarn/pnpm commands need shell: true or the .cmd extension
      let cmdBinary = parsed.binary;
      let cmdShell = false;
      if (process.platform === 'win32' && ['npm', 'npx', 'yarn', 'pnpm'].includes(parsed.binary)) {
        cmdBinary = `${parsed.binary}.cmd`;
      }

      const child = spawn(cmdBinary, parsed.args, {
        cwd: this.workspaceRoot,
        env: safeEnv,
        shell: cmdShell,
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 1000);
          resolve({
            exitCode: -1,
            stdout: redactSensitiveData(stdoutBuffer),
            stderr: redactSensitiveData(
              `${stderrBuffer}\n[EXECUTION TIMEOUT after ${String(timeoutMs)}ms]`,
            ),
            executionTimeMs: Math.round(performance.now() - start),
          });
        }
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        if (stdoutBuffer.length < maxOutputBytes) {
          stdoutBuffer += chunk.toString('utf8');
          if (stdoutBuffer.length >= maxOutputBytes) {
            stdoutBuffer += '\n[OUTPUT TRUNCATED: Exceeded 64KB cap]';
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        if (stderrBuffer.length < maxOutputBytes) {
          stderrBuffer += chunk.toString('utf8');
          if (stderrBuffer.length >= maxOutputBytes) {
            stderrBuffer += '\n[OUTPUT TRUNCATED: Exceeded 64KB cap]';
          }
        }
      });

      child.on('error', (err) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          resolve({
            exitCode: -1,
            stdout: redactSensitiveData(stdoutBuffer),
            stderr: redactSensitiveData(`${stderrBuffer}\n${String(err)}`),
            executionTimeMs: Math.round(performance.now() - start),
          });
        }
      });

      child.on('close', (code) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          resolve({
            exitCode: code ?? 0,
            stdout: redactSensitiveData(stdoutBuffer),
            stderr: redactSensitiveData(stderrBuffer),
            executionTimeMs: Math.round(performance.now() - start),
          });
        }
      });
    });
  }

  /**
   * Evaluates and optionally runs verify_fix.
   * By default dry-run is required. Live execution requires resolved approval.
   */
  async verifyFix(
    commandString: string,
    dryRun = true,
    recordId?: string,
  ): Promise<VerifyFixOutput> {
    const policy = this.validateCommand(commandString);

    if (!policy.allowed || !policy.parsed) {
      return {
        status: 'dry_run_denied',
        policyReason: policy.reason ?? 'Command violates safety policy',
      };
    }

    if (dryRun) {
      return {
        status: 'dry_run_allowed',
        policyReason: `Command allowed under dry-run policy (Risk: ${policy.risk})`,
      };
    }

    // Live execution requested: strictly verify human approval in approvals-resolved.jsonl
    const isApproved = this.hasResolvedApproval(commandString);
    if (!isApproved) {
      const approvalId = this.queueApproval(commandString, policy.risk, recordId);
      return {
        status: 'pending_approval',
        approvalId,
        policyReason:
          'Live execution is not approved. Request has been queued in approvals-pending.jsonl. An operator must resolve it in approvals-resolved.jsonl.',
      };
    }

    // Execute sandboxed
    const result = await this.executeSandboxed(policy.parsed);
    return {
      status: result.exitCode === 0 ? 'passed' : 'failed',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      executionTimeMs: result.executionTimeMs,
    };
  }
}
