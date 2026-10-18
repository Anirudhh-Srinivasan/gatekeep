import { useEffect, useState } from 'react';
import { ArrowRightLeft, Clock3, Layers, Sliders } from 'lucide-react';
import type { CheckResponse } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';
import { verdictClass, verdictReason } from './verdictText';
import { VerdictMark } from './VerdictMark';

interface DepthSideProps {
  label: string;
  depth: number;
  result: CheckResponse | null;
}

function DepthSide({ label, depth, result }: DepthSideProps): JSX.Element {
  if (!result) {
    return (
      <div className="contrast-card is-empty">
        <div className="contrast-card-header">
          <span className="contrast-card-label">{label}</span>
          <span className="contrast-card-depth">Depth {depth}</span>
        </div>
        <div className="contrast-empty-body">
          <Layers size={20} aria-hidden="true" />
          <p>Run Check to compare depth behaviors.</p>
        </div>
      </div>
    );
  }

  const deadPremise = result.stale?.[0]?.dead_premises?.[0];
  const borderClass = `verdict-border-${result.verdict.toLowerCase()}`;

  return (
    <div
      className={`contrast-card ${borderClass} ${result.verdict === 'STALE' ? 'is-flipped' : ''}`}
      aria-label={`${label} result: ${result.verdict}`}
    >
      <div className="contrast-card-header">
        <span className="contrast-card-label">{label}</span>
        <span className="contrast-card-depth">
          Depth {result.depth} {result.depth === 1 ? '· Shallow' : '· Full graph'}
        </span>
      </div>

      <div className="contrast-verdict-row">
        <div className={`contrast-verdict-title ${verdictClass(result.verdict)}`}>
          {result.verdict}
        </div>
        <div className="contrast-verdict-badge">
          <VerdictMark verdict={result.verdict} />
        </div>
      </div>

      <p className="contrast-reason-copy">{verdictReason(result)}</p>

      {deadPremise?.id && (
        <div className="dead-premise-chip" role="status">
          <Clock3 size={14} aria-hidden="true" />
          <span>
            Dead premise: <strong>{deadPremise.id}</strong>
            {typeof deadPremise.hops === 'number' && ` (hop ${deadPremise.hops})`}
          </span>
        </div>
      )}

      {result.path?.edges?.length > 0 && (
        <div className="contrast-edge-provenance">
          <span className="provenance-label">Path edges:</span>
          <div className="provenance-badges-inline">
            {Array.from(new Set(result.path.edges.flatMap((e) => e.provenance ? [e.provenance] : []))).map((prov) => (
              <span key={prov} className={`provenance-pill is-${prov.toLowerCase()}`}>
                {prov}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Internal props: testShallow and testFull exist solely for automated vitest unit testing.
// In production usage, DepthContrast is rendered without arguments and consumes state from useGatekeeperStore.
interface DepthContrastProps {
  testShallow?: CheckResponse | null;
  testFull?: CheckResponse | null;
}

export function DepthContrast({ testShallow, testFull }: DepthContrastProps = {}): JSX.Element {
  const store = useGatekeeperStore();
  const shallowResult = testShallow !== undefined ? testShallow : store.shallowResult;
  const fullResult = testFull !== undefined ? testFull : store.fullResult;
  const { depth, setDepth, runContrast, isChecking, checkError } = store;
  const [sliderValue, setSliderValue] = useState(depth);

  useEffect(() => setSliderValue(depth), [depth]);

  const hasFlip = Boolean(shallowResult && fullResult && shallowResult.verdict !== fullResult.verdict);
  const deadPremise = fullResult?.stale?.[0]?.dead_premises?.[0];

  const handleChange = (value: number): void => {
    setSliderValue(value);
    setDepth(value);
    void runContrast(value).catch(() => undefined);
  };

  const getFlipExplanation = (): string => {
    if (!shallowResult || !fullResult) return '';
    if (deadPremise?.id) {
      const hopInfo = typeof deadPremise.hops === 'number' ? ` at hop ${deadPremise.hops}` : '';
      return `Premise ${deadPremise.id} was invalidated${hopInfo}. Shallow checks miss this deeper dependency.`;
    }
    if (fullResult.verdict === 'STALE') {
      return 'A recorded premise in the full dependency chain is no longer live, inverting the verdict from live to stale.';
    }
    if (fullResult.verdict === 'BLOCK') {
      return 'A deeper traversal uncovered a high-severity prohibition blocking this action.';
    }
    if (fullResult.verdict === 'UNGOVERNED') {
      return 'The full path revealed that no recorded governance covers this action.';
    }
    return `Depth traversal changed the verdict from ${shallowResult.verdict} to ${fullResult.verdict}.`;
  };

  const queriedFullDepth = fullResult?.depth ?? Math.max(4, sliderValue);

  return (
    <section className="panel depth-contrast-panel" aria-labelledby="depth-title">
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-kicker">01 / TRACE DEEPER</div>
          <h2 id="depth-title" className="panel-title">
            The Depth Contrast
          </h2>
          <p className="panel-description">
            A shallow check can look fine because it stops before the reason that died. Full depth traverses the entire dependency graph to uncover invalidated premises.
          </p>
        </div>
        <span className="contrast-pill-tag">
          Depth 1 vs Full Depth
        </span>
      </div>

      <div className="depth-body-container">
        {/* Depth slider control with pill styling */}
        <div className="depth-slider-block">
          <div className="slider-label-row">
            <span className="slider-label">
              <Sliders size={14} aria-hidden="true" />
              <span>Full check trace depth</span>
            </span>
            <span className="slider-value-badge">{sliderValue} hops</span>
          </div>
          <div className="slider-input-row">
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              value={sliderValue}
              onChange={(event) => handleChange(Number(event.target.value))}
              aria-label="Trace depth from 1 to 6 hops"
              className="depth-range-slider"
            />
            <div className="slider-ticks" aria-hidden="true">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
            </div>
          </div>
        </div>

        {isChecking && (
          <div className="skeleton-stack" aria-label="Loading depth comparison">
            <i />
            <i />
          </div>
        )}

        {checkError && (
          <div className="error-state" role="alert">
            <span>{checkError}</span>
            <button
              className="retry-button"
              type="button"
              onClick={() => void runContrast(depth).catch(() => undefined)}
              disabled={isChecking}
            >
              Retry
            </button>
          </div>
        )}

        {/* Side-by-side cards: Depth 1 vs Full depth */}
        <div className="contrast-side-by-side" aria-label="Depth comparison side by side">
          <DepthSide
            label="Depth 1 (Shallow)"
            depth={shallowResult?.depth ?? 1}
            result={shallowResult}
          />
          <DepthSide
            label="Full depth (Traversed)"
            depth={queriedFullDepth}
            result={fullResult}
          />
        </div>

        {/* Labelled Flip Banner: Readable with the sound off */}
        {hasFlip && shallowResult && fullResult && (
          <div className="depth-flip-banner" aria-live="polite">
            <div className="flip-banner-badge">
              <ArrowRightLeft size={16} aria-hidden="true" />
              <span>DECISION FLIP DETECTED AT DEPTH</span>
            </div>
            <div className="flip-statement">
              <span className="flip-tag flip-from">
                Depth 1: {shallowResult.verdict}
              </span>
              <span className="flip-arrow" aria-hidden="true">→</span>
              <span className="flip-tag flip-to">
                Full depth: {fullResult.verdict}
              </span>
              {deadPremise?.id && (
                <span className="flip-cause">
                  because {deadPremise.id} was reversed
                </span>
              )}
            </div>
            <p className="flip-explanation-copy">{getFlipExplanation()}</p>
          </div>
        )}

        <div className="depth-provenance-legend">
          <span className="legend-caption">Evidence provenance:</span>
          <div className="legend-items">
            <span className="provenance-pill is-real">REAL</span>
            <span className="provenance-pill is-curated">CURATED</span>
            <span className="provenance-pill is-synthetic">SYNTHETIC</span>
          </div>
        </div>

        <p className="depth-advisory-footnote">
          Gatekeeper never calls an unverified rule safe. It reports what the recorded graph can prove, and reveals where the reasons stop.
        </p>
      </div>
    </section>
  );
}
