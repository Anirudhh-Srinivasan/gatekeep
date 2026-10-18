import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Compass, Search, Terminal } from 'lucide-react';
import { ACTIONS, type Action } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';
import { api } from '../api/client';

const prettyAction = (action: Action): string => action.replace('_', ' ');

const DEPTH_OPTIONS = [
  { value: 1, label: '1 · Shallow' },
  { value: 3, label: '3 hops' },
  { value: 6, label: '6 · Full path' },
];

export function CheckpointConsole(): JSX.Element {
  const { target, action, depth, graph, isChecking, checkError, setTarget, setAction, setDepth, runContrast } = useGatekeeperStore();
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
    void api.targets()
      .then((values) => {
        if (active) {
          setApiTargets(
            (values as Array<{ id: string; label?: string; name?: string }>).map((item) => ({
              id: item.id,
              label: item.label ?? item.name ?? item.id,
            }))
          );
        }
      })
      .catch(() => {
        /* keep graph based suggestions on deployments without /targets */
      });
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    const artifacts = apiTargets.length
      ? apiTargets.map((item) => ({ id: item.id, label: item.label ?? item.id }))
      : graph?.nodes.filter((node) => node.type === 'Artifact').map((node) => ({ id: node.id, label: node.label })) ?? [];
    const query = target.toLowerCase();
    return artifacts
      .filter((node) => node.id.toLowerCase().includes(query) || node.label.toLowerCase().includes(query))
      .slice(0, 5);
  }, [apiTargets, graph, target]);

  return (
    <section className="console-section console-card" aria-labelledby="checkpoint-title">
      <div className="console-header">
        <div className="console-title-group">
          <div className="console-kicker">01 / CHECKPOINT CONSOLE</div>
          <h2 id="checkpoint-title">
            <Terminal size={16} aria-hidden="true" />
            <span>Pre-action Check</span>
          </h2>
          <p className="console-deck">Resolve target and trace reasons before executing an action.</p>
        </div>
        <span className="keyboard-hint" aria-label="Keyboard shortcut command K">⌘K</span>
      </div>

      <div className="console-body">
        {/* Target artifact pill field with leading circular icon chip */}
        <div className="field-block target-field-block">
          <label className="field-label" htmlFor="target-input">
            Target artifact
          </label>
          <div className="pill-input-container">
            <span className="leading-icon-chip" aria-hidden="true">
              <Search size={15} />
            </span>
            <input
              ref={inputRef}
              id="target-input"
              className="pill-input"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 160)}
              placeholder="e.g. file:compat/win7_shim.js"
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
                    <span className="suggestion-id">{suggestion.id}</span>
                    <span className="suggestion-kind">{suggestion.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action pill selector */}
        <div className="field-block action-field-block">
          <span className="field-label" id="action-label">Action under review</span>
          <div className="action-pill-group" role="group" aria-labelledby="action-label">
            {ACTIONS.map((item) => {
              const isSelected = item === action;
              return (
                <button
                  key={item}
                  type="button"
                  className={`action-pill ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setAction(item)}
                  aria-pressed={isSelected}
                >
                  {prettyAction(item)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Depth control pill selector */}
        <div className="field-block depth-field-block">
          <div className="depth-label-row">
            <span className="field-label" id="depth-label">Trace depth</span>
            <span className="depth-indicator">{depth === 1 ? 'Shallow (Hop 1)' : `Full (${depth} hops)`}</span>
          </div>
          <div className="depth-pill-group" role="group" aria-labelledby="depth-label">
            {DEPTH_OPTIONS.map((opt) => {
              const isSelected = opt.value === depth;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`depth-pill ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setDepth(opt.value)}
                  aria-pressed={isSelected}
                  aria-label={`Set trace depth to ${opt.label}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button (black/ink pill with joined circular arrow chip) */}
        <div className="console-action-row">
          <button
            type="button"
            className="primary-join-button"
            onClick={() => void runContrast(depth).catch(() => undefined)}
            disabled={isChecking}
            aria-label="Run checkpoint verification"
          >
            <span className="join-label">{isChecking ? 'Checking…' : 'Check reason'}</span>
            <span className="join-arrow-chip" aria-hidden="true">
              <ArrowRight size={15} />
            </span>
          </button>
        </div>

        {checkError && (
          <div className="error-state command-error" role="alert">
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

        {graph && target.length > 0 && !graph.nodes.some((node) => node.id === target) && (
          <div className="unresolved-target-note" role="note">
            <Compass size={14} aria-hidden="true" />
            <span>
              <strong>Unresolved target</strong> — running check will yield an explicit <code>UNKNOWN_TARGET</code> verdict.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
