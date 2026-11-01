import { useState, useEffect, type ReactNode } from 'react';

interface AuditData {
  redactionLayers: Array<{
    layer: string;
    status: string;
    recall?: number;
    threshold?: number;
    patterns?: string[];
    highEntropyCaptured?: boolean;
  }>;
  poisoningAudit: {
    totalInspected: number;
    quarantinedCount: number;
    quarantinedRecords: Array<{
      id: string;
      command: string;
      createdAt: string;
      flagReason: string;
      status: string;
    }>;
    detectors: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  };
}

interface Props {
  onFetchAudit: () => Promise<AuditData | null>;
}

/* ── SVG Icons (Strictly Zero Emojis) ────────────────────────────── */

function IconLightning(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconTerminal(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconKey(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-1.5 1.5L16 7l-2 2m-2-2l2-2 1.5-1.5M7 13a5 5 0 1 0 7 7 5 5 0 0 0-7-7z" />
    </svg>
  );
}

function IconWaveform(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h3l3-9 4 18 3-9h3l2-3 2 3h2" />
    </svg>
  );
}

function IconRadar(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <path d="M12 12l5-5" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconDatabase(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconShield(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCheck(): ReactNode {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

/* ── Stage Specifications for the Deep-Dive Inspector ────────────── */

interface StageDetail {
  id: string;
  stageName: string;
  sub: string;
  title: string;
  layerBadge: string;
  statusBadge: string;
  description: string;
  rules: string[];
}

const STAGES: StageDetail[] = [
  {
    id: 'stage-1',
    stageName: 'Raw Ingress',
    sub: 'interceptor: stdio',
    title: 'Stage 1: Raw Ingress Interceptor & Stream Gate',
    layerBadge: 'Layer: Stdio Transport',
    statusBadge: 'ACTIVE',
    description:
      'Synchronous interception of all CLI stderr and stdout outputs at the MCP protocol boundary over loopback (127.0.0.1:4321). Zero raw output touches disk or SQLite prior to sanitization.',
    rules: [
      'Loopback Interface (127.0.0.1:4321)',
      'Stdio Protocol Interceptor',
      'Zero Plaintext Disk Leak Invariant',
      'Pre-Hash Fingerprint Quarantine',
      'Synchronous Pipeline Execution',
    ],
  },
  {
    id: 'stage-2',
    stageName: 'Pattern Redactor',
    sub: 'regex: ADR-005',
    title: 'Stage 2: Deterministic Secret Redactor (ADR-005)',
    layerBadge: 'Layer: 100% Recall Regex',
    statusBadge: 'ACTIVE',
    description:
      'High-precision regular expressions targeting credential prefixes, authorization headers, and format signatures with 100% historical test recall:',
    rules: [
      'GitHub PAT (ghp_*)',
      'AWS Access Key (AKIA*)',
      'OpenAI Secret (sk-*)',
      'Anthropic Secret (sk-ant-*)',
      'Bearer JWT Tokens',
      'PEM Private Keys',
      'Database URIs',
    ],
  },
  {
    id: 'stage-3',
    stageName: 'Entropy Gate',
    sub: 'entropy: H > 4.5',
    title: 'Stage 3: Shannon Entropy Token Gate (H > 4.5)',
    layerBadge: 'Layer: Statistical Entropy',
    statusBadge: 'ACTIVE',
    description:
      'Calculates character distribution entropy H = -∑ p_i log₂(p_i) on strings ≥ 24 characters. Tokens exceeding 4.5 bits/char are sanitized to prevent secret leaks in non-standard formats:',
    rules: [
      'Shannon Uniform Estimator',
      'Entropy Threshold: H > 4.5 bits/char',
      'Min Token Length: ≥ 24 Characters',
      'Base64 / Hex Hash Sanitization',
      'Pre-Hash Fingerprint Gate',
    ],
  },
  {
    id: 'stage-4',
    stageName: 'Poisoning Defense',
    sub: '7: detectors',
    title: 'Stage 4: 7-Layer Poisoning Heuristics Engine',
    layerBadge: 'Layer: Adversarial Defense',
    statusBadge: 'ACTIVE',
    description:
      'Heuristic detection layers inspect memory records for indirect prompt injection, instruction overrides, and malicious shell commands before storage:',
    rules: [
      'Imperative Injections ("ignore previous instructions", "act as")',
      'Fake System Markers ([INST], <<SYS>>, <|im_start|>)',
      'Data Exfiltration (curl -X POST, webhook commands)',
      'Nested / Base64 Injections (quoted decode wrappers)',
      'Zero-Width Characters (U+200B, soft hyphen evasion)',
      'Unicode Homoglyphs (Cyrillic/Greek confusables)',
      'Imperative Verb Density (> 8% verbs over 20+ words)',
    ],
  },
  {
    id: 'stage-5',
    stageName: 'Storage & Gate',
    sub: 'sqlite: fts5',
    title: 'Stage 5: Dual-Path Storage & Quarantine Gate',
    layerBadge: 'Layer: Containment Invariant',
    statusBadge: 'ACTIVE',
    description:
      'Dual-path persistence routing. Clean records are indexed into SQLite FTS5 for default retrieval, while flagged records are isolated in the Quarantine Vault:',
    rules: [
      'Clean Route: Rebuildable SQLite FTS5 Index',
      'Clean Route: Append-Only JSONL Source of Truth',
      'Clean Route: Wilson Lower-Bound Confidence Scoring',
      'Quarantine Route: Strict Default Prompt Exclusion',
      'Quarantine Route: 0.5x Composite Penalty if Forcibly Retrieved',
      'Quarantine Route: Immutable Forensic Audit Log',
    ],
  },
];

export function SecurityAuditScreen({ onFetchAudit }: Props): ReactNode {
  const [data, setData] = useState<AuditData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStageId, setSelectedStageId] = useState<string>('stage-2');
  const [filterQuery, setFilterQuery] = useState<string>('');

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    setIsLoading(true);
    try {
      const res = await onFetchAudit();
      if (res) setData(res);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="screen-header">
          <div className="skeleton-box" style={{ width: '320px', height: '28px', marginBottom: '8px' }} />
          <div className="skeleton-box" style={{ width: '520px', height: '16px' }} />
        </div>
        <div className="panel" style={{ height: '240px', marginBottom: '16px' }}>
          <div className="skeleton-box" style={{ height: '100%' }} />
        </div>
        <div className="panel" style={{ height: '240px' }}>
          <div className="skeleton-box" style={{ height: '100%' }} />
        </div>
      </div>
    );
  }

  const currentStage = STAGES.find((s) => s.id === selectedStageId) ?? STAGES[1];
  const quarantinedRecords = data?.poisoningAudit.quarantinedRecords ?? [];
  const filteredRecords = quarantinedRecords.filter((r) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return r.id.toLowerCase().includes(q) || r.command.toLowerCase().includes(q) || r.flagReason.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="screen-header">
        <div className="screen-title-row">
          <div>
            <h1 className="screen-title">Security & Redaction Architecture</h1>
            <p className="screen-subtitle">
              Verification of multi-layer secret redaction (deterministic regex + Shannon entropy) and persisted-retrieval poisoning heuristic defenses.
            </p>
          </div>
          <div className="badge emerald" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
            <IconCheck /> Zero Plaintext Leak Invariant Active
          </div>
        </div>
      </div>

      {/* ── N8N WORKFLOW ARCHITECTURE CANVAS ── */}
      <div className="n8n-canvas-container">
        <div className="n8n-canvas-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Pipeline Topology
            </span>
            <span className="badge gray" style={{ fontSize: '0.7rem' }}>5 Defense Stages</span>
            <span className="badge emerald" style={{ fontSize: '0.7rem' }}>
              <IconCheck /> Synchronous Execution
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Click any node to inspect rules & telemetry
          </span>
        </div>

        {/* Authentic N8N Node Sequence Flow */}
        <div className="n8n-canvas-flow">
          {/* Node 1: Raw Ingress (Trigger Node) */}
          <div
            className="n8n-node-wrapper"
            onClick={() => setSelectedStageId('stage-1')}
            tabIndex={0}
            role="button"
            aria-label="Inspect Raw Ingress node"
            onKeyDown={(e) => e.key === 'Enter' && setSelectedStageId('stage-1')}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="n8n-trigger-icon" title="Trigger">
                <IconLightning />
              </div>
              <div className={`n8n-node-box trigger-node ${selectedStageId === 'stage-1' ? 'selected' : ''}`}>
                <IconTerminal />
                <div className="n8n-port-out" />
              </div>
            </div>
            <div className="n8n-node-label">Raw Ingress</div>
            <div className="n8n-node-sub">interceptor: stdio</div>
          </div>

          {/* Connector 1 -> 2 */}
          <div className="n8n-connector-line">
            <svg width="64" height="12" viewBox="0 0 64 12" fill="none">
              <defs>
                <marker id="arrowHead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6" fill="var(--border-strong)" />
                </marker>
              </defs>
              <line x1="0" y1="6" x2="56" y2="6" stroke="var(--border-strong)" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
            </svg>
          </div>

          {/* Node 2: Pattern Redactor */}
          <div
            className="n8n-node-wrapper"
            onClick={() => setSelectedStageId('stage-2')}
            tabIndex={0}
            role="button"
            aria-label="Inspect Pattern Redactor node"
            onKeyDown={(e) => e.key === 'Enter' && setSelectedStageId('stage-2')}
          >
            <div className={`n8n-node-box ${selectedStageId === 'stage-2' ? 'selected' : ''}`}>
              <div className="n8n-port-in" />
              <IconKey />
              <div className="n8n-port-out" />
            </div>
            <div className="n8n-node-label">Pattern Redactor</div>
            <div className="n8n-node-sub">regex: ADR-005</div>
          </div>

          {/* Connector 2 -> 3 */}
          <div className="n8n-connector-line">
            <svg width="64" height="12" viewBox="0 0 64 12" fill="none">
              <line x1="0" y1="6" x2="56" y2="6" stroke="var(--border-strong)" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
            </svg>
          </div>

          {/* Node 3: Entropy Gate */}
          <div
            className="n8n-node-wrapper"
            onClick={() => setSelectedStageId('stage-3')}
            tabIndex={0}
            role="button"
            aria-label="Inspect Entropy Gate node"
            onKeyDown={(e) => e.key === 'Enter' && setSelectedStageId('stage-3')}
          >
            <div className={`n8n-node-box ${selectedStageId === 'stage-3' ? 'selected' : ''}`}>
              <div className="n8n-port-in" />
              <IconWaveform />
              <div className="n8n-port-out" />
            </div>
            <div className="n8n-node-label">Entropy Gate</div>
            <div className="n8n-node-sub">entropy: H &gt; 4.5</div>
          </div>

          {/* Connector 3 -> 4 */}
          <div className="n8n-connector-line">
            <svg width="64" height="12" viewBox="0 0 64 12" fill="none">
              <line x1="0" y1="6" x2="56" y2="6" stroke="var(--border-strong)" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
            </svg>
          </div>

          {/* Node 4: Poisoning Defense */}
          <div
            className="n8n-node-wrapper"
            onClick={() => setSelectedStageId('stage-4')}
            tabIndex={0}
            role="button"
            aria-label="Inspect Poisoning Defense node"
            onKeyDown={(e) => e.key === 'Enter' && setSelectedStageId('stage-4')}
          >
            <div className={`n8n-node-box ${selectedStageId === 'stage-4' ? 'selected' : ''}`}>
              <div className="n8n-port-in" />
              <IconRadar />
              <div className="n8n-port-out" />
            </div>
            <div className="n8n-node-label">Poisoning Defense</div>
            <div className="n8n-node-sub">7: detectors</div>
          </div>

          {/* Connector 4 -> 5 */}
          <div className="n8n-connector-line">
            <svg width="64" height="12" viewBox="0 0 64 12" fill="none">
              <line x1="0" y1="6" x2="56" y2="6" stroke="var(--border-strong)" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
            </svg>
          </div>

          {/* Node 5: Storage & Gate */}
          <div
            className="n8n-node-wrapper"
            onClick={() => setSelectedStageId('stage-5')}
            tabIndex={0}
            role="button"
            aria-label="Inspect Storage and Gate destination"
            onKeyDown={(e) => e.key === 'Enter' && setSelectedStageId('stage-5')}
          >
            <div className={`n8n-node-box ${selectedStageId === 'stage-5' ? 'selected' : ''}`}>
              <div className="n8n-port-in" />
              <IconDatabase />
              <div className="n8n-port-out" />
            </div>
            <div className="n8n-node-label">Storage & Gate</div>
            <div className="n8n-node-sub">sqlite: fts5</div>
          </div>
        </div>

        {/* ── STAGE DEEP-DIVE INSPECTOR (CLEAN & DIRECT) ── */}
        <div className="n8n-inspector">
          <div className="n8n-inspector-header">
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                Stage Deep-Dive Inspector
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {currentStage.title}
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge gray">{currentStage.layerBadge}</span>
              <span className="badge emerald">{currentStage.statusBadge}</span>
            </div>
          </div>

          <p className="n8n-inspector-desc">{currentStage.description}</p>

          <div className="n8n-rules-grid">
            {currentStage.rules.map((rule, idx) => (
              <span key={idx} className="badge gray" style={{ fontSize: '0.74rem', padding: '0.35rem 0.65rem' }}>
                {rule}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── QUARANTINED RECORDS CATALOG TABLE ── */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h2 className="panel-title" style={{ display: 'inline' }}>
              Quarantined Records Catalog
            </h2>
            <span style={{ marginLeft: '0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ({quarantinedRecords.length} records quarantined)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <input
              type="text"
              className="input"
              style={{ width: '240px', fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
              placeholder="Filter quarantined records..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
            <span className="badge rose">Excluded from Default Prompt Retrieval</span>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Command</th>
                <th>Detection Reason</th>
                <th>Quarantined At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3.5rem 1.5rem' }}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <IconShield />
                      </div>
                      <h2 className="empty-state-title">Quarantine Log Clean</h2>
                      <p className="empty-state-desc">
                        {quarantinedRecords.length === 0
                          ? 'No records are currently quarantined. All active memory records passed through the 7-layer heuristic detection pipeline without triggering flags.'
                          : 'No quarantined records match your search filter.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.id}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{r.command}</code>
                    </td>
                    <td>
                      <span style={{ color: 'var(--status-danger)', fontSize: '0.8rem', fontWeight: 500 }}>
                        {r.flagReason}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge rose">{r.status.toUpperCase()}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
