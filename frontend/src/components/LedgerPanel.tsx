import { useEffect, useMemo, useState } from 'react';
import { Clock3, RefreshCw, Users, ShieldAlert, FileText } from 'lucide-react';
import { api } from '../api/client';
import type { AffectedResponse } from '../api/types';

interface LedgerPanelProps {
  refreshKey: number;
}

const formatDate = (val: string | number | undefined): string => {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime())
    ? String(val)
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

export function LedgerPanel({ refreshKey }: LedgerPanelProps): JSX.Element {
  const [response, setResponse] = useState<AffectedResponse | null>(null);
  const [showOnlyNamed, setShowOnlyNamed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (): void => {
    setLoading(true);
    setError(null);
    void api
      .affected('D1')
      .then((next) => {
        setResponse(next);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not load ledger');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const visibleRows = useMemo(() => {
    const rows = response?.rows ?? [];
    return showOnlyNamed ? rows.filter((row) => row.person.trim() !== '' && row.person.toLowerCase() !== 'anonymous') : rows;
  }, [response, showOnlyNamed]);
  const distinctViewers = new Set(visibleRows.map((row) => row.person.trim()).filter(Boolean)).size;
  const totalRowCount = response?.rows.length ?? 0;

  return (
    <section className="panel ledger-panel dark-rounded-card" id="ledger" aria-labelledby="ledger-title">
      <div className="card-header-row">
        <div className="card-heading-group">
          <div className="card-kicker">03 / AFFECTED RECORD</div>
          <h2 id="ledger-title" className="card-main-title">
            <Users size={20} aria-hidden="true" />
             <span>Ledger of Affected Answers</span>
          </h2>
          <p className="card-deck">
             When a premise changes, Gatekeeper traces recorded answers linked to it so teams can review downstream impact. Advisory only.
          </p>
        </div>
          <div className="card-header-action">
            <div className="ledger-view-toggle" role="group" aria-label="Ledger row filter">
              <button type="button" className={showOnlyNamed ? 'is-selected' : ''} aria-pressed={showOnlyNamed} onClick={() => setShowOnlyNamed(true)}>Named viewers</button>
              <button type="button" className={!showOnlyNamed ? 'is-selected' : ''} aria-pressed={!showOnlyNamed} onClick={() => setShowOnlyNamed(false)}>Show all</button>
            </div>
            <button
            type="button"
            className="dark-card-action-btn"
            onClick={load}
            disabled={loading}
            aria-label="Refresh affected people ledger"
          >
            <RefreshCw size={13} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      <div className="ledger-card-body">
        {loading ? (
          <div className="skeleton-block" aria-label="Loading affected ledger" />
        ) : error ? (
          <div className="error-state" role="alert">
            <span>{error}</span>
            <button className="retry-button" type="button" onClick={load}>
              Retry
            </button>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="empty-state">{totalRowCount === 0 ? 'No affected answers are recorded for this decision.' : `No named viewers are recorded for this decision. ${totalRowCount} total answer ${totalRowCount === 1 ? 'row is' : 'rows are'} hidden by this filter.`}</div>
        ) : (
          <>
            <div className="ledger-stat-bar">
              <span className="ledger-count-pill">
                <strong>{distinctViewers}</strong> distinct {showOnlyNamed ? 'named ' : ''}{distinctViewers === 1 ? 'viewer' : 'viewers'} represented · {visibleRows.length} recorded answer {visibleRows.length === 1 ? 'row' : 'rows'} shown{showOnlyNamed && totalRowCount !== visibleRows.length ? ` · ${totalRowCount} total rows` : ''}
              </span>
            </div>

            <div className="ledger-table-container">
              <table className="ledger-table" aria-label="Table of recorded affected answers">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Answer / Timestamp</th>
                    <th scope="col">Action Summary</th>
                    <th scope="col">Linked decision</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr className="is-affected" key={row.answer_id}>
                      <td>
                        <div className="ledger-person-cell">
                          <span className="person-avatar-circle" aria-hidden="true">
                            {row.person.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="person-name-text">{row.person}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ledger-time-cell">
                          <code className="person-answer-code">{row.answer_id}</code>
                          <span className="timestamp-label">{formatDate(row.at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ledger-summary-cell">
                          <FileText size={13} aria-hidden="true" />
                          <span>{row.summary}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stale-decision-cell">
                          <code className="decision-code">{row.stale_decision}</code>
                          <span className="stale-status-chip">
                            <Clock3 size={11} aria-hidden="true" />
                            <span>Recorded link</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ledger Path Flow */}
            {response && (
              <div className="ledger-flow-section" aria-label="Ledger dependency path">
                <div className="flow-header">
                  <h3>
                    <ShieldAlert size={14} aria-hidden="true" />
                    <span>Dependency path for {response.decision}</span>
                  </h3>
                  <span className="flow-sub">Premise → Delivered Answers → People</span>
                </div>
                <div className="flow-chain-scroll">
                  <div className="flow-chain-items">
                    {response.path.nodes.map((node, index) => (
                      <span key={`${node.id}-${index}`} className="flow-node-wrapper">
                        {index > 0 && <span className="flow-connector-line" aria-hidden="true" />}
                        <span className="flow-node-chip">
                          <strong className="node-id-text">{node.id}</strong>
                          <span className="node-type-text">{node.type}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ledger-provenance-bar">
                  <span className="legend-label">Recorded edge provenance:</span>
                  <div className="legend-items">
                    {[...new Set(response.path.edges.flatMap((edge) => edge.provenance ? [edge.provenance] : []))].map((provenance) => <span key={provenance} className={`provenance-pill is-${provenance.toLowerCase()}`}>{provenance}</span>)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <p className="ledger-advisory-footnote">
          <strong>Recorded read</strong>: Reflects answers retrieved through Gatekeeper checkpoints. It does not speculate on downstream action.
        </p>
      </div>
    </section>
  );
}
