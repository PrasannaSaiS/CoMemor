import { useState, useEffect, type ReactNode } from 'react';
import type { ExplainabilityData } from '../types.js';

interface Props {
  onFetchExplainability: (queryId?: string) => Promise<ExplainabilityData | null>;
}

function IconBarChart(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function ExplainabilityScreen({ onFetchExplainability }: Props): ReactNode {
  const [data, setData] = useState<ExplainabilityData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await onFetchExplainability();
      if (res) setData(res);
    } finally {
      setIsLoading(false);
    }
  };

  const threshold = data?.threshold ?? 0.7;

  if (isLoading) {
    return (
      <div>
        <div className="screen-header">
          <div className="explainability-loading" role="status" aria-live="polite">
            <span className="explainability-loading-spinner" aria-hidden="true" />
            <span>Loading retrieval explanation…</span>
          </div>
          <div className="skeleton-box" style={{ width: '280px', height: '28px', marginBottom: '8px' }} />
          <div className="skeleton-box" style={{ width: '520px', height: '16px' }} />
        </div>
        <div className="panel" style={{ height: '120px' }}>
          <div className="skeleton-box" style={{ height: '100%' }} />
        </div>
        <div className="panel" style={{ height: '400px' }}>
          <div className="skeleton-box" style={{ height: '100%' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <div className="screen-title-row">
          <div>
            <h1 className="screen-title">Retrieval Explainability</h1>
            <p className="screen-subtitle">
              Transparent multi-factor ranking, fuzzy fallback evaluation, and stale-penalty scoring against the acceptance threshold.
            </p>
          </div>
          <div className="badge gray" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
            Deterministic Scoring Engine
          </div>
        </div>
      </div>

      {/* Diagnostic Query Banner */}
      <div
        className="panel"
        style={{
          background: 'var(--bg-subtle)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 700,
                marginBottom: '0.25rem',
              }}
            >
              Active Diagnostic Evaluation Query
            </div>
            <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {data?.query ?? 'npm run build'}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Normalized compiler & build script exit failure
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Retrieval Acceptance Threshold (τ)
            </div>
            <div className="mono" style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {(threshold * 100).toFixed(0)}% (0.70)
            </div>
            <span className="badge gray" style={{ fontSize: '0.68rem' }}>
              CONSERVATIVE BOUND
            </span>
          </div>
        </div>
      </div>

      {/* Candidate Score Bars vs Threshold Visualizations */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Candidate Fix Scoring vs. Acceptance Threshold</h2>
          </div>
          <span className="badge gray">Levenshtein + Wilson + Provenance</span>
        </div>

        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.35rem' }}>
          Composite score formula: <code className="mono" style={{ color: 'var(--text-primary)' }}>S = Similarity × ProvenanceDecay(0.8x) × Quarantine(0.5x) × WilsonBound</code>.
          Candidates below τ = 0.70 are decisively rejected from prompt injection.
        </p>

        {/* Visual Threshold Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {!data || data.candidates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <IconBarChart />
              </div>
              <h2 className="empty-state-title">No Candidate Scores Available</h2>
              <p className="empty-state-desc">
                No diagnostic candidate matches were produced for the active query.
              </p>
            </div>
          ) : (
            data.candidates.map((cand, idx) => {
              const scorePercent = Math.min(100, Math.round(cand.trustScore * 100));
              const passes = cand.trustScore >= threshold;

              return (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '1.15rem 1.25rem',
                    borderRadius: '6px',
                    border: `1px solid ${passes ? 'var(--border-subtle)' : 'var(--status-danger-bd)'}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.65rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.25rem' }}>
                        <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {cand.id}
                        </span>
                        <span className={`badge ${cand.matchType === 'exact' ? 'emerald' : 'gray'}`}>
                          {cand.matchType.toUpperCase()} MATCH
                        </span>
                        {cand.isQuarantined && <span className="badge rose">QUARANTINED (0.5x PENALTY)</span>}
                        {cand.isStale && <span className="badge gray">STALE (LOCKFILE MISMATCH)</span>}
                      </div>
                      <code style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{cand.command}</code>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        className="mono"
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: passes ? 'var(--status-success)' : 'var(--status-danger)',
                        }}
                      >
                        {(cand.trustScore * 100).toFixed(1)}%
                      </div>
                      <span
                        className={`badge ${passes ? 'emerald' : 'rose'}`}
                        style={{ fontSize: '0.68rem', fontWeight: 700 }}
                      >
                        {passes ? 'ACCEPTED' : 'REJECTED (BELOW THRESHOLD)'}
                      </span>
                    </div>
                  </div>

                  {/* High-Precision Score Bar with Absolute Threshold Marker */}
                  <div className="explain-bar-track">
                    <div
                      className="explain-bar-fill"
                      style={{
                        width: `${scorePercent}%`,
                        background: passes ? 'var(--status-success)' : 'var(--status-danger)',
                      }}
                    />
                    {/* Visual Threshold indicator line */}
                    <div
                      className="explain-threshold-line"
                      style={{ left: `${threshold * 100}%` }}
                      title={`Retrieval Threshold: ${(threshold * 100).toFixed(0)}%`}
                    />
                  </div>

                  {/* Multi-Factor Score Chips & Filter Checklist */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.85rem',
                      marginTop: '0.65rem',
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div>
                      Raw Similarity:{' '}
                      <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                        {(cand.similarityScore * 100).toFixed(1)}%
                      </strong>
                    </div>

                    <div>
                      Repo Match:{' '}
                      <span
                        style={{
                          fontWeight: 600,
                          color: cand.passedFilters.repository ? 'var(--status-success)' : 'var(--status-danger)',
                        }}
                      >
                        {cand.passedFilters.repository ? 'Pass' : 'Fail'}
                      </span>
                    </div>

                    <div>
                      Family Match:{' '}
                      <span
                        style={{
                          fontWeight: 600,
                          color: cand.passedFilters.commandFamily ? 'var(--status-success)' : 'var(--status-danger)',
                        }}
                      >
                        {cand.passedFilters.commandFamily ? 'Pass' : 'Fail'}
                      </span>
                    </div>

                    <div>
                      Exit Code:{' '}
                      <span
                        style={{
                          fontWeight: 600,
                          color: cand.passedFilters.exitCode ? 'var(--status-success)' : 'var(--status-danger)',
                        }}
                      >
                        {cand.passedFilters.exitCode ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Defensible Safety Invariant Callout */}
      <div
        className="panel"
        style={{
          borderLeft: '4px solid var(--border-strong)',
          background: 'var(--bg-subtle)',
        }}
      >
        <h3
          style={{
            fontSize: '0.92rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}
        >
          Defensible Safety Invariant: No Silent Promotion
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Fuzzy matches are never silently promoted to verified fixes. Every retrieved record surfaces its exact matchType, raw similarity, provenance decay factor, and quarantine containment status directly into the prompt sanitization envelope.
        </p>
      </div>
    </div>
  );
}
