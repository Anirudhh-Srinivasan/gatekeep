import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
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
  const { isChecking, checkError, runCheck, depth } = useGatekeeperStore();

  if (!result) {
    return (
      <section className="verdict-light-card is-empty" aria-labelledby="verdict-empty-title">
        <div className="verdict-sphere-decoration" aria-hidden="true" />
        <div className="verdict-card-content">
          <div className="verdict-top-meta">
            <span className="verdict-kicker-tag">AWAITING CHECK</span>
            <span className="verdict-timestamp-stub">Ready to evaluate</span>
          </div>

          <div className="verdict-display-group">
            <h2 id="verdict-empty-title" className="verdict-display-word empty-word">
              No Check Yet
            </h2>
            <div className="verdict-display-subline empty-subline">
              <Sparkles size={18} aria-hidden="true" />
              <span>Awaiting artifact verification</span>
            </div>
          </div>

          <div className="verdict-body-explanation">
            {isChecking ? (
              <div className="skeleton-stack" aria-label="Evaluating checkpoint">
                <i />
                <i />
                <i />
              </div>
            ) : checkError ? (
              <div className="error-state" role="alert">
                <span>{checkError}</span>
                <button className="retry-button" type="button" onClick={() => void runCheck().catch(() => undefined)}>
                  Retry
                </button>
              </div>
            ) : (
              <p className="verdict-empty-deck">
                Select a target artifact, action, and trace depth in the console, then click <strong>Check reason</strong> to return a verdict and inspect the live evidence path.
              </p>
            )}
          </div>

          <div className="verdict-meta-row empty-meta-preview">
            <span className="meta-pill-chip">target <strong>pending</strong></span>
            <span className="meta-pill-chip">action <strong>pending</strong></span>
            <span className="meta-pill-chip">depth <strong>{depth} hops</strong></span>
          </div>
        </div>
      </section>
    );
  }

  const owner = result.owner;

  return (
    <motion.section
      key={`${result.answer_id}-${ripple}`}
      className={`verdict-light-card ${verdictPatternClass(result.verdict)} ${ripple > 0 ? 'ripple-flash' : ''}`}
      initial={{ opacity: 0.6, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.3 }}
      aria-live="polite"
      aria-labelledby="verdict-title"
    >
      {/* Decorative orange 3D gradient sphere from reference */}
      <div className="verdict-sphere-decoration" aria-hidden="true" />

      <div className="verdict-card-content">
        {/* Top meta row */}
        <div className="verdict-top-meta">
          <div className="verdict-kicker-tag">
            <span className={`verdict-signal ${verdictClass(result.verdict)}`} aria-hidden="true" />
            <span>RECORDED DECISION CHECK</span>
          </div>
          <span className="verdict-answer-id">{result.answer_id}</span>
        </div>

        {/* Display Typography: Very large verdict word + grey secondary line below */}
        <div className={`verdict-display-group verdict-border-${result.verdict.toLowerCase()}`}>
          <div id="verdict-title" className={`verdict-display-word ${verdictClass(result.verdict)}`}>
            {result.verdict}
          </div>
          <div className="verdict-display-subline">
            <VerdictMark verdict={result.verdict} />
          </div>
        </div>

        {/* Verdict Explanation and Notes */}
        <div className="verdict-body-explanation">
          <p className="verdict-reason-text">{verdictReason(result)}</p>
          {result.note && <p className="verdict-note-text">{result.note}</p>}
        </div>

        {/* Metadata chips */}
        <div className="verdict-meta-row" aria-label="Verdict checkpoint context">
          <span className="meta-pill-chip">
            target <strong>{result.target}</strong>
          </span>
          <span className="meta-pill-chip">
            action <strong>{result.action.replace('_', ' ')}</strong>
          </span>
          <span className="meta-pill-chip">
            depth <strong>{result.depth} · {result.depth === 1 ? 'shallow' : 'full path'}</strong>
          </span>
          {owner && (
            <span className="meta-pill-chip owner-chip">
              owner <strong>{owner.team} / {owner.people.join(', ')}</strong>
              <ArrowUpRight size={13} aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Evidence path: readable vertical list */}
        <div className="evidence-section" aria-labelledby="evidence-heading">
          <div className="evidence-header-row">
            <h3 id="evidence-heading" className="evidence-heading-text">
              Evidence path · returned with answer
            </h3>
            <span className="evidence-depth-tag">
              {result.depth === 1 ? 'depth 1 (shallow)' : `full depth ${result.depth}`}
            </span>
          </div>

          {result.path.nodes.length === 0 ? (
            <div className="evidence-empty-message">No evidence path returned.</div>
          ) : (
            <div className="vertical-evidence-list" aria-label="Evidence path, top to bottom">
              {result.path.nodes.map((node, index) => {
                const edge =
                  index > 0
                    ? result.path.edges.find(
                        (candidate) =>
                          candidate.source === result.path.nodes[index - 1].id && candidate.target === node.id
                      )
                    : undefined;

                const nodeCard = (
                  <div className="vertical-node-card">
                    <span className="vertical-node-type-badge">{node.type}</span>
                    <strong className="vertical-node-id">{node.id}</strong>
                    <span className="vertical-node-label-desc">{node.label}</span>
                  </div>
                );

                return (
                  <div className="vertical-evidence-step" key={`${node.id}-${index}`}>
                    {index > 0 && (
                      <div className="vertical-step-connector">
                        <span className="vertical-line-segment" aria-hidden="true" />
                        <span className="vertical-edge-label">
                          {edge ? edgeLabel(edge.label ?? edge.type) : 'continues to'}
                        </span>
                        <span
                          className={`provenance-pill is-${(edge?.provenance ?? 'SYNTHETIC').toLowerCase()}`}
                          title={`Provenance: ${edge?.provenance ?? 'SYNTHETIC'}`}
                        >
                          {edge?.provenance ?? 'SYNTHETIC'}
                        </span>
                      </div>
                    )}
                    {node.type === 'Decision' ? (
                      <button
                        type="button"
                        className="vertical-node-interactive is-decision"
                        onClick={() => onDecisionClick(node.id)}
                        aria-label={`Inspect decision ${node.id}: ${node.label}`}
                      >
                        {nodeCard}
                      </button>
                    ) : (
                      <div className={`vertical-node-static is-${node.type.toLowerCase()}`}>
                        {nodeCard}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Provenance Legend */}
          <div className="provenance-legend-bar" aria-label="Evidence edge provenance legend">
            <span className="legend-title">Edge provenance</span>
            <div className="legend-items">
              <span className="provenance-pill is-real">REAL</span>
              <span className="provenance-pill is-curated">CURATED</span>
              <span className="provenance-pill is-synthetic">SYNTHETIC</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
