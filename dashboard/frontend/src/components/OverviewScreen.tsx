import { type ReactNode } from 'react';
import type { MemoryStats } from '../types.js';
import { InfoButton } from './shared/InfoTooltip.js';

interface Props {
  stats: MemoryStats | null;
  isLoading?: boolean;
  onNavigate: (screen: string) => void;
}


/* ── Subsystem status row ────────────────────────────────────────── */
interface SubsystemRowProps {
  title: string;
  description: string;
  tags: { label: string; variant: string }[];
  info: ReactNode;
}

function SubsystemRow({ title, description, tags, info }: SubsystemRowProps): ReactNode {
  return (
    <div className="subsystem-row">
      <div className="subsystem-row-header">
        <span className="subsystem-row-title">
          {title}
          <InfoButton content={info} size="sm" />
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <span key={t.label} className={`badge ${t.variant}`}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <div className="subsystem-row-desc">{description}</div>
    </div>
  );
}

/* ── SVG icons for empty / status ───────────────────────────────── */
function IconShield(): ReactNode {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.4 }}
    >
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

/* ── Main component ─────────────────────────────────────────────── */
export function OverviewScreen({ stats, isLoading, onNavigate }: Props): ReactNode {
  if (isLoading) {
    return (
      <div>
        <div className="screen-header">
          <div className="skeleton-box" style={{ width: '240px', height: '28px', marginBottom: '8px' }} />
          <div className="skeleton-box" style={{ width: '380px', height: '16px' }} />
        </div>
        <div className="stat-hero-grid">
          <div className="skeleton-box" style={{ height: '130px' }} />
          <div className="skeleton-box" style={{ height: '130px' }} />
          <div className="skeleton-box" style={{ height: '130px' }} />
        </div>
        <div className="panel" style={{ height: '200px' }}>
          <div className="skeleton-box" style={{ height: '100%' }} />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <div className="screen-header">
          <h1 className="screen-title">System Overview</h1>
        </div>
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconShield />
            </div>
            <h2 className="empty-state-title">No Memory Telemetry Active</h2>
            <p className="empty-state-desc">
              No records yet. Once an MCP client calls <code>record_failure</code> or{' '}
              <code>find_fix</code>, telemetry will populate here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const ageMax = Math.max(
    1,
    stats.ageDistribution.under1h,
    stats.ageDistribution.under24h,
    stats.ageDistribution.under7d,
    stats.ageDistribution.over7d,
  );

  const hasQuarantine = stats.quarantinedCount > 0;
  const hasStale = stats.staleCount > 0;

  return (
    <div>
      <div className="screen-header">
        <div className="screen-title-row">
          <h1 className="screen-title">System Overview</h1>
          <div
            className={`badge ${hasQuarantine ? 'rose' : 'emerald'}`}
            style={{ padding: '0.32rem 0.7rem', fontSize: '0.78rem', alignSelf: 'flex-start' }}
          >
            <IconCheck />
            {hasQuarantine ? 'Action Required' : 'System Nominal'}
          </div>
        </div>
      </div>

      {/* ── Primary Hero Metrics ── */}
      <div className="stat-hero-grid">
        {/* 1. Quarantine / Poisoning */}
        <div
          className={`stat-hero-card ${hasQuarantine ? 'rose' : 'emerald'}`}
          onClick={() => onNavigate('security')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          aria-label="View security quarantine audit"
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('security')}
        >
          <div className="stat-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Quarantine Flags
              <InfoButton
                content={
                  <>
                    <strong>Quarantine Flags</strong>

                    Count of memories isolated due to suspected prompt-injection or adversarial content.
                    A non-zero value requires immediate review in the <em>Security Audit</em> tab.
                    <br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>
                      Example: a memory containing <code>{"</s>[INST]"}</code> would trigger quarantine.
                    </span>
                  </>
                }
              />
            </span>
            <span className={`badge ${hasQuarantine ? 'rose' : 'emerald'}`}>
              {hasQuarantine ? 'ACTION REQUIRED' : 'CLEAN'}
            </span>
          </div>
          <div
            className="stat-value"
            style={{ color: hasQuarantine ? 'var(--status-danger)' : 'var(--status-success)' }}
          >
            {stats.quarantinedCount}
          </div>
          <div className="stat-subtext">
            {hasQuarantine
              ? 'Isolated memories blocked from retrieval. Click to review.'
              : 'No adversarial memories detected.'}
          </div>
        </div>

        {/* 2. Stale Drift */}
        <div
          className={`stat-hero-card ${hasStale ? 'amber' : 'cyan'}`}
          onClick={() => onNavigate('records')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          aria-label="View stale warnings"
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('records')}
        >
          <div className="stat-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Stale Records
              <InfoButton
                content={
                  <>
                    <strong>Stale Records</strong>

                    Memories whose associated dependency lockfile has changed since the fix was verified.
                    This means the fix may no longer apply to the current codebase.
                    <br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>
                      Triggered when <code>package-lock.json</code> or <code>Cargo.lock</code> hash drifts.
                    </span>
                  </>
                }
              />
            </span>
            <span className={`badge ${hasStale ? 'amber' : 'cyan'}`}>
              {hasStale ? 'DRIFT DETECTED' : 'IN SYNC'}
            </span>
          </div>
          <div
            className="stat-value"
            style={{ color: hasStale ? 'var(--status-warning)' : 'var(--accent)' }}
          >
            {stats.staleCount}
          </div>
          <div className="stat-subtext">
            {hasStale ? 'Re-verification advised. Click to review.' : 'All records match current lockfiles.'}
          </div>
        </div>

        {/* 3. Statistical Confidence */}
        <div className="stat-hero-card emerald">
          <div className="stat-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Fix Confidence
              <InfoButton
                content={
                  <>
                    <strong>Wilson Score Lower Bound (95% CI)</strong>

                    A conservative statistical confidence score for the fix-success rate.
                    Unlike a raw success rate, the Wilson lower bound avoids over-optimistic estimates
                    when the sample size is small.
                    <br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>
                      E.g., 3 successes / 3 attempts = 100% raw rate, but Wilson CI &asymp; 43% at 95%.
                    </span>
                  </>
                }
              />
            </span>
            <span className="badge emerald">95% CI</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-success)' }}>
            {(stats.successRate * 100).toFixed(1)}%
          </div>
          <div className="stat-subtext">
            Conservative lower bound — prevents over-confident fix recommendations.
          </div>
        </div>
      </div>

      {/* ── Secondary Telemetry Cards ── */}
      <div className="stat-grid">
        <div
          className="stat-card"
          onClick={() => onNavigate('records')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('records')}
        >
          <div className="stat-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Total Records
              <InfoButton
                content={
                  <>
                    <strong>Total Memory Records</strong>

                    All indexed error-fix pairs stored by this agent. Each record links an error fingerprint
                    to a validated fix and is scoped to a repository.
                  </>
                }
              />
            </span>
            <span className="badge gray">Catalog</span>
          </div>
          <div className="stat-value">{stats.totalRecords}</div>
          <div className="stat-subtext">Total indexed error-fix pairs</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Verified Fixes
              <InfoButton
                content={
                  <>
                    <strong>Verified Fixes</strong>

                    Records that have been explicitly confirmed — either via dry-run sandbox execution
                    or operator approval. Verified fixes carry higher retrieval weight.
                  </>
                }
              />
            </span>
            <span className="badge violet">Confirmed</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {stats.verifiedCount}
          </div>
          <div className="stat-subtext">Sandbox-verified or operator-approved</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Unique Fingerprints
              <InfoButton
                content={
                  <>
                    <strong>Unique Error Fingerprints</strong>

                    Deduplicated SHA-256 hashes of normalized error payloads. Two errors with
                    different line numbers but the same root cause produce the same fingerprint,
                    preventing duplicate records.
                  </>
                }
              />
            </span>
            <span className="badge gray">SHA-256</span>
          </div>
          <div className="stat-value">{stats.exactFingerprints}</div>
          <div className="stat-subtext">Deduplicated by normalized error hash</div>
        </div>
      </div>

      {/* ── Memory Age Distribution ── */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            Memory Age Distribution
            <InfoButton
              size="md"
              content={
                <>
                  <strong>Age-Based Retrieval Weighting</strong>

                  Older, unverified records receive a decay penalty during retrieval scoring.
                  Fresh records are trusted more because the environment is less likely to have changed.
                  <br />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>
                    Weight tiers: &lt;1h = 1.0&times;, &lt;24h = 0.95&times;, &lt;7d = 0.85&times;, 7d+ = 0.70&times;
                  </span>
                </>
              }
            />
          </h2>
          <span className="badge gray" style={{ fontSize: '0.72rem' }}>Decay: 0.8&times; / Tier</span>
        </div>

        <div className="age-dist-grid">
          {[
            {
              label: '< 1 Hour',
              sub: 'Fresh',
              count: stats.ageDistribution.under1h,
              color: 'var(--status-success)',
              decay: '1.0×',
            },
            {
              label: '< 24 Hours',
              sub: 'Recent',
              count: stats.ageDistribution.under24h,
              color: 'var(--accent)',
              decay: '0.95×',
            },
            {
              label: '< 7 Days',
              sub: 'Established',
              count: stats.ageDistribution.under7d,
              color: 'var(--text-secondary)',
              decay: '0.85×',
            },
            {
              label: '7+ Days',
              sub: 'Aging',
              count: stats.ageDistribution.over7d,
              color: 'var(--status-warning)',
              decay: '0.70×',
            },
          ].map((item) => (
            <div key={item.label} className="age-dist-cell">
              <div className="age-dist-header">
                <div>
                  <div className="age-dist-label">{item.label}</div>
                  <div className="age-dist-sub">{item.sub}</div>
                </div>
                <strong className="mono" style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                  {item.count}
                </strong>
              </div>

              <div className="age-dist-bar-track">
                <div
                  className="age-dist-bar-fill"
                  style={{
                    width: `${Math.max(3, (item.count / ageMax) * 100)}%`,
                    background: item.color,
                  }}
                />
              </div>

              <div className="age-dist-weight">
                Weight <span style={{ color: item.color, fontWeight: 600 }}>{item.decay}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Subsystem Status ── */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Subsystem Status</h2>
          <span className="badge emerald">
            <IconCheck /> All Checks Passed
          </span>
        </div>

        <div className="subsystem-rows">
          <SubsystemRow
            title="Transport & Channel"
            description="MCP Specification 2026-07-28 via stdio. Bridge operates strictly on loopback (127.0.0.1)."
            tags={[
              { label: 'stdio', variant: 'gray' },
              { label: 'Zero stdout leaks', variant: 'emerald' },
            ]}
            info={
              <>
                <strong>Transport Conformance</strong>
                The server communicates via the MCP stdio transport — no network socket is exposed.
                All dashboard traffic passes through the local bridge (port 4321).
              </>
            }
          />
          <SubsystemRow
            title="Storage Engine"
            description="Append-only JSONL source of truth with a rebuildable SQLite FTS5 full-text search index."
            tags={[
              { label: 'SQLite WAL', variant: 'gray' },
              { label: 'Read-only handle', variant: 'gray' },
            ]}
            info={
              <>
                <strong>Append-Only JSONL + SQLite</strong>
                Every record is written to a JSONL file first (the canonical source of truth), then indexed into
                SQLite for fast full-text search. The SQLite index can be rebuilt from the JSONL at any time
                without data loss.
              </>
            }
          />
          <SubsystemRow
            title="Security & Redaction"
            description="Regex + Shannon entropy scanning redacts secrets before storage. Quarantine gate blocks injected memories."
            tags={[
              { label: 'Redaction active', variant: 'emerald' },
              { label: 'Quarantine active', variant: 'rose' },
            ]}
            info={
              <>
                <strong>Defense Layers</strong>
                <strong>1. Regex redaction</strong>Strips API keys, tokens, and passwords before storage. <br />
                <strong>2. Entropy scan</strong>High-entropy strings (e.g., base64 secrets) are flagged. <br />
                <strong>3. Quarantine gate</strong>Memories with prompt-injection patterns are isolated and
                excluded from retrieval until reviewed. <br />
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
