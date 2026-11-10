import { useEffect, useState, type ReactNode } from 'react';
import type { FullMemoryRecord } from '../types.js';

interface Props {
  record: FullMemoryRecord | null;
  onClose: () => void;
}

export function RecordDetailDrawer({ record, onClose }: Props): ReactNode {
  const [outputTab, setOutputTab] = useState<'normalized' | 'raw'>('normalized');

  useEffect(() => {
    if (!record) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [record, onClose]);

  if (!record) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Record detail view">
        <div className="drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{record.id}</span>
              {record.isQuarantined && <span className="badge rose">QUARANTINED</span>}
              {record.verificationStatus === 'verified_success' && <span className="badge emerald">VERIFIED</span>}
              <span className="badge gray">{record.commandFamily}</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Captured: {new Date(record.createdAt).toLocaleString()} • Normalizer v{record.normalizerVersion}
            </div>
          </div>

          <button className="btn btn-outline" onClick={onClose} aria-label="Close record detail drawer">Close</button>
        </div>

        <div className="drawer-body">
          {record.poisoningFlag && (
            <div style={{ background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-bd)', borderRadius: '6px', padding: '1rem', marginBottom: '1.35rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--status-danger)', marginBottom: '0.25rem' }}>Security & Adversarial Injection Quarantine Flag</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Reason: {record.poisoningFlag.reason}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Flagged at: {new Date(record.poisoningFlag.raisedAt).toLocaleString()} • Status:{' '}
                <span className="badge rose" style={{ fontSize: '0.68rem' }}>{record.poisoningFlag.status.toUpperCase()}</span>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.35rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Supersedes Chain & Historical Evolution</h3>
            <div className="supersedes-timeline">
              {record.supersedes ? (
                <>
                  <div className="timeline-node">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PREDECESSOR</span>
                    <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.82rem' }}>{record.supersedes}</span>
                    <span className="badge gray" style={{ fontSize: '0.65rem' }}>STALE LOCKFILE</span>
                  </div>
                  <div className="timeline-arrow"><span>replaces ──▶</span><span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>lockfile drift</span></div>
                  <div className="timeline-node" style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-card)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ACTIVE FIX</span>
                    <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.82rem' }}>{record.id}</span>
                    <span className="badge emerald" style={{ fontSize: '0.65rem' }}>CURRENT REVISION</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <div className="timeline-node" style={{ borderColor: 'var(--status-success-bd)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ORIGIN MEMORY</span>
                    <span className="mono" style={{ color: 'var(--status-success)', fontWeight: 600, fontSize: '0.82rem' }}>{record.id}</span>
                    <span className="badge emerald" style={{ fontSize: '0.65rem' }}>GENESIS RECORD</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Root memory record (no predecessor in supersedes chain).</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '1.35rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>Proposed Fix Rationale</h3>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.95rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.65rem', lineHeight: 1.45 }}>{record.fix?.explanation || record.fixExplanation}</p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>Proposed Fix Commands:</div>
              {(record.fix?.commands || record.fixCommands || []).map((cmd, i) => (
                <div key={i} className="code-block mono" style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>$ {cmd}</div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.35rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>Statistical Verification Telemetry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
              <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verification Status</div>
                <div style={{ fontWeight: 600, color: 'var(--status-success)', marginTop: '0.2rem', fontSize: '0.9rem' }}>{record.verification?.status ?? record.verificationStatus}</div>
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wilson Lower Bound (95% CI)</div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                  {record.wilsonLowerBound !== null && record.wilsonLowerBound !== undefined ? `${(record.wilsonLowerBound * 100).toFixed(1)}%` : 'N/A (unverified)'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.35rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>Provenance & Git Environment Context</h3>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}><span style={{ color: 'var(--text-muted)' }}>Git Commit:</span><span className="mono" style={{ color: 'var(--text-primary)' }}>{record.provenance?.gitCommit || 'N/A'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}><span style={{ color: 'var(--text-muted)' }}>Branch:</span><span className="mono" style={{ color: 'var(--text-primary)' }}>{record.provenance?.gitBranch || 'N/A'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Captured By:</span><span style={{ color: 'var(--text-primary)' }}>{record.provenance?.gitAuthor || 'CoMemor'}</span></div>
            </div>
          </div>

          <div style={{ marginBottom: '1.35rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>Deterministic SHA-256 Fingerprint</h3>
            <div className="code-block mono fingerprint-value">{record.fingerprint}</div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Error Output Comparison</h3>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button className="btn btn-outline" aria-pressed={outputTab === 'normalized'} style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }} onClick={() => setOutputTab('normalized')}>Normalized Output</button>
                <button className="btn btn-outline" aria-pressed={outputTab === 'raw'} style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }} onClick={() => setOutputTab('raw')}>Raw (Redacted)</button>
              </div>
            </div>
            <pre className="code-block" style={{ maxHeight: '180px', fontSize: '0.76rem' }}>{outputTab === 'normalized' ? record.normalizedOutput || 'Normalized output unavailable in summary' : record.rawOutputRedacted || 'Raw redacted output unavailable in summary'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
