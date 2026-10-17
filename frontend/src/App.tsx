import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CheckpointConsole } from './components/CheckpointConsole';
import { AgentMode } from './components/AgentMode';
import { DepthContrast } from './components/DepthContrast';
import { GraphExplorer } from './components/GraphExplorer';
import { GuidedDemo } from './components/GuidedDemo';
import { LedgerPanel } from './components/LedgerPanel';
import { LoadBearingPanel } from './components/LoadBearingPanel';
import { ReversePanel } from './components/ReversePanel';
import { TopBar } from './components/TopBar';
import { VerdictCard } from './components/VerdictCard';
import { WhyDrawer } from './components/WhyDrawer';
import { useGatekeeperStore } from './store/useGatekeeperStore';

function OwnerPanel(): JSX.Element {
  const { result } = useGatekeeperStore();
  return <section className="panel owner-panel"><div className="panel-header"><div><h2 className="panel-title">Owner to ask</h2><p className="panel-description">Resolved through the artifact hierarchy.</p></div></div><div className="panel-body">{result?.owner ? <div className="owner-line"><span className="owner-avatar">{result.owner.people[0]?.slice(0, 2).toUpperCase()}</span><div><div className="owner-name">{result.owner.people.join(' / ')}</div><div className="owner-team">{result.owner.team} · owning team</div></div></div> : <div className="owner-empty">No owner is recorded for this target. That is a data gap, not permission.</div>}</div></section>;
}

function App(): JSX.Element {
  const { result, graph, loadBearing, ripple, isLoadingGraph, refreshGraph, runContrast, reset } = useGatekeeperStore();
  const [drawerDecision, setDrawerDecision] = useState<string | null>(null);
  const handleDrawerDecision = useCallback((decision: string): void => setDrawerDecision((current) => current === decision ? null : decision), []);
  useEffect(() => { void refreshGraph(); void runContrast(); }, [refreshGraph, runContrast]);
  return (
    <div className="app-shell">
      <TopBar onReset={() => void reset()} />
      <main className="page">
        <section className="hero-intro" id="hero"><div><div className="kicker">a pre-action checkpoint for people + agents</div><h1 className="hero-title">Check the<br /><em>reason</em> before<br />the move.</h1><p className="hero-deck">Gatekeeper walks a decision graph before an action happens. <strong>Live rules inherit their liveness from every premise below them.</strong> If a reason dies, the answer changes — and the path tells you where.</p></div><div className="hero-aside"><div className="aside-label">Synthetic fixture / current thesis</div><p className="aside-copy">A rule that says <span>ESCALATE</span> at hop 1 can become <span>STALE</span> at hop 4. This console makes that quiet failure visible before it becomes muscle memory.</p></div></section>
        <CheckpointConsole />
        <div className="section-grid" id="verdict"><div><VerdictCard result={result} ripple={ripple} onDecisionClick={handleDrawerDecision} /></div><div className="side-stack"><OwnerPanel /><LoadBearingPanel items={loadBearing} /><section className="panel"><div className="panel-header"><div><h2 className="panel-title">What Gatekeeper can claim</h2><p className="panel-description">A bounded read of what is recorded, not an enforcement layer.</p></div></div><div className="panel-body"><div className="verified-line" style={{ marginTop: 0, color: 'var(--accent)' }}><CheckCircle2 size={14} /> every answer carries its path</div><p className="ledger-footnote" style={{ marginTop: 12 }}>The backend will later connect this fixture to FastAPI + FalkorDB. For now, the mock API is stateful and uses the same contract.</p></div></section></div></div>
        <div className="section-rule" id="depth"><span className="section-label">01 / trace deeper</span></div>
        <DepthContrast />
        <GuidedDemo onDecisionClick={handleDrawerDecision} />
        <div className="section-rule" id="reverse"><span className="section-label">02 / change the record</span></div>
        <ReversePanel graphNodes={graph?.nodes ?? []} />
        <div style={{ marginTop: 18 }}><LedgerPanel refreshKey={ripple} /></div>
        <div className="section-rule" id="graph"><span className="section-label">03 / inspect the memory</span></div>
        <GraphExplorer />
        <div className="section-rule" id="agent"><span className="section-label">04 / ask as an agent</span></div>
        <AgentMode onDecisionClick={handleDrawerDecision} />
        <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 42, paddingTop: 17, borderTop: '1px solid var(--line)', color: 'var(--quiet)', fontFamily: 'var(--mono)', fontSize: 9, lineHeight: 1.5, textTransform: 'uppercase' }}><span>Gatekeeper / synthetic demo state</span><span>{isLoadingGraph ? 'syncing graph…' : 'graph ready'} · advisory only</span></footer>
      </main>
      <WhyDrawer decision={drawerDecision} onClose={() => setDrawerDecision(null)} />
    </div>
  );
}

export default App;
