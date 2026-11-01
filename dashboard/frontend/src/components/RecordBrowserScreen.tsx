import { useState, type ReactNode } from 'react';
import type { MemoryRecordSummary, FullMemoryRecord } from '../types.js';
import { RecordDetailDrawer } from './RecordDetailDrawer.js';

interface Props {
  records: MemoryRecordSummary[];
  isLoading?: boolean;
  onFetchDetail: (id: string) => Promise<FullMemoryRecord | null>;
}

function IconSearch(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function RecordBrowserScreen({ records, isLoading, onFetchDetail }: Props): ReactNode {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<FullMemoryRecord | null>(null);

  const commandFamilies = ['all', ...Array.from(new Set(records.map((r) => r.commandFamily)))];

  const filtered = records.filter((r) => {
    if (familyFilter !== 'all' && r.commandFamily !== familyFilter) return false;
    if (statusFilter === 'quarantined' && !r.isQuarantined) return false;
    if (statusFilter === 'clean' && r.isQuarantined) return false;
    if (statusFilter === 'verified' && r.verificationStatus !== 'verified_success') return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.command.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.fingerprint.toLowerCase().includes(q) ||
        r.fixExplanation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleRowClick = async (id: string) => {
    const full = await onFetchDetail(id);
    if (full) setSelectedRecord(full);
  };

  return (
    <div>
      <div className="screen-header">
        <div className="screen-title-row">
          <div>
            <h1 className="screen-title">Record Browser & Detail</h1>
            <p className="screen-subtitle">
              Searchable catalog of error-fix memories, deterministic fingerprints, provenance metadata, and supersedes history.
            </p>
          </div>
          <div className="badge gray">
            Catalog: {records.length} Records ({filtered.length} matching)
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="panel"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.85rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          <input
            id="record-search-input"
            type="text"
            className="input"
            placeholder="Search commands, fingerprints, or explanations... (Press '/' to focus)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            id="family-filter-select"
            className="input"
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            aria-label="Filter by command family"
          >
            <option value="all">All Command Families</option>
            {commandFamilies
              .filter((f) => f !== 'all')
              .map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
          </select>

          <select
            id="status-filter-select"
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by record status"
          >
            <option value="all">All Verification Statuses</option>
            <option value="clean">Clean (Unquarantined)</option>
            <option value="quarantined">Quarantined (Flagged)</option>
            <option value="verified">Verified Only (Passing)</option>
          </select>

          {(searchTerm || familyFilter !== 'all' || statusFilter !== 'all') && (
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setSearchTerm('');
                setFamilyFilter('all');
                setStatusFilter('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Tabular Data Catalog */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Target Command</th>
                <th>Family</th>
                <th>Fingerprint (SHA-256)</th>
                <th>Wilson Lower Bound</th>
                <th>Integrity Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td><div className="skeleton-box" style={{ width: '80px', height: '18px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '180px', height: '18px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '60px', height: '18px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '120px', height: '18px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '70px', height: '18px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '85px', height: '18px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '80px', height: '18px' }} /></td>
                    <td style={{ textAlign: 'right' }}><div className="skeleton-box" style={{ width: '60px', height: '24px', marginLeft: 'auto' }} /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3.5rem 1.5rem' }}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <IconSearch />
                      </div>
                      <h2 className="empty-state-title">No Matching Memory Records</h2>
                      <p className="empty-state-desc">
                        {records.length === 0
                          ? 'The memory database is currently empty. Run test executions or benchmarks to seed records.'
                          : 'No records match your active search terms or filter selection.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleRowClick(r.id)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleRowClick(r.id)}
                  >
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.id}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {r.command.length > 40 ? `${r.command.slice(0, 40)}…` : r.command}
                      </code>
                    </td>
                    <td>
                      <span className="badge gray">{r.commandFamily}</span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {r.fingerprint.slice(0, 16)}…
                      </span>
                    </td>
                    <td>
                      {r.wilsonLowerBound !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="mono" style={{ fontWeight: 600, color: 'var(--status-success)' }}>
                            {(r.wilsonLowerBound * 100).toFixed(1)}%
                          </span>
                          <div
                            style={{
                              width: '45px',
                              height: '5px',
                              background: 'rgba(125, 140, 160, 0.15)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${r.wilsonLowerBound * 100}%`,
                                height: '100%',
                                background: 'var(--status-success)',
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {r.isQuarantined ? (
                        <span className="badge rose">QUARANTINED</span>
                      ) : r.verificationStatus === 'verified_success' ? (
                        <span className="badge emerald">VERIFIED</span>
                      ) : (
                        <span className="badge gray">RECORDED</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.22rem 0.65rem', fontSize: '0.74rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(r.id);
                        }}
                        aria-label={`Inspect record ${r.id}`}
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Out Detail Drawer */}
      <RecordDetailDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
