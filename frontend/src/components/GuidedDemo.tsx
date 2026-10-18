import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGatekeeperStore } from '../store/useGatekeeperStore';

interface GuidedDemoProps { onDecisionClick: (decision: string) => void; }

const steps = [
  { label: 'the problem', caption: 'Old decisions do not disappear when the company changes its mind. Gatekeeper treats a decision as live only when its reasons are live too.', target: 'hero' },
  { label: 'the graph', caption: 'Artifacts, owners, decisions and sources are connected. The path is the answer — not decoration behind it.', target: 'graph' },
  { label: 'why', caption: 'Every rule can be opened back to its recorded source and decider. We label this fixture synthetic instead of pretending it is real.', target: 'verdict' },
  { label: 'escalate', caption: 'An action against the shim resolves to D2. It is live, but deletion needs platform / bob to approve it.', target: 'verdict' },
  { label: 'depth contrast', caption: 'At shallow depth the chain looks live. The full trace is deliberately ready to expose the premise that changed.', target: 'depth' },
  { label: 'flip preview', caption: 'Reverse D1 in a dry run. Before a write, Gatekeeper shows the verdict flip and the people who received the old answer.', target: 'reverse' },
  { label: 'commit → stale', caption: 'Commit the replacement. The old rule is now superseded; the same deep check becomes STALE, never falsely green.', target: 'verdict' },
  { label: 'unknown territory', caption: 'Try an unrecorded readme deletion. UNGOVERNED means nothing is known — it never means safe.', target: 'verdict' },
];

export function GuidedDemo({ onDecisionClick }: GuidedDemoProps): JSX.Element {
  const { setTarget, setAction, setDepth, runContrast, reverse, reset } = useGatekeeperStore();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const current = steps[step];
  const go = (next: number): void => {
    const bounded = Math.max(0, Math.min(steps.length - 1, next));
    setStep(bounded);
    window.setTimeout(() => document.getElementById(steps[bounded].target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setStep((value) => {
      if (value >= steps.length - 1) { setActive(false); return value; }
      return value + 1;
    }), 6500);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => {
    window.setTimeout(() => document.getElementById(current.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }, [current.target]);
  useEffect(() => {
    if (!active && step === 0) return;
    const applyStep = async (): Promise<void> => {
      if (step === 2) onDecisionClick('D2');
      if (step === 3) { onDecisionClick('D2'); setTarget('file:compat/win7_shim.js'); setAction('delete'); setDepth(6); await runContrast(6); }
      if (step === 5) await reverse('D1', 'D4', 'Drop Windows 7 support', true);
      if (step === 6) await reverse('D1', 'D4', 'Drop Windows 7 support', false);
      if (step === 7) { setTarget('file:docs/readme.md'); setAction('delete'); setDepth(6); await runContrast(6); }
    };
    void applyStep();
  }, [onDecisionClick, reverse, runContrast, setAction, setDepth, setTarget, step]);
  const togglePlaying = (): void => {
    if (!active && step === 0) void reset();
    setActive((value) => !value);
  };
  return (
    <section className="demo-banner" id="demo"><div><div className="kicker">guided demo mode</div><h2>{current.label}</h2><p>{current.caption}</p></div><div className="demo-controls"><span className="demo-progress">0{step + 1} / 0{steps.length}</span><button type="button" className="ghost-button" onClick={() => go(step - 1)} aria-label="Previous demo step" title="Previous demo step"><SkipBack size={13} /></button><button type="button" className="primary-button" onClick={togglePlaying}>{active ? <><Pause size={13} style={{ verticalAlign: 'middle' }} /> Pause</> : <><Play size={13} style={{ verticalAlign: 'middle' }} /> Play demo</>}</button><button type="button" className="ghost-button" onClick={() => go(step + 1)} aria-label="Next demo step" title="Next demo step"><SkipForward size={13} /></button><button type="button" className="ghost-button" onClick={() => { setStep(0); setActive(false); }} aria-label="Restart demo" title="Restart demo"><RotateCcw size={13} /></button></div></section>
  );
}
