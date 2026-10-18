import { useMemo, useState } from 'react';
import { ArrowRight, GitBranch, Hash, Type, RotateCcw } from 'lucide-react';
import type { GraphNode } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';
import { verdictClass } from './verdictText';

interface ReversePanelProps { graphNodes: GraphNode[]; }

export function ReversePanel({ graphNodes }: ReversePanelProps): JSX.Element {
  const { lastReverse, reverse, reverseInFlight } = useGatekeeperStore();
  const decisions = useMemo(() => graphNodes.filter((node) => node.type === 'Decision'), [graphNodes]);
  const [old, setOld] = useState('D1');
  const [newId, setNewId] = useState('D4');
  const [newTitle, setNewTitle] = useState('Drop Windows 7 support');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = lastReverse && !lastReverse.committed ? lastReverse : null;
  const committedPeople = lastReverse?.committed ? lastReverse.affected_people.length : null;
  const runDry = async (): Promise<void> => {
    setError(null);
    if (!old || !newId || !newTitle) { setError('Fill every field before previewing the reversal.'); return; }
    try { await reverse(old, newId, newTitle, true); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Preview failed'); }
  };
  const commit = async (): Promise<void> => {
    try { await reverse(old, newId, newTitle, false); setConfirming(false); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Commit failed'); }
  };
  return (
    <section className="panel" aria-labelledby="reverse-title">
      <div className="panel-header"><div><h2 id="reverse-title" className="panel-title"><RotateCcw size={15} style={{ verticalAlign: 'text-bottom', marginRight: 7 }} /> Reverse a decision</h2><p className="panel-description">Preview the ripple before you update the record. A commit creates a new live decision and marks the old one superseded.</p></div><span className="eyebrow-tag" style={{ padding: '6px 8px' }}>write path</span></div>
      <div className="panel-body reverse-layout">
        <div className="reverse-form">
          <label className="field-wrap"><span className="field-label">Decision being replaced</span><GitBranch className="field-icon-chip" size={15} aria-hidden="true" /><select className="field-select" value={old} onChange={(event) => setOld(event.target.value)}>{decisions.map((node) => <option key={node.id} value={node.id}>{node.id} — {node.label}</option>)}</select></label>
          <label className="field-wrap"><span className="field-label">New decision id</span><Hash className="field-icon-chip" size={15} aria-hidden="true" /><input className="field-input" aria-label="New decision id" value={newId} onChange={(event) => setNewId(event.target.value)} /></label>
          <label className="field-wrap"><span className="field-label">New title</span><Type className="field-icon-chip" size={15} aria-hidden="true" /><input className="field-input" aria-label="New title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></label>
          {error && <div className="form-error">{error}</div>}
          <button type="button" className="primary-button" onClick={() => void runDry()} disabled={reverseInFlight}>{reverseInFlight ? 'Working…' : <>Dry-run flip preview <ArrowRight size={13} style={{ verticalAlign: 'middle' }} /></>}</button>
        </div>
        <div>
          {!preview && <div className="empty-state">No pending reversal. Choose a decision and run a dry run — the graph stays untouched.</div>}
          {preview && <div className="flip-preview glass-card"><h3>Dry run · no changes written</h3>{preview.flips.length === 0 ? <div className="owner-empty" style={{ marginTop: 12 }}>No graph-derived verdicts change for this reversal.</div> : preview.flips.map((flip) => <div className="flip-row" key={`${flip.target}-${flip.action}-${flip.decision}`}><strong>{flip.target} · {flip.action}</strong><span className={verdictClass(flip.from_verdict)}>{flip.from_verdict}</span><span className="flip-arrow">→</span><span className={verdictClass(flip.to_verdict)}>{flip.to_verdict}</span><span style={{ color: 'var(--quiet)' }}>{flip.decision}</span></div>)}<div className="affected-preview"><h4>People who received the old answer</h4>{preview.affected_people.length === 0 ? <div className="owner-empty">No Gatekeeper answers are linked to this decision.</div> : preview.affected_people.map((person) => <div className="affected-person" key={person.answer_id}><span><strong>{person.person}</strong> · {person.answer_id}</span><span>{person.stale_decision}</span></div>)}</div><button type="button" className="primary-button" style={{ marginTop: 17 }} onClick={() => setConfirming(true)}>Continue to commit</button></div>}
          {committedPeople !== null && <div className="commit-complete" role="status">{committedPeople} {committedPeople === 1 ? 'person was' : 'people were'} told the old answer.</div>}
          {confirming && <div className="commit-confirm"><p>This writes <strong>{newId}</strong>, marks <strong>{old}</strong> superseded, and reruns the depth contrast. Continue?</p><div className="confirm-actions"><button type="button" className="primary-button" onClick={() => void commit()} disabled={reverseInFlight}>{reverseInFlight ? 'Committing…' : 'Commit reversal'}</button><button type="button" className="ghost-button" onClick={() => setConfirming(false)} disabled={reverseInFlight}>Cancel</button></div></div>}
        </div>
      </div>
    </section>
  );
}
