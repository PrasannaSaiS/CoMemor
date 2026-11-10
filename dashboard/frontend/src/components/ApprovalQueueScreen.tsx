import { useState, useEffect, type ReactNode } from 'react';
import type { PendingApproval } from '../types.js';
import { ConfirmButton } from './shared/ConfirmButton.js';

interface Props {
  approvals?: PendingApproval[];
  isLoading?: boolean;
  onDecision: (id: string, decision: 'approve' | 'deny', notes?: string) => Promise<boolean>;
  onRefresh?: () => Promise<void>;
}

function IconShield(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function ApprovalQueueScreen({ approvals = [], isLoading, onDecision, onRefresh }: Props): ReactNode {
  const [operatorNotes, setOperatorNotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (onRefresh) {
      void onRefresh();
    }
  }, [onRefresh]);

  const handleAction = async (id: string, decision: 'approve' | 'deny') => {
    setIsSubmitting(id);
    try {
      const ok = await onDecision(id, decision, operatorNotes[id]);
      if (ok) {
        setOperatorNotes((prev) => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }
    } finally {
      setIsSubmitting(null);
    }
  };

  const getRiskBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH':
        return <span className="badge rose">HIGH RISK LEVEL</span>;
      case 'MEDIUM':
        return <span className="badge gray">MEDIUM RISK LEVEL</span>;
      case 'LOW':
      default:
        return <span className="badge emerald">LOW RISK LEVEL</span>;
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="screen-header">
          <div className="skeleton-box" style={{ width: '320px', height: '28px', marginBottom: '8px' }} />
          <div className="skeleton-box" style={{ width: '480px', height: '16px' }} />
        </div>
        <div className="panel" style={{ height: '180px', marginBottom: '16px' }}>
          <div className="skeleton-box" style={{ height: '100%' }} />
        </div>
        <div className="panel" style={{ height: '180px' }}>
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
            <h1 className="screen-title">Fix Proposal Review Queue</h1>
            <p className="screen-subtitle">
              Human-in-the-loop review of proposed fix commands. Recording a decision here writes an audit entry to approvals-resolved.jsonl. CoMemor does not execute commands — your host IDE or agent handles execution after you review and approve the proposal.
            </p>
          </div>
          <div className="badge gray">
            {approvals.length} Pending Review{approvals.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {approvals.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconShield />
            </div>
            <h2 className="empty-state-title">No Pending Proposals</h2>
            <p className="empty-state-desc">
              No fix proposals are awaiting review. When an agent calls verify_fix with a non-allowlisted command or dryRun: false, CoMemor logs the proposal here for operator review. Recording a decision writes an audit entry — your IDE or agent handles actual execution.
            </p>
            <div style={{ marginTop: '1.25rem' }}>
              <span className="badge emerald">Dry-Run Protection Active</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="approval-list">
          {approvals.map((appr) => {
            const isHighRisk = appr.risk?.level?.toUpperCase() === 'HIGH';
            const isSubmittingThis = isSubmitting === appr.approvalId;

            return (
              <div
                key={appr.approvalId}
                className="panel approval-card"
                style={{
                  borderLeft: isHighRisk ? '4px solid var(--status-danger)' : '4px solid var(--status-warning)',
                }}
              >
                <div className="approval-header">
                  <div>
                    <div className="approval-meta-row">
                      <span className="mono approval-id">{appr.approvalId}</span>
                      {getRiskBadge(appr.risk?.level)}
                      {appr.recordId && <span className="mono badge gray">Ref Record: {appr.recordId}</span>}
                    </div>
                    <div className="approval-timestamp">
                      Intercepted: {new Date(appr.createdAt).toLocaleString()} • Status: <span className="mono">{appr.status}</span>
                    </div>
                  </div>

                  <div className="approval-actions">
                    <ConfirmButton
                      confirmLabel="Deny"
                      confirmText="Confirm deny?"
                      variant="danger"
                      disabled={isSubmittingThis}
                      onConfirm={() => handleAction(appr.approvalId, 'deny')}
                    >
                      {isSubmittingThis ? 'Submitting…' : 'Record Denial'}
                    </ConfirmButton>

                    <ConfirmButton
                      confirmLabel="Approve"
                      confirmText="Confirm review complete?"
                      variant="success"
                      disabled={isSubmittingThis}
                      onConfirm={() => handleAction(appr.approvalId, 'approve')}
                    >
                      {isSubmittingThis ? 'Recording…' : 'Record Approval'}
                    </ConfirmButton>
                  </div>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <div className="mini-label">Proposed Fix Command:</div>
                  <div className="code-block mono approval-command">$ {appr.requestedCommand}</div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div className="mini-label">Security Policy Findings:</div>
                  <div className="risk-badges">
                    {(appr.risk?.reasons ?? []).map((r, i) => (
                      <span key={i} className={`badge ${isHighRisk ? 'rose' : 'gray'}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor={`notes-${appr.approvalId}`} className="field-label">
                    Operator Review Notes (logged to approvals-resolved.jsonl — audit trail only, not execution authorization):
                  </label>
                  <input
                    id={`notes-${appr.approvalId}`}
                    type="text"
                    className="input"
                    placeholder="Enter justification or review comments prior to decision..."
                    value={operatorNotes[appr.approvalId] || ''}
                    onChange={(e) => setOperatorNotes((prev) => ({ ...prev, [appr.approvalId]: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
