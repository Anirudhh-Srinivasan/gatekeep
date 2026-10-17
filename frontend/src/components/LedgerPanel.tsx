import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AffectedResponse } from '../api/types';

interface LedgerPanelProps { refreshKey: number; }

export function LedgerPanel({ refreshKey }: LedgerPanelProps): JSX.Element {
  const [response, setResponse] = useState<AffectedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    void api.affected('D1').then((next) => { setResponse(next); setLoading(false); }).catch(() => setLoading(false));
  }, [refreshKey]);
  return (
    <section className="panel" aria-labelledby="ledger-title">
      <div className="panel-header"><div><h2 id="ledger-title" className="panel-title">Affected / answer ledger</h2><p className="panel-description">A reversal can point to the people who were given the old answer — not a claim about what they did afterward.</p></div><span className="eyebrow-tag" style={{ padding: '6px 8px', color: 'var(--stale)', borderColor: 'rgba(228,198,98,.3)' }}>D1 ripple</span></div>
      <div className="panel-body"><div className="ledger-table-wrap">{loading ? <div className="empty-state">Reading the answer ledger…</div> : <table className="ledger-table"><thead><tr><th>person</th><th>answer / time</th><th>summary</th><th>decision used</th></tr></thead><tbody>{(response?.rows ?? []).map((row) => <tr className="is-stale" key={row.answer_id}><td><div className="person-cell">{row.person}</div><code>{row.answer_id}</code></td><td><div className="verdict-stale" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>retrieved</div><span>{new Date(row.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></td><td>{row.summary}</td><td><code>{row.stale_decision}</code><div style={{ marginTop: 6, color: 'var(--stale)', fontFamily: 'var(--mono)', fontSize: 9 }}>now stale</div></td></tr>)}</tbody></table>}</div>{response && <div className="ledger-path" aria-label="Affected ledger graph path"><div className="evidence-title"><h3>Ledger path · {response.decision}</h3><span>decision → answers → people</span></div><div className="evidence-scroll"><div className="evidence-chain">{response.path.nodes.map((node, index) => <span key={`${node.id}-${index}`} style={{ display: 'inline-flex', alignItems: 'center' }}>{index > 0 && <span className="evidence-connector" aria-hidden="true" />}<span className="meta-chip"><strong>{node.id}</strong><span>{node.type}</span></span></span>)}</div></div></div>}<p className="ledger-footnote"><strong>used</strong> = retrieved by Gatekeeper, not causally proven. This only covers answers given through Gatekeeper.</p></div>
    </section>
  );
}
