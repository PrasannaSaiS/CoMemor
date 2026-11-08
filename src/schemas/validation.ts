/**
 * Strict Zod v4 validation schemas for CoMemor tool inputs.
 * Upgraded from Zod v3 — preserves all MCP tool input/output contracts.
 *
 * Key additions (Phase 1 hardening):
 * - max() string length limits to prevent resource exhaustion
 * - max() array limits
 */

import { z } from 'zod';

export const RiskSchema = z.enum(['low', 'medium', 'high']);

// Maximum lengths — tuned to allow realistic error traces while capping abuse
export const MAX_COMMAND_LEN = 1024;
export const MAX_OUTPUT_LEN = 128_000; // 128 KB
export const MAX_EXPLANATION_LEN = 32_000; // 32 KB
export const MAX_FIX_COMMAND_LEN = 1024;
export const MAX_FIX_COMMANDS = 20;
export const MAX_TAG_LEN = 128;
export const MAX_TAGS = 50;
export const MAX_ID_LEN = 128;

export const RecordFailureZodSchema = z.object({
  command: z.string().trim().min(1, 'command cannot be empty').max(MAX_COMMAND_LEN),
  exitCode: z.number().int(),
  output: z.string().min(1, 'output cannot be empty').max(MAX_OUTPUT_LEN),
  fixCommands: z
    .array(z.string().trim().min(1).max(MAX_FIX_COMMAND_LEN))
    .min(1, 'at least one fix command is required')
    .max(MAX_FIX_COMMANDS),
  explanation: z.string().trim().min(1, 'explanation cannot be empty').max(MAX_EXPLANATION_LEN),
  risk: RiskSchema.optional().default('low'),
  tags: z.array(z.string().trim().min(1).max(MAX_TAG_LEN)).max(MAX_TAGS).optional().default([]),
  supersedesId: z.string().max(MAX_ID_LEN).optional(),
});

export const FindFixZodSchema = z.object({
  command: z.string().trim().min(1, 'command cannot be empty').max(MAX_COMMAND_LEN),
  output: z.string().min(1, 'output cannot be empty').max(MAX_OUTPUT_LEN),
  threshold: z.number().min(0).max(1).optional().default(0.65),
  limit: z.number().int().min(1).max(20).optional().default(5),
  includeQuarantined: z.boolean().optional().default(false),
});

export const VerifyFixZodSchema = z.object({
  recordId: z.string().max(MAX_ID_LEN).optional(),
  command: z.string().trim().min(1, 'command cannot be empty').max(MAX_COMMAND_LEN),
  dryRun: z.boolean().optional().default(true),
  allowApprovalQueue: z.boolean().optional().default(true),
});

export const MemoryStatsZodSchema = z.object({
  repositoryId: z.string().max(MAX_ID_LEN).optional(),
});
