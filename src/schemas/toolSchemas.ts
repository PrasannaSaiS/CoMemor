/**
 * JSON Schema definitions for CoMemor tools.
 * Conforms to JSON Schema Draft-07 / MCP specification.
 */

export interface ToolInputSchema {
  [x: string]: unknown;
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export const RECORD_FAILURE_SCHEMA: ToolInputSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'The exact failing command executed (e.g. "npm test", "cargo test").',
    },
    exitCode: {
      type: 'integer',
      description: 'The process exit code returned by the command.',
    },
    output: {
      type: 'string',
      description: 'The raw error trace, stderr, or build output.',
    },
    fixCommands: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of allowlisted remediation commands that resolved or resolve the issue.',
    },
    explanation: {
      type: 'string',
      description: 'Human-readable explanation of why the failure occurred and why the fix works.',
    },
    risk: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      default: 'low',
      description: 'Risk assessment level of applying this fix.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Categorization tags (e.g. ["typescript", "vitest", "deps"]).',
    },
    supersedesId: {
      type: 'string',
      description: 'Optional ID of an older record superseded by this new fix.',
    },
  },
  required: ['command', 'exitCode', 'output', 'fixCommands', 'explanation'],
  additionalProperties: false,
};

export const FIND_FIX_SCHEMA: ToolInputSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'The failing command to find past remediation for.',
    },
    output: {
      type: 'string',
      description: 'The error trace or failing output to match against historical memories.',
    },
    threshold: {
      type: 'number',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.65,
      description: 'Minimum confidence score threshold for fuzzy matches.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 20,
      default: 5,
      description: 'Maximum number of candidate fixes to return.',
    },
    includeQuarantined: {
      type: 'boolean',
      default: false,
      description: 'Whether to include records flagged by the poisoning heuristic.',
    },
  },
  required: ['command', 'output'],
  additionalProperties: false,
};

export const VERIFY_FIX_SCHEMA: ToolInputSchema = {
  type: 'object',
  properties: {
    recordId: {
      type: 'string',
      description: 'Optional record ID associated with the fix being verified.',
    },
    command: {
      type: 'string',
      description: 'The remediation or test command to run/verify.',
    },
    dryRun: {
      type: 'boolean',
      default: true,
      description: 'If true, checks command policy without executing. Defaults to true for safety.',
    },
    allowApprovalQueue: {
      type: 'boolean',
      default: true,
      description: 'If true, queues medium/high risk commands for human dashboard approval.',
    },
  },
  required: ['command'],
  additionalProperties: false,
};

export const LIST_MEMORY_STATS_SCHEMA: ToolInputSchema = {
  type: 'object',
  properties: {
    repositoryId: {
      type: 'string',
      description: 'Optional repository ID filter.',
    },
  },
  additionalProperties: false,
};
