import type { LoadBearingItem } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';

export function LoadBearingPanel({ items }: { items: LoadBearingItem[] }): JSX.Element {
  const { isLoadingGraph, graphError, refreshGraph } = useGatekeeperStore();
  return <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Load-bearing decisions</h2><p className="panel-description">Dependency centrality, not a safety score.</p></div></div><div className="panel-body">{isLoadingGraph ? <div className="skeleton-stack" aria-label="Loading dependency ranks"><i /><i /><i /></div> : graphError ? <div className="error-state">{graphError}<button className="retry-button" type="button" onClick={() => void refreshGraph().catch(() => undefined)}>Retry</button></div> : items.length === 0 ? <div className="empty-state">Ranking unavailable on this deployment</div> : <div className="load-list">{items.map((item, index) => <div className="load-item" key={item.id}><span className="load-rank">0{index + 1}</span><span className="load-name" title={item.title}>{item.id} · {item.title}</span><span className="load-score">{item.score.toFixed(2)}</span><div className="load-bar"><span style={{ width: `${item.score * 100}%` }} /></div></div>)}</div>}</div></section>;
}
