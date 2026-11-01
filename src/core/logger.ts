/**
 * Structured JSON Logger for CoMemor.
 * Directs logs to stderr AND .agent-memory/logs.jsonl.
 * NEVER writes to stdout (preserves MCP stdio JSON-RPC protocol framing).
 */

import { pino, type DestinationStream } from 'pino';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface LoggerOptions {
  logFilePath?: string;
  level?: string;
  maxLogSizeBytes?: number;
}

/**
 * Rotates log file if it exceeds the specified maximum byte size.
 * Keeps one previous rotated file (.1).
 */
export function rotateLogFileIfNeeded(
  logFilePath: string,
  maxBytes: number = DEFAULT_MAX_LOG_SIZE_BYTES,
): boolean {
  if (!fs.existsSync(logFilePath)) return false;
  try {
    const stat = fs.statSync(logFilePath);
    if (stat.size >= maxBytes) {
      const backupPath = logFilePath + '.1';
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      fs.renameSync(logFilePath, backupPath);
      return true;
    }
  } catch {
    // If rotation fails (e.g. temporary file lock), continue writing to current file
  }
  return false;
}

export function createMemoryLogger(options: LoggerOptions = {}) {
  const level = options.level ?? process.env.LOG_LEVEL ?? 'info';

  const streams: DestinationStream[] = [
    // Destination 1: stderr
    process.stderr,
  ];

  // Destination 2: log file (.agent-memory/logs.jsonl)
  if (options.logFilePath) {
    const dir = path.dirname(options.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    } else {
      rotateLogFileIfNeeded(options.logFilePath, options.maxLogSizeBytes);
    }
    const dest = pino.destination({
      dest: options.logFilePath,
      sync: true,
      mkdir: true,
    });
    streams.push(dest);
  }

  return pino(
    {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        pid: process.pid,
      },
      redact: {
        paths: [
          'password',
          'secret',
          'token',
          'apiKey',
          'authorization',
          '*.password',
          '*.token',
          '*.apiKey',
          '*.secret',
        ],
        censor: '[REDACTED_SECRET]',
      },
    },
    pino.multistream(streams),
  );
}

export type MemoryLogger = ReturnType<typeof createMemoryLogger>;
