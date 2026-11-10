/**
 * Dashboard Bridge HTTP + SSE Server.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Binds strictly to 127.0.0.1 (local trust boundary only).
 * 2. Separate process from MCP server — never writes to MCP stdout.
 * 3. Read-only against SQLite and logs.
 * 4. Zero command execution capability — only permitted mutation is appending
 *    human decisions to .agent-memory/approvals-resolved.jsonl.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BridgeStorage } from './db.js';
import { LogTailer } from './tail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Workspace root discovery: look for .agent-memory directory
export function findMemoryDir(explicitDir?: string): string {
  if (explicitDir && fs.existsSync(explicitDir)) {
    return path.resolve(explicitDir);
  }
  if (process.env.AGENT_MEMORY_DIR && fs.existsSync(process.env.AGENT_MEMORY_DIR)) {
    return path.resolve(process.env.AGENT_MEMORY_DIR);
  }

  // CLI argument check: --dir <path>
  const dirArgIdx = process.argv.indexOf('--dir');
  if (dirArgIdx !== -1 && process.argv[dirArgIdx + 1]) {
    const candidate = path.resolve(process.argv[dirArgIdx + 1]!);
    if (fs.existsSync(candidate)) return candidate;
  }

  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(current, '.agent-memory');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // Default to current directory's .agent-memory
  const defaultDir = path.join(process.cwd(), '.agent-memory');
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch {
      // Ignore if read-only filesystem
    }
  }
  return defaultDir;
}

function findFrontendDist(): string | null {
  const candidates = [
    // Running from source: dashboard/bridge/src or dashboard/bridge/dist -> ../../frontend/dist
    path.resolve(__dirname, '../../frontend/dist'),
    // Running from npm package bundle: dashboard/bridge/dist -> ../frontend/dist
    path.resolve(__dirname, '../frontend/dist'),
    // Running from package root
    path.resolve(__dirname, '../../../frontend/dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

export function buildServer(customMemoryDir?: string) {
  const memoryDir = findMemoryDir(customMemoryDir);
  const logFilePath = path.join(memoryDir, 'logs.jsonl');

  const storage = new BridgeStorage(memoryDir);
  const tailer = new LogTailer(logFilePath);

  const fastify = Fastify({
    logger: false, // Don't clutter console output
  });

  fastify.register(cors, {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4321',
      'http://127.0.0.1:4321',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Serve static frontend assets if built
  const frontendDist = findFrontendDist();
  if (frontendDist) {
    fastify.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: Return index.html on direct sub-routes (e.g. /overview, /records)
    fastify.setNotFoundHandler((request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Endpoint not found', path: request.raw.url });
      }
      return reply.sendFile('index.html');
    });
  }

  // 1. Overview stats
  fastify.get('/api/stats', async (request) => {
    const query = request.query as { repositoryId?: string };
    return storage.getStats(query.repositoryId);
  });

  // 2. Records list with filtering
  fastify.get('/api/records', async (request) => {
    const query = request.query as {
      repositoryId?: string;
      commandFamily?: string;
      isQuarantined?: string;
      query?: string;
      limit?: string;
      offset?: string;
    };

    return storage.getRecords({
      repositoryId: query.repositoryId,
      commandFamily: query.commandFamily,
      isQuarantined: query.isQuarantined !== undefined ? query.isQuarantined === 'true' : undefined,
      query: query.query,
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });
  });

  // 3. Record detail by ID
  fastify.get('/api/records/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = storage.getRecordById(id);
    if (!record) {
      return reply.status(404).send({ error: 'Record not found', id });
    }
    return record;
  });

  // 4. Pending approvals queue
  fastify.get('/api/pending-approvals', async () => {
    return storage.getPendingApprovals();
  });

  fastify.get('/api/approvals', async () => {
    return storage.getPendingApprovals();
  });

  fastify.get('/approvals', async (request, reply) => {
    if (
      request.headers.accept &&
      !request.headers.accept.includes('text/html') &&
      request.headers.accept.includes('application/json')
    ) {
      return storage.getPendingApprovals();
    }
    const dist = findFrontendDist();
    if (dist) {
      return reply.sendFile('index.html');
    }
    return storage.getPendingApprovals();
  });

  // 5. Operator approval decision (ONLY permitted mutation).
  // Records the human operator's decision (approve/deny) to approvals-resolved.jsonl.
  // This is an audit log entry ONLY — it does NOT trigger or authorize command execution.
  // CoMemor has no execution capability; actual execution is handled by the host IDE/agent.
  fastify.post('/api/approvals/:id/decision', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as
      | { decision?: 'approve' | 'deny'; operatorNotes?: string }
      | undefined;

    if (!body || !body.decision || (body.decision !== 'approve' && body.decision !== 'deny')) {
      return reply
        .status(400)
        .send({ error: "Invalid body: 'decision' must be 'approve' or 'deny'" });
    }

    const result = storage.resolveApproval(id, body.decision, body.operatorNotes);
    return {
      success: true,
      approvalId: id,
      decision: body.decision,
      resolvedAt: result.resolvedAt,
    };
  });

  // 6. Benchmarks / evaluation data
  fastify.get('/api/benchmarks/latest', async (_request, reply) => {
    const benchmarkPath = path.join(memoryDir, 'benchmarks-latest.json');
    if (fs.existsSync(benchmarkPath)) {
      try {
        return JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
      } catch {}
    }

    // No real benchmark data available yet.
    return reply.status(404).send({
      error: 'No benchmark data available.',
      hint: 'Run the evaluation harness (npm run benchmark:run) to generate real results.',
    });
  });

  // 7. Security & Redaction audit stats
  fastify.get('/api/security-audit', async () => {
    const records = storage.getRecords({ limit: 1000 });
    const quarantined = records.filter((r) => r.isQuarantined);

    return {
      redactionLayers: [
        {
          layer: 'Layer 1: Deterministic Regex Patterns',
          status: 'active',
          patterns: ['GitHub PAT', 'AWS Keys', 'OpenAI/Anthropic Keys', 'JWT', 'PEM'],
          note: 'Pattern coverage is based on known credential formats; novel or custom secret formats may not be caught.',
        },
        {
          layer: 'Layer 2: Shannon Entropy Scoring',
          status: 'active',
          threshold: 4.5,
          highEntropyCaptured: true,
        },
      ],
      poisoningAudit: {
        totalInspected: records.length,
        quarantinedCount: quarantined.length,
        quarantinedRecords: quarantined.map((q) => ({
          id: q.id,
          command: q.command,
          createdAt: q.createdAt,
          flagReason: q.poisoningFlag?.reason ?? 'Unknown injection pattern',
          status: q.poisoningFlag?.status ?? 'reviewed',
        })),
        detectors: [
          { id: 'imperative_injection', name: 'Imperative Prompt Injections', status: 'active' },
          {
            id: 'system_prompt_marker',
            name: 'Fake System Markers (ChatML/INST/SYS)',
            status: 'active',
          },
          { id: 'exfiltration', name: 'Data Exfiltration Signatures', status: 'active' },
          { id: 'nested_injection', name: 'Nested Quoted/Encoded Injections', status: 'active' },
          { id: 'zero_width', name: 'Zero-Width Character Obfuscation', status: 'active' },
          { id: 'homoglyph', name: 'Unicode Homoglyphs (Cyrillic/Greek)', status: 'active' },
          { id: 'imperative_density', name: 'Imperative Verb Density Analysis', status: 'active' },
        ],
        note: 'Poisoning detection uses heuristics. Adversarial records with novel evasion techniques may not be flagged.',
      },
    };
  });

  // 8. Retrieval explainability diagnostic endpoint
  interface ExplainabilityQuery {
    id?: string;
    query?: string;
  }

  fastify.get('/api/explainability', async (request) => {
    const queryParams = request.query as ExplainabilityQuery;
    const records = queryParams.query
      ? storage.getRecords({ query: queryParams.query, limit: 10 })
      : storage.getRecords({ limit: 10 });

    const target = queryParams.id
      ? storage.getRecordById(queryParams.id)
      : queryParams.query && records.length > 0
        ? storage.getRecordById(records[0]!.id)
        : records[0]
          ? storage.getRecordById(records[0].id)
          : null;

    if (records.length === 0) {
      return {
        query: queryParams.query ?? null,
        threshold: 0.65,
        candidates: [],
        note: 'No records found. Record some failures first using the record_failure MCP tool.',
      };
    }

    // Return real record fields where available; similarity scores require the
    // retrieval engine and are not computable in the bridge. Reflect that honestly.
    return {
      query: queryParams.query ?? target?.command ?? null,
      threshold: 0.65,
      candidates: records.slice(0, 5).map((r) => ({
        id: r.id,
        command: r.command,
        commandFamily: r.commandFamily,
        // matchType and similarity are only known by the MCP server retrieval engine
        matchType: null,
        similarityScore: null,
        trustScore: r.wilsonLowerBound ?? null,
        passesThreshold: null,
        passedFilters: null,
        staleReasons: [],
        isStale: false,
        isQuarantined: r.isQuarantined,
        note: 'Similarity scores are computed at retrieval time by the MCP server. Use find_fix to see actual match results.',
      })),
    };
  });

  // 9. SSE live activity stream
  fastify.get('/api/events', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4321');
    reply.raw.flushHeaders?.();

    // Send recent events first
    const recent = tailer.getRecentEvents();
    for (const evt of recent) {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // Keepalive ping every 15 seconds
    const pingInterval = setInterval(() => {
      reply.raw.write(`: ping\n\n`);
    }, 15000);

    const unsubscribe = tailer.subscribe((evt) => {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    });

    request.raw.on('close', () => {
      clearInterval(pingInterval);
      unsubscribe();
    });
  });

  // 10. Benchmark results — served from .agent-memory/benchmark-results.json
  fastify.get('/api/benchmark', async (_request, reply) => {
    const benchPath = path.join(memoryDir, 'benchmark-results.json');
    if (!fs.existsSync(benchPath)) {
      return reply
        .status(404)
        .send({ error: 'Benchmark results not yet available. Run: npm run benchmark:run' });
    }
    try {
      const raw = fs.readFileSync(benchPath, 'utf8');
      const data = JSON.parse(raw) as unknown;
      return reply.send(data);
    } catch {
      return reply.status(500).send({ error: 'benchmark-results.json is malformed' });
    }
  });

  return { fastify, storage, tailer, memoryDir };
}

// Start server when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = parseInt(process.env.BRIDGE_PORT || '4321', 10);
  const host = '127.0.0.1'; // HARD CONSTRAINT: 127.0.0.1 only

  const { fastify, memoryDir } = buildServer();
  fastify.listen({ port, host }, (err, address) => {
    if (err) {
      console.error('Failed to start dashboard bridge:', err);
      process.exit(1);
    }
    console.log(`[Dashboard Bridge] Connected to memory: ${memoryDir}`);
    console.log(`[Dashboard Bridge] Running at ${address} (bound strictly to 127.0.0.1)`);
  });
}
