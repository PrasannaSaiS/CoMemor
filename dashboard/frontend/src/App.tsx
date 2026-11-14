import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type {
  MemoryStats,
  MemoryRecordSummary,
  FullMemoryRecord,
  PendingApproval,
  LogEvent,
  ExplainabilityData,
  BenchmarkData,
} from './types.js';

import { OverviewScreen } from './components/OverviewScreen.js';
import { LiveFeedScreen } from './components/LiveFeedScreen.js';
import { RecordBrowserScreen } from './components/RecordBrowserScreen.js';
import { ExplainabilityScreen } from './components/ExplainabilityScreen.js';
import { ApprovalQueueScreen } from './components/ApprovalQueueScreen.js';
import { SecurityAuditScreen } from './components/SecurityAuditScreen.js';
import { BenchmarkScreen } from './components/BenchmarkScreen.js';

const screens = [
  { key: 'overview', label: 'Overview' },
  { key: 'feed', label: 'Live Activity' },
  { key: 'records', label: 'Records' },
  { key: 'explain', label: 'Explainability' },
  { key: 'approvals', label: 'Approval Queue' },
  { key: 'security', label: 'Security Audit' },
  { key: 'benchmarks', label: 'Evaluation' },
] as const;

function IconMenu(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconSidebarClose(): ReactNode {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="15 9 12 12 15 15" />
    </svg>
  );
}

function IconSidebarOpen(): ReactNode {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="13 15 16 12 13 9" />
    </svg>
  );
}

function IconSun(): ReactNode {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon(): ReactNode {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function App(): ReactNode {
  return (
    <BrowserRouter>
      <DashboardShell />
    </BrowserRouter>
  );
}

function DashboardShell(): ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('agent-memory-theme') as 'dark' | 'light') || 'dark';
  });
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [records, setRecords] = useState<MemoryRecordSummary[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('agent-memory-sidebar-open');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('agent-memory-sidebar-open', String(next));
      return next;
    });
  }, []);

  const activeScreen = location.pathname.replace('/', '') || 'overview';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('agent-memory-theme', theme);
  }, [theme]);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        await Promise.all([fetchStats(), fetchRecords(), fetchApprovals()]);
      } catch {
        setFetchError('Failed to communicate with the local bridge server.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onopen = () => setIsStreaming(true);
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as LogEvent;
          setEvents((prev) => [...prev, parsed].slice(-200));
          if (parsed.event?.includes('record') || parsed.event?.includes('verify')) {
            void fetchStats();
            void fetchRecords();
            void fetchApprovals();
          }
        } catch {
          // ignore non-json ping or keepalive messages
        }
      };
      eventSource.onerror = () => setIsStreaming(false);
    } catch {
      setIsStreaming(false);
    }

    return () => {
      eventSource?.close();
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.warn('Failed to fetch stats from bridge:', e);
    }
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/records?limit=100');
      if (res.ok) setRecords(await res.json());
    } catch (e) {
      console.warn('Failed to fetch records from bridge:', e);
    }
  };

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals');
      if (res.ok) {
        setApprovals(await res.json());
        return;
      }
      const fallback = await fetch('/api/pending-approvals');
      if (fallback.ok) setApprovals(await fallback.json());
    } catch (e) {
      console.warn('Failed to fetch approvals from bridge:', e);
    }
  }, []);

  const handleFetchRecordDetail = async (id: string): Promise<FullMemoryRecord | null> => {
    try {
      const res = await fetch(`/api/records/${id}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to fetch record detail:', e);
    }
    return null;
  };

  const handleDecision = async (
    id: string,
    decision: 'approve' | 'deny',
    notes?: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/approvals/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, operatorNotes: notes }),
      });
      if (res.ok) {
        await fetchApprovals();
        await fetchStats();
        return true;
      }
    } catch (e) {
      console.warn('Failed to submit decision:', e);
    }
    return false;
  };

  const handleFetchExplainability = async (query?: string): Promise<ExplainabilityData | null> => {
    try {
      const url = query ? `/api/explainability?query=${encodeURIComponent(query)}` : '/api/explainability';
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to fetch explainability data:', e);
    }
    return null;
  };

  const handleFetchAudit = async () => {
    try {
      const res = await fetch('/api/security-audit');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to fetch audit data:', e);
    }
    return null;
  };

  const handleFetchBenchmarks = async (): Promise<BenchmarkData | null> => {
    try {
      const res = await fetch('/api/benchmarks/latest');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to fetch benchmark data:', e);
    }
    return null;
  };

  const routeTo = (screen: string) => {
    navigate(`/${screen}`);
  };

  /* CoMemor logo — single image for both themes */
  const mcpIconSrc = '/comemor-logo.png';

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-label="Toggle navigation"
        onClick={() => setMobileNavOpen((prev) => !prev)}
      >
        <IconMenu />
      </button>
      <div className={`nav-overlay ${mobileNavOpen ? 'open' : ''}`} onClick={() => setMobileNavOpen(false)} />

      <aside className={`side-nav ${sidebarOpen ? 'open' : 'collapsed'} ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand-section">
          <div className="brand-main">
            <div className="brand-icon-box" title="Agent Memory Observability Console">
              <img
                src={mcpIconSrc}
                alt="CoMemor"
                width={28}
                height={28}
                style={{ display: 'block', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
            <div className="brand-meta">
              <span className="brand-title">Memory Console</span>
              <span className="brand-subtitle mono">CoMemor &bull; v0.1.0</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn desktop-only"
            onClick={toggleSidebar}
            title="Collapse sidebar (Ctrl+B)"
            aria-label="Collapse sidebar"
          >
            <IconSidebarClose />
          </button>
        </div>

        <nav className="nav-links" role="tablist" aria-label="Dashboard views">
          {screens.map((item) => {
            const isActive = activeScreen === item.key;
            const badgeCount =
              item.key === 'feed'
                ? events.length
                : item.key === 'records'
                  ? records.length
                  : item.key === 'approvals'
                    ? approvals.length
                    : item.key === 'security'
                      ? stats?.quarantinedCount ?? 0
                      : 0;

            return (
              <button
                key={item.key}
                id={`nav-tab-${item.key}`}
                role="tab"
                aria-selected={isActive}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => routeTo(item.key)}
              >
                {item.label}
                {badgeCount > 0 && (
                  <span
                    className={`nav-badge ${item.key === 'approvals'
                      ? 'warning'
                      : item.key === 'security'
                        ? 'danger'
                        : item.key === 'feed'
                          ? 'cyan'
                          : item.key === 'records'
                            ? 'gray'
                            : ''
                      }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="nav-actions">
          <div className="status-badge" title="SSE Bridge Pipeline Status">
            <span
              className="pulse-dot"
              style={{
                background: isStreaming ? 'var(--status-success)' : 'var(--status-warning)',
              }}
            />
            <span>{isStreaming ? '127.0.0.1:4321' : 'Reconnecting...'}</span>
          </div>

          <button
            className="theme-toggle-btn"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle visual theme"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            <span style={{ fontSize: '0.75rem', marginLeft: '0.3rem' }}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header-bar">
          <div className="top-header-left">
            {!sidebarOpen && (
              <button
                type="button"
                className="sidebar-toggle-btn desktop-only"
                onClick={toggleSidebar}
                title="Expand sidebar (Ctrl+B)"
                aria-label="Expand sidebar"
              >
                <IconSidebarOpen />
              </button>
            )}
            <div className="breadcrumb-trail">
              <span className="breadcrumb-root">Memory Console</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {screens.find((s) => s.key === activeScreen)?.label || 'Overview'}
              </span>
            </div>
          </div>

          <div className="top-header-right">
            <div className="status-badge-inline" title="Bridge Status">
              <span
                className="pulse-dot"
                style={{
                  background: isStreaming ? 'var(--status-success)' : 'var(--status-warning)',
                }}
              />
              <span className="mono" style={{ fontSize: '0.74rem' }}>
                {isStreaming ? '127.0.0.1:4321' : 'Disconnected'}
              </span>
            </div>
            <button
              className="theme-toggle-btn-compact"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle visual theme"
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>
        {fetchError && (
          <div className="error-banner">
            <div>
              <strong>Connection Warning:</strong> {fetchError}
            </div>
            <button
              className="btn btn-outline"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => {
                void fetchStats();
                void fetchRecords();
                void fetchApprovals();
              }}
            >
              Retry
            </button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route
            path="/overview"
            element={<OverviewScreen stats={stats} isLoading={isLoading} onNavigate={routeTo} />}
          />
          <Route
            path="/feed"
            element={<LiveFeedScreen events={events} isStreaming={isStreaming} onClear={() => setEvents([])} />}
          />
          <Route
            path="/records"
            element={<RecordBrowserScreen records={records} isLoading={isLoading} onFetchDetail={handleFetchRecordDetail} />}
          />
          <Route
            path="/explain"
            element={<ExplainabilityScreen onFetchExplainability={handleFetchExplainability} />}
          />
          <Route
            path="/approvals"
            element={
              <ApprovalQueueScreen
                approvals={approvals}
                isLoading={isLoading}
                onDecision={handleDecision}
                onRefresh={fetchApprovals}
              />
            }
          />
          <Route path="/security" element={<SecurityAuditScreen onFetchAudit={handleFetchAudit} />} />
          <Route path="/benchmarks" element={<BenchmarkScreen onFetchBenchmarks={handleFetchBenchmarks} />} />
        </Routes>
      </main>
    </div>
  );
}
