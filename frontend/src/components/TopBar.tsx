import { RotateCcw } from 'lucide-react';
import { apiMode } from '../api/client';

export function TopBar({ onReset, dataBadge = 'DATA PENDING' }: { onReset: () => void; dataBadge?: string }): JSX.Element {
  return <header className="topbar"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true" /><div className="brand-copy"><span className="brand-name">Gatekeeper</span><span className="brand-sub">decision checkpoint / company brain</span></div></div><div className="topbar-notes"><span className="advisory-note"><strong>Advisory only.</strong> Knows only what is recorded.</span><span className="data-badge"><span className="status-dot" /> {dataBadge}</span><span className="status-badge"><span className="status-dot" /> {apiMode} api</span></div><div className="topbar-actions"><button type="button" className="reset-button" onClick={onReset}><RotateCcw size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> reset</button></div></header>;
}
