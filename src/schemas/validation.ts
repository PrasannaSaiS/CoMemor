/**
 * Strict Zod validation schemas for CoMemor tool inputs.
 */

import { z } from 'zod';

export const RiskSchema = z.enum(['low', 'medium', 'high']);

export const RecordFailureZodSchema = z.object({
  command: z.string().trim().min(1, 'command cannot be empty'),
  exitCode: z.number().int(),
  output: z.string().min(1, 'output cannot be empty'),
  fixCommands: z.array(z.string().trim().min(1)).min(1, 'at least one fix command is required'),
  explanation: z.string().trim().min(1, 'explanation cannot be empty'),
  risk: RiskSchema.optional().default('low'),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  supersedesId: z.string().optional(),
});

export const FindFixZodSchema = z.object({
  command: z.string().trim().min(1, 'command cannot be empty'),
  output: z.string().min(1, 'output cannot be empty'),
  threshold: z.number().min(0).max(1).optional().default(0.65),
  limit: z.number().int().min(1).max(20).optional().default(5),
  includeQuarantined: z.boolean().optional().default(false),
});

export const VerifyFixZodSchema = z.object({
  recordId: z.string().optional(),
  command: z.string().trim().min(1, 'command cannot be empty'),
  dryRun: z.boolean().optional().default(true),
  allowApprovalQueue: z.boolean().optional().default(true),
});

export const MemoryStatsZodSchema = z.object({
  repositoryId: z.string().optional(),
});
