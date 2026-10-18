import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { CheckResponse } from '../api/types';
import { verdictClass, verdictPatternClass, verdictReason } from './verdictText';
import { VerdictMark } from './VerdictMark';
import { useGatekeeperStore } from '../store/useGatekeeperStore';

interface VerdictCardProps {
  result: CheckResponse | null;
  onDecisionClick: (decision: string) => void;
  ripple: number;
}

const edgeLabel = (type: string): string => type.replaceAll('_', ' ').toLowerCase();

export function VerdictCard({ result, onDecisionClick, ripple }: VerdictCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const { isChecking, checkError, runCheck } = useGatekeeperStore();
  if (!result) {
    return <section className="panel verdict-panel"><div className="panel-body">{isChecking ? <div className="skeleton-stack" aria-label="Loading verdict"><i /><i /><i /></div> : checkError ? <div className="error-state">{checkError}<button className="retry-button" type="button" onClick={() => void runCheck().catch(() => undefined)}>Retry</button></div> : <div className="empty-state">Run a checkpoint to return a verdict and its evidence path. The graph is waiting.</div>}</div></section>;
  }
  const owner = result.owner;
  return (
    <motion.section key={`${result.answer_id}-${ripple}`} className={`panel verdict-panel ${verdictPatternClass(result.verdict)} ${ripple > 0 ? 'ripple-flash' : ''}`} initial={{ opacity: .5, y: reduceMotion ? 0 : 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? .01 : .3 }} aria-live="polite">
      <div className="panel-body">
        <div className="verdict-header">
          <div className="verdict-kicker"><span className={`verdict-signal ${verdictClass(result.verdict)}`} /> recorded decision check</div>
          <span className="answer-id">{result.answer_id}</span>
        </div>
        <div className={`verdict-heading verdict-border-${result.verdict.toLowerCase()}`}><VerdictMark verdict={result.verdict} /><motion.div key={result.verdict} className={`verdict-word ${verdictClass(result.verdict)}`} initial={{ opacity: 0, scale: reduceMotion ? 1 : .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? .01 : .25 }}>{result.verdict}</motion.div></div>
        <p className="verdict-reason">{verdictReason(result)}</p>
        <p className="verdict-note">{result.note}</p>
        <div className="verdict-meta">
          <span className="meta-chip">target <strong>{result.target}</strong></span>
          <span className="meta-chip">action <strong>{result.action.replace('_', ' ')}</strong></span>
          <span className="meta-chip">depth <strong>{result.depth} · {result.depth === 1 ? 'shallow' : 'full path'}</strong></span>
          {owner && <span className="meta-chip">owner <strong>{owner.team} / {owner.people.join(', ')}</strong> <ArrowUpRight size={12} aria-hidden="true" /></span>}
        </div>
        <div className="evidence-wrap">
          <div className="evidence-title"><h3>Evidence path · returned with answer</h3><span>{result.depth === 1 ? 'depth 1' : `full depth ${result.depth}`}</span></div>
          {result.path.nodes.length === 0 ? <div className="evidence-empty">No evidence path returned.</div> : <div className="vertical-evidence" aria-label="Evidence path, top to bottom">
            {result.path.nodes.map((node, index) => {
              const edge = index > 0 ? result.path.edges.find((candidate) => candidate.source === result.path.nodes[index - 1].id && candidate.target === node.id) : undefined;
              const card = <><span className="vertical-node-type">{node.type}</span><strong>{node.id}</strong><span className="vertical-node-label">{node.label}</span></>;
              return <div className="vertical-evidence-item" key={`${node.id}-${index}`}>
                {index > 0 && <div className="vertical-evidence-edge"><span className="vertical-edge-line" aria-hidden="true" /><span className="vertical-edge-label">{edge ? edgeLabel(edge.label ?? edge.type) : 'continues to'}</span><span className={`provenance-badge is-${(edge?.provenance ?? 'SYNTHETIC').toLowerCase()}`}>{edge?.provenance ?? 'SYNTHETIC'}</span></div>}
                {node.type === 'Decision' ? <button type="button" className="vertical-evidence-node is-decision" onClick={() => onDecisionClick(node.id)}>{card}</button> : <div className={`vertical-evidence-node is-${node.type.toLowerCase()}`}>{card}</div>}
              </div>;
            })}
          </div>}
          <div className="provenance-legend" aria-label="Evidence provenance legend"><span>Edge provenance</span><i className="provenance-badge is-real">REAL</i><i className="provenance-badge is-curated">CURATED</i><i className="provenance-badge is-synthetic">SYNTHETIC</i></div>
        </div>
      </div>
    </motion.section>
  );
}
