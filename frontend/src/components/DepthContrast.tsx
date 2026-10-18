import { useEffect, useState } from 'react';
import type { CheckResponse } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';
import { verdictClass, verdictReason } from './verdictText';

interface DepthSideProps { label: string; depth: number; result: CheckResponse | null; }

function DepthSide({ label, depth, result }: DepthSideProps): JSX.Element {
  if (!result) return <div className="contrast-side"><div className="contrast-label"><span>{label}</span><strong>depth {depth}</strong></div><div className="empty-state" style={{ marginTop: 18 }}>Run Check to compare.</div></div>;
  return (
    <div className={`contrast-side glass-card ${result.verdict === 'STALE' ? 'is-flipped' : ''}`}>
      <div className="contrast-label"><span>{label}</span><strong>Depth {depth}</strong></div>
      <div className={`contrast-verdict ${verdictClass(result.verdict)}`}>{result.verdict}</div>
      <p className="contrast-reason">{verdictReason(result)}</p>
      {result.stale[0]?.dead_premises[0] && <div className="flip-callout">dead premise: <strong>{result.stale[0].dead_premises[0].id}</strong> · hop {result.stale[0].dead_premises[0].hops}</div>}
    </div>
  );
}

export function DepthContrast(): JSX.Element {
  const { depth, setDepth, shallowResult, fullResult, runContrast, isChecking, checkError } = useGatekeeperStore();
  const [sliderValue, setSliderValue] = useState(depth);
  useEffect(() => setSliderValue(depth), [depth]);
  const hasFlip = shallowResult && fullResult && shallowResult.verdict !== fullResult.verdict;
  const handleChange = (value: number): void => {
    setSliderValue(value);
    setDepth(value);
    void runContrast(value);
  };
  return (
    <section className="panel depth-panel" aria-labelledby="depth-title">
      <div className="panel-header">
        <div><h2 id="depth-title" className="panel-title">The depth contrast</h2><p className="panel-description">A shallow check can look fine because it stops before the reason that died. Full means four or more hops — deliberately not the same question.</p></div>
        <span className="eyebrow-tag" style={{ padding: '6px 8px', color: 'var(--stale)', borderColor: 'rgba(228,198,98,.3)' }}>money shot</span>
      </div>
      <div className="depth-body">
        <div className="depth-controls">
          <span className="depth-label">trace depth</span>
          <input type="range" min="1" max="6" step="1" value={sliderValue} onChange={(event) => handleChange(Number(event.target.value))} aria-label="Trace depth from one to six" />
          <span className="depth-number">{sliderValue} / 6</span>
        </div>
        {isChecking && <div className="skeleton-stack" style={{ marginTop: 13 }} aria-label="Loading depth comparison"><i /><i /></div>}
        {checkError && <div className="error-state" style={{ marginTop: 13 }}>{checkError}<button className="retry-button" type="button" onClick={() => void runContrast(depth).catch(() => undefined)} disabled={isChecking}>Retry</button></div>}
        <div className="contrast-grid">
          <DepthSide label="shallow check" depth={1} result={shallowResult} />
          <DepthSide label="full check" depth={Math.max(4, depth)} result={fullResult} />
        </div>
        {hasFlip && <div className="flip-callout flip-summary" aria-live="polite"><span className="flip-summary-label">Depth changed the answer</span><strong>Depth 1: {shallowResult.verdict} <span aria-hidden="true">→</span> Full depth: {fullResult.verdict}</strong><span>{fullResult.stale[0]?.dead_premises[0]?.id ? `because ${fullResult.stale[0].dead_premises[0].id} was reversed` : 'because a recorded premise is no longer live'}</span></div>}
        <p className="depth-footnote">Gatekeeper does not call this safe when nothing is known. It reports what the recorded graph can prove, and where it stops.</p>
      </div>
    </section>
  );
}
