import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGatekeeperStore } from '../store/useGatekeeperStore';

interface GuidedDemoProps { onDecisionClick: (decision: string) => void; recording?: boolean; }

const steps = [
  { label: 'The problem · 20 seconds', caption: 'Old decisions keep influencing actions after their reasons change. Gatekeeper follows the chain behind a decision, so when a premise expires, the answer can change before someone acts.', target: 'hero' },
  { label: 'Graph + provenance', caption: 'The graph connects artifacts, decisions, people, and sources. Every evidence edge is marked REAL, CURATED, or SYNTHETIC so the source of each connection stays visible.', target: 'graph' },
  { label: 'Why this path', caption: 'Open D2 to follow its recorded path back through D5 and D6 to D1. The answer comes with evidence you can inspect.', target: 'verdict' },
  { label: 'Agent · delete → ESCALATE', caption: 'The agent asks whether it can delete the Windows 7 shim. It resolves to a recorded live rule and returns ESCALATE: ask platform for approval.', target: 'agent' },
  { label: 'Depth contrast', caption: 'At depth 1, the rule asks for approval. At full depth, Gatekeeper follows the reason farther and can detect when that reason has changed.', target: 'depth' },
  { label: 'Dry run → commit', caption: 'First preview the reversal. Review the verdict flips and the people linked to the old answer. Commit only after that impact is visible.', target: 'reverse' },
  { label: 'Re-check → STALE', caption: 'After D1 is reversed, rerun the same deletion check. The deep answer is STALE because its recorded premise is no longer live.', target: 'verdict' },
  { label: 'Ungoverned ≠ safe', caption: 'A readme deletion has no applicable recorded rule, so the result is UNGOVERNED. No recorded restriction is not evidence that an action is safe.', target: 'verdict' },
  { label: 'Limits', caption: 'Gatekeeper is advisory. It knows only what is recorded, and its answers are bounded by the graph and evidence available to it.', target: 'agent' },
];

export function GuidedDemo({ onDecisionClick, recording = false }: GuidedDemoProps): JSX.Element {
  const { setTarget, setAction, setDepth, runContrast, reverse, reset } = useGatekeeperStore();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const lastApplied = useRef(-1);
  const current = steps[step];

  const go = (next: number): void => setStep(Math.max(0, Math.min(steps.length - 1, next)));
  const restart = (): void => { setActive(false); lastApplied.current = -1; setStep(0); void reset().catch(() => undefined); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (event.code === 'Space') { event.preventDefault(); setActive((value) => !value); }
      else if (event.key.toLowerCase() === 'r') restart();
      else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'n') go(step + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  useEffect(() => {
    const target = document.getElementById(current.target);
    if (!target) return;
    if (recording) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }, [current.target, recording]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setStep((value) => {
        if (value >= steps.length - 1) { setActive(false); return value; }
        return value + 1;
      });
    }, step === 0 ? 20_000 : 8_000);
    return () => window.clearTimeout(timer);
  }, [active, step]);

  useEffect(() => {
    if (lastApplied.current === step) return;
    lastApplied.current = step;
    const applyStep = async (): Promise<void> => {
      if (step === 2) onDecisionClick('D2');
      if (step === 3) {
        setTarget('file:compat/win7_shim.js'); setAction('delete'); setDepth(6);
        await runContrast(6).catch(() => undefined);
        document.getElementById('agent')?.scrollIntoView({ behavior: recording ? 'smooth' : 'auto', block: 'start' });
      }
      if (step === 4) { setTarget('file:compat/win7_shim.js'); setAction('delete'); setDepth(6); await runContrast(6).catch(() => undefined); }
      if (step === 5) await reverse('D1', 'D4', 'Drop Windows 7 support', true).catch(() => undefined);
      if (step === 6) {
        await reverse('D1', 'D4', 'Drop Windows 7 support', false).catch(() => undefined);
        setTarget('file:compat/win7_shim.js'); setAction('delete'); setDepth(6);
        await runContrast(6).catch(() => undefined);
      }
      if (step === 7) { setTarget('file:docs/readme.md'); setAction('delete'); setDepth(6); await runContrast(6).catch(() => undefined); }
    };
    void applyStep();
  }, [onDecisionClick, recording, reverse, runContrast, setAction, setDepth, setTarget, step]);

  return (
    <section className={`demo-banner ${recording ? 'recording-demo' : ''}`} id="demo" aria-label="Guided recording demo">
      <div className="demo-stage-content"><div className="kicker">{recording ? 'recording mode' : 'guided demo mode'}</div><h2>{current.label}</h2>
        {recording && <div className="recording-caption" aria-live="polite"><span className="caption-step">{String(step + 1).padStart(2, '0')} / {steps.length}</span><div><strong>{current.label}</strong><p>{current.caption}</p></div></div>}
        {!recording && <p>{current.caption}</p>}
      </div>
      <div className="demo-controls"><span className="demo-progress" aria-live="polite">{String(step + 1).padStart(2, '0')} / {steps.length}</span>
        <button type="button" className="ghost-button" onClick={() => setActive((value) => !value)} aria-label={active ? 'Pause demo' : 'Play demo'} title="Space to pause or play">{active ? <Pause size={15} /> : <Play size={15} />}</button>
        <button type="button" className="ghost-button" onClick={restart} aria-label="Restart demo" title="R to restart"><RotateCcw size={15} /></button>
        <button type="button" className="primary-button" onClick={() => go(step + 1)} disabled={step === steps.length - 1} title="Right arrow or N to step forward">Next <SkipForward size={14} style={{ verticalAlign: 'middle' }} /></button>
        <span className="demo-key-hint">Space pause · R restart · → next</span>
      </div>
    </section>
  );
}
