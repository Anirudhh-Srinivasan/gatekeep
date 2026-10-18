import { Check, CircleAlert, MessageCircle, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { AskResponse, CheckResponse } from '../api/types';
import { verdictClass } from './verdictText';

interface AgentModeProps { onDecisionClick: (decision: string) => void; }

const cannedPrompts = ['Can I delete win7_shim.js?', 'Can we add moment.js?', 'Can I delete readme.md?', 'What about file:unknown/ghost.ts?'];

export function AgentMode({ onDecisionClick }: AgentModeProps): JSX.Element {
  const [question, setQuestion] = useState(cannedPrompts[0]);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [visibleTools, setVisibleTools] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAsked, setHasAsked] = useState(false);
  useEffect(() => {
    if (!response || visibleTools >= response.tool_calls.length) return;
    const timer = window.setTimeout(() => setVisibleTools((value) => value + 1), 450);
    return () => window.clearTimeout(timer);
  }, [response, visibleTools]);
  const result: CheckResponse | null = useMemo(() => response?.result ?? null, [response]);
  const ask = async (): Promise<void> => {
    setLoading(true); setError(null); setResponse(null); setVisibleTools(0); setHasAsked(true);
    try { const next = await api.ask(question); setResponse(next); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Agent request failed'); }
    setLoading(false);
  };
  return (
    <section className="panel agent-panel" aria-labelledby="agent-title">
      <div className="panel-header"><div><h2 id="agent-title" className="panel-title"><Sparkles size={15} style={{ verticalAlign: 'text-bottom', marginRight: 7 }} /> Agent mode</h2><p className="panel-description">The agent picks a validated tool. Deterministic graph code decides the verdict; the model does not write Cypher or overrule it.</p></div><span className="eyebrow-tag" style={{ padding: '6px 8px', color: 'var(--allow)', borderColor: 'rgba(139,213,165,.3)' }}>tool-first</span></div>
      <div className="panel-body"><div className="agent-prompts">{cannedPrompts.map((prompt) => <button key={prompt} type="button" className="prompt-button" onClick={() => setQuestion(prompt)} disabled={loading}>{prompt}</button>)}</div><div className="agent-input-row"><MessageCircle className="field-icon-chip" size={15} aria-hidden="true" /><input className="field-input" value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Ask the Gatekeeper agent" disabled={loading} /><button type="button" className="primary-button" onClick={() => void ask()} disabled={loading || !question.trim()}>{loading ? 'Thinking…' : <><Send size={13} style={{ verticalAlign: 'middle' }} /> Ask</>}</button></div>{loading && <div className="skeleton-stack" style={{ marginTop: 15 }} aria-label="Thinking"><i /><i /></div>}{error && <div className="error-state" style={{ marginTop: 15 }}>{error}<button className="retry-button" type="button" onClick={() => void ask()} disabled={loading}>Retry</button></div>}{hasAsked && !loading && !error && !response && <div className="empty-state" style={{ marginTop: 15 }}>No agent response was returned.</div>}{response && <div className="tool-stream" aria-live="polite">{response.tool_calls.slice(0, visibleTools).map((call) => <div className="tool-call" key={call.tool}><code>{call.tool}</code><span>{JSON.stringify(call.args)}</span><Check className="check-icon" size={13} /></div>)}{visibleTools >= response.tool_calls.length && <><div className="agent-explanation"><strong className={result ? verdictClass(result.verdict) : ''}>{result?.verdict}</strong> — {response.explanation}</div>{response.names_verified ? <div className="verified-line"><Check size={14} /> names verified against graph</div> : <div className="verified-line" style={{ color: 'var(--unknown)' }}><CircleAlert size={14} /> target not in the graph · no guessing</div>}{result && <button type="button" className="ghost-button" style={{ marginTop: 13 }} onClick={() => result.path.nodes.filter((node) => node.type === 'Decision').slice(0, 1).forEach((node) => onDecisionClick(node.id))}>Open evidence decision</button>}</>}</div>}</div>
    </section>
  );
}
