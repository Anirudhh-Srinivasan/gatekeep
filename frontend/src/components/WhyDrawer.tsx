import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { WhyResponse } from '../api/types';

interface WhyDrawerProps { decision: string | null; onClose: () => void; }

export function WhyDrawer({ decision, onClose }: WhyDrawerProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<WhyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!decision) return;
    setData(null);
    setError(null);
    void api.why(decision).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load provenance'));
  }, [decision]);
  useEffect(() => {
    if (!decision) return;
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [decision, onClose]);
  return (
    <AnimatePresence>
      {decision && (
        <>
          <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside className="why-drawer" initial={{ x: reduceMotion ? 0 : 480, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: reduceMotion ? 0 : 480, opacity: 0 }} transition={reduceMotion ? { duration: .01 } : { type: 'spring', damping: 28, stiffness: 260 }} aria-label="Decision provenance" aria-modal="true">
            <button type="button" className="drawer-close" onClick={onClose} aria-label="Close why drawer" title="Close why drawer"><X size={19} /></button>
            <div className="drawer-kicker">why this decision exists</div>
            {error && <div className="error-state" style={{ marginTop: 22 }}>{error}</div>}
            {!data && !error && <div className="empty-state" style={{ marginTop: 22 }}>Following the recorded links…</div>}
            {data && (
              <>
                <h2 className="drawer-title">{data.title}</h2>
                <div className="drawer-meta"><strong>{data.id}</strong> · decided {data.decided_at} · {data.status}</div>
                <div className="timeline" aria-label="Provenance timeline">
                  {data.sources.map((item) => (
                    <div className="timeline-item" key={item.id}>
                      <span className="timeline-dot" />
                      <div><div className="timeline-type">{item.type}</div><div className="timeline-title"><a href={item.url} target="_blank" rel="noreferrer">{item.title ?? item.id} <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a></div><span className={`source-badge ${item.tag === 'REAL' ? 'is-real' : item.tag === 'CURATED' ? 'is-curated' : ''}`}>{item.tag}</span></div>
                    </div>
                  ))}
                  <div className="timeline-item"><span className="timeline-dot" /><div><div className="timeline-type">decision</div><div className="timeline-title">{data.id} · {data.title}</div><span className="source-badge">SYNTHETIC RECORD</span></div></div>
                  {data.decided_by.map((person) => <div className="timeline-item" key={person}><span className="timeline-dot" /><div><div className="timeline-type">person</div><div className="timeline-title">decided by @{person}</div></div></div>)}
                </div>
                <div className="drawer-section"><h3>premises this rule relies on</h3>{data.premises.length === 0 ? <div className="owner-empty">No recorded premises.</div> : data.premises.map((premise) => <div className="premise-chip" key={premise.id}><strong>{premise.id}</strong><span>{premise.status}</span></div>)}</div>
                <div className="drawer-section"><h3>supersession record</h3>{data.supersedes.length === 0 ? <div className="owner-empty">This decision does not supersede another recorded decision.</div> : data.supersedes.map((old) => <div className="premise-chip" key={old}><strong>{old}</strong><span>replaced</span></div>)}</div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
