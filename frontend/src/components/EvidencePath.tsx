import { motion } from 'framer-motion';
import type { CheckResponse, PathNode } from '../api/types';

interface EvidencePathProps {
  result: CheckResponse;
  onDecisionClick: (decision: string) => void;
}

const nodeStatus = (node: PathNode, result: CheckResponse): 'live' | 'dead' | 'neutral' => {
  if (node.type === 'Artifact') return 'neutral';
  if (node.status !== 'live') return 'dead';
  if (result.stale.some((item) => item.decision === node.id)) return 'dead';
  return 'live';
};

export function EvidencePath({ result, onDecisionClick }: EvidencePathProps): JSX.Element {
  const nodes = result.path.nodes;
  const stalePremises = result.stale.flatMap((item) => item.dead_premises);
  if (nodes.length === 0) return <div className="evidence-empty">No evidence path returned.</div>;
  return (
    <div className="evidence-wrap">
      <div className="evidence-title">
        <h3>Evidence path · returned with answer</h3>
        <span>{result.depth === 1 ? 'shallow check' : `depth ${result.depth} check`}</span>
      </div>
      <div className="evidence-scroll">
        <div className="evidence-chain" aria-label="Evidence path">
          {nodes.map((node, index) => {
            const status = nodeStatus(node, result);
            const premise = stalePremises.find((item) => item.id === node.id);
            const isDecision = node.type === 'Decision';
            const content = (
              <>
                <div className="node-topline">
                  <span>{node.type}</span>
                  {isDecision && <span className="node-status" style={{ color: status === 'dead' ? 'var(--stale)' : 'var(--allow)' }}><i className="node-status-dot" />{status}</span>}
                </div>
                <div>
                  <div className="node-id">{isDecision ? node.id : node.meta ?? node.id}</div>
                  <div className="node-title">{node.label}</div>
                </div>
                {premise && <span className="node-flag">premise died here · hop {premise.hops}</span>}
              </>
            );
            return (
              <motion.div key={node.id} className="evidence-segment" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .07 }} style={{ display: 'flex', alignItems: 'center' }}>
                {index > 0 && <span className="evidence-connector" aria-hidden="true">{result.path.edges.find((edge) => edge.source === nodes[index - 1].id && edge.target === node.id)?.provenance && <small>{result.path.edges.find((edge) => edge.source === nodes[index - 1].id && edge.target === node.id)?.provenance}</small>}</span>}
                {isDecision ? (
                  <button type="button" className={`evidence-node ${status === 'dead' ? 'is-dead' : 'is-live'}`} onClick={() => onDecisionClick(node.id)} aria-label={`Open why for ${node.id}`}>
                    {content}
                  </button>
                ) : <div className="evidence-node evidence-node-artifact">{content}</div>}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
