import { motion } from 'framer-motion';
import { ArrowUpRight, ShieldAlert } from 'lucide-react';
import type { CheckResponse } from '../api/types';
import { EvidencePath } from './EvidencePath';
import { verdictClass, verdictPatternClass, verdictReason } from './verdictText';

interface VerdictCardProps {
  result: CheckResponse | null;
  onDecisionClick: (decision: string) => void;
  ripple: number;
}

export function VerdictCard({ result, onDecisionClick, ripple }: VerdictCardProps): JSX.Element {
  if (!result) {
    return <section className="panel verdict-panel"><div className="panel-body empty-state">Run a checkpoint to return a verdict and its evidence path. The graph is waiting.</div></section>;
  }
  const owner = result.owner;
  return (
    <motion.section key={`${result.answer_id}-${ripple}`} className={`panel verdict-panel ${verdictPatternClass(result.verdict)} ${ripple > 0 ? 'ripple-flash' : ''}`} initial={{ opacity: .5, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }} aria-live="polite">
      <div className="panel-body">
        <div className="verdict-header">
          <div className="verdict-kicker"><span className={`verdict-signal ${verdictClass(result.verdict)}`} /><ShieldAlert size={14} aria-hidden="true" /> recorded decision check</div>
          <span className="answer-id">{result.answer_id}</span>
        </div>
        <motion.div key={result.verdict} className={`verdict-word ${verdictClass(result.verdict)}`} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .25 }}>{result.verdict}</motion.div>
        <p className="verdict-reason">{verdictReason(result)}</p>
        <p className="verdict-note">{result.note}</p>
        <div className="verdict-meta">
          <span className="meta-chip">target <strong>{result.target}</strong></span>
          <span className="meta-chip">action <strong>{result.action.replace('_', ' ')}</strong></span>
          <span className="meta-chip">depth <strong>{result.depth} · {result.depth === 1 ? 'shallow' : 'full path'}</strong></span>
          {owner && <span className="meta-chip">owner <strong>{owner.team} / {owner.people.join(', ')}</strong> <ArrowUpRight size={12} aria-hidden="true" /></span>}
        </div>
        <EvidencePath result={result} onDecisionClick={onDecisionClick} />
      </div>
    </motion.section>
  );
}
