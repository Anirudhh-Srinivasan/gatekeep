import { useEffect, useState } from 'react';
import type { CheckResponse } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';
import { verdictClass, verdictReason } from './verdictText';

interface DepthSideProps { label: string; depth: number; result: CheckResponse | null; }

function DepthSide({ label, depth, result }: DepthSideProps): JSX.Element {
  if (!result) return <div className="contrast-side"><div className="contrast-label"><span>{label}</span><strong>depth {depth}</strong></div><div className="empty-state" style={{ marginTop: 18 }}>Run the checkpoint to compare.</div></div>;
  return (
    <div className={`contrast-side ${result.verdict === 'STALE' ? 'is-flipped' : ''}`}>
      <div className="contrast-label"><span>{label}</span><strong>depth {depth}</strong></div>
      <div className={`contrast-verdict ${verdictClass(result.verdict)}`}>{result.verdict}</div>
      <p className="contrast-reason">{verdictReason(result)}</p>
      {result.stale[0]?.dead_premises[0] && <div className="flip-callout">dead premise: <strong>{result.stale[0].dead_premises[0].id}</strong> · hop {result.stale[0].dead_premises[0].hops}</div>}
    </div>
  );
}

export function DepthContrast(): JSX.Element {
  const { depth, setDepth, shallowResult, fullResult, runContrast, isChecking } = useGatekeeperStore();
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
        {isChecking && <div style={{ marginTop: 13 }}><span className="loading-line" /></div>}
        <div className="contrast-grid">
          <DepthSide label="shallow check" depth={1} result={shallowResult} />
          <DepthSide label="full check" depth={Math.max(4, depth)} result={fullResult} />
        </div>
        {hasFlip && <div className="flip-callout" style={{ marginTop: 15 }}>same action, different depth → <strong>{shallowResult.verdict}</strong> becomes <strong>{fullResult.verdict}</strong>. The deeper path found a reason that expired.</div>}
        <p className="depth-footnote">Gatekeeper does not call this safe when nothing is known. It reports what the recorded graph can prove, and where it stops.</p>
      </div>
    </section>
  );
}
