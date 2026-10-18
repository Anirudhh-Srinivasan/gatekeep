import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Terminal } from 'lucide-react';
import { ACTIONS, type Action } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';
import { api } from '../api/client';

const prettyAction = (action: Action): string => action.replace('_', ' ');

export function CheckpointConsole(): JSX.Element {
  const { target, action, graph, isChecking, checkError, setTarget, setAction, runContrast } = useGatekeeperStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [apiTargets, setApiTargets] = useState<Array<{ id: string; label?: string }>>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let active = true;
    if (!api.targets) return;
    void api.targets().then((values) => { if (active) setApiTargets((values as Array<{ id: string; label?: string; name?: string }>).map((item) => ({ id: item.id, label: item.label ?? item.name ?? item.id }))); }).catch(() => { /* keep graph based suggestions on deployments without /targets */ });
    return () => { active = false; };
  }, []);

  const suggestions = useMemo(() => {
    const artifacts = apiTargets.length ? apiTargets.map((item) => ({ id: item.id, label: item.label ?? item.id })) : graph?.nodes.filter((node) => node.type === 'Artifact').map((node) => ({ id: node.id, label: node.label })) ?? [];
    const query = target.toLowerCase();
    return artifacts.filter((node) => node.id.toLowerCase().includes(query) || node.label.toLowerCase().includes(query)).slice(0, 5);
  }, [apiTargets, graph, target]);

  return (
    <section className="console-section" aria-labelledby="checkpoint-title">
      <div className="console-header">
        <div>
          <h2 id="checkpoint-title"><Terminal size={14} aria-hidden="true" /> Checkpoint console</h2>
          <p>Resolve the name first. Then follow the reasons before you act.</p>
        </div>
        <span className="keyboard-hint">⌘ / CTRL + K</span>
      </div>
      <div className="command-bar glass-command-bar">
        <div className="field-wrap target-field">
          <label className="field-label" htmlFor="target-input">Target artifact</label>
          <div style={{ position: 'relative' }}>
            <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 14, color: 'var(--quiet)' }} />
            <input
              ref={inputRef}
              id="target-input"
              className="field-input target-pill"
              style={{ paddingLeft: 36 }}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 140)}
              placeholder="file:compat/win7_shim.js"
              aria-autocomplete="list"
              aria-label="Target artifact name"
            />
            {focused && suggestions.length > 0 && (
              <div className="target-suggestions" role="group" aria-label="Matching graph targets">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="suggestion-button"
                    onMouseDown={() => setTarget(suggestion.id)}
                    onClick={() => setTarget(suggestion.id)}
                  >
                    <span>{suggestion.id}</span><span className="suggestion-kind">{suggestion.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="field-wrap action-field">
          <span className="field-label">Action under review</span>
          <div className="segmented" role="group" aria-label="Action vocabulary">
            {ACTIONS.map((item) => (
              <button key={item} type="button" className={`segment ${item === action ? 'is-selected' : ''}`} onClick={() => setAction(item)} aria-pressed={item === action}>
                {prettyAction(item)}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="primary-button run-button check-button" onClick={() => void runContrast().catch(() => undefined)} disabled={isChecking}>
          {isChecking ? 'Checking…' : 'Check'}
        </button>
        {checkError && <div className="error-state command-error">{checkError}<button className="retry-button" type="button" onClick={() => void runContrast().catch(() => undefined)} disabled={isChecking}>Retry</button></div>}
        {graph && target.length > 0 && !graph.nodes.some((node) => node.id === target) && (
          <div className="unknown-inline"><strong>unresolved target</strong> — run it to get an explicit UNKNOWN_TARGET result; no guesswork.</div>
        )}
      </div>
    </section>
  );
}
