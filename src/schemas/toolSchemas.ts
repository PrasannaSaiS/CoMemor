/**
 * JSON Schema definitions for CoMemor tools.
 * Conforms to JSON Schema Draft-07 / MCP specification.
 *
 * String length limits mirror src/schemas/validation.ts constants.
 */

export interface ToolInputSchema {
  [x: string]: unknown;
  type: 'object';
  properties?: Record<string, object>;
  required?: string[];
  additionalProperties?: boolean;
}

export const RECORD_FAILURE_SCHEMA: ToolInputSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'The exact failing command executed (e.g. "npm test", "cargo test").',
      maxLength: 1024,
    },
    exitCode: {
      type: 'integer',
      description: 'The process exit code returned by the command.',
    },
    output: {
      type: 'string',
      description: 'The raw error trace, stderr, or build output.',
      maxLength: 128000,
    },
    fixCommands: {
      type: 'array',
      items: { type: 'string', maxLength: 1024 },
      description: 'List of allowlisted remediation commands that resolved or resolve the issue.',
      maxItems: 20,
    },
    explanation: {
      type: 'string',
      description: 'Human-readable explanation of why the failure occurred and why the fix works.',
      maxLength: 32000,
    },
    risk: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      default: 'low',
      description: 'Risk assessment level of applying this fix.',
    },
    tags: {
      type: 'array',
      items: { type: 'string', maxLength: 128 },
      description: 'Categorization tags (e.g. ["typescript", "vitest", "deps"]).',
      maxItems: 50,
    },
    supersedesId: {
      type: 'string',
      description: 'Optional ID of an older record superseded by this new fix.',
      maxLength: 128,
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
      maxLength: 1024,
    },
    output: {
      type: 'string',
      description: 'The error trace or failing output to match against historical memories.',
      maxLength: 128000,
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
      description: 'Optional record ID associated with the fix proposal being evaluated.',
    },
    command: {
      type: 'string',
      description:
        'The proposed remediation command to validate against safety policy. CoMemor never executes this command — the structured proposal is returned for the host agent or IDE to execute under its own confirmation mechanism.',
    },
    dryRun: {
      type: 'boolean',
      default: true,
      description:
        'If true (default), validates the command against policy and returns a structured proposal without queuing an approval entry. If false, additionally logs the proposal to approvals-pending.jsonl for operator audit. No execution occurs in either case.',
    },
    allowApprovalQueue: {
      type: 'boolean',
      default: true,
      description:
        'If true, allows logging a dryRun:false proposal to approvals-pending.jsonl as an audit trail entry. This entry does not authorize execution — it is a read-only audit record for the operator dashboard.',
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
