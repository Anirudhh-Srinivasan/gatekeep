import { useEffect, useState } from 'react';
import { Clock3, RefreshCw, Users, ShieldAlert, FileText } from 'lucide-react';
import { api } from '../api/client';
import type { AffectedResponse } from '../api/types';

interface LedgerPanelProps {
  refreshKey: number;
}

export function LedgerPanel({ refreshKey }: LedgerPanelProps): JSX.Element {
  const [response, setResponse] = useState<AffectedResponse | null>(null);
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

  return (
    <section className="panel ledger-panel dark-rounded-card" id="ledger" aria-labelledby="ledger-title">
      <div className="card-header-row">
        <div className="card-heading-group">
          <div className="card-kicker">03 / AFFECTED RECORD</div>
          <h2 id="ledger-title" className="card-main-title">
            <Users size={20} aria-hidden="true" />
            <span>Ledger of Affected People</span>
          </h2>
          <p className="card-deck">
            When a premise dies, Gatekeeper traces who received verdicts derived from it so they can be notified proactively.
          </p>
        </div>
        <div className="card-header-action">
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
        ) : response?.rows.length === 0 ? (
          <div className="empty-state">No affected answers are recorded for this decision.</div>
        ) : (
          <>
            <div className="ledger-stat-bar">
              <span className="ledger-count-pill">
                <strong>{response?.rows.length ?? 0}</strong> people received answers based on superseded decision {response?.decision ?? 'D1'}
              </span>
            </div>

            <div className="ledger-table-container">
              <table className="ledger-table" aria-label="Table of affected people and answers">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Answer / Timestamp</th>
                    <th scope="col">Action Summary</th>
                    <th scope="col">Supervened Premise</th>
                  </tr>
                </thead>
                <tbody>
                  {(response?.rows ?? []).map((row) => (
                    <tr className="is-stale" key={row.answer_id}>
                      <td>
                        <div className="ledger-person-cell">
                          <span className="person-avatar-circle" aria-hidden="true">
                            {row.person.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="person-details">
                            <strong className="person-name-text">{row.person}</strong>
                            <code className="person-answer-code">{row.answer_id}</code>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="ledger-time-cell">
                          <span className="timestamp-label">
                            {new Date(row.at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
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
                            <span>Now Stale</span>
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
                {/* Provenance Badges & Legend */}
                <div className="ledger-provenance-bar">
                  <span className="legend-label">Edge provenance:</span>
                  <div className="legend-items">
                    <span className="provenance-pill is-real">REAL</span>
                    <span className="provenance-pill is-curated">CURATED</span>
                    <span className="provenance-pill is-synthetic">SYNTHETIC</span>
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
