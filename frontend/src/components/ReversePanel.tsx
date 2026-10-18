import { useMemo, useState } from 'react';
import { ArrowRight, GitBranch, Hash, RotateCcw, Type, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { GraphNode } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';
import { verdictClass } from './verdictText';

interface ReversePanelProps {
  graphNodes: GraphNode[];
}

export function ReversePanel({ graphNodes }: ReversePanelProps): JSX.Element {
  const { lastReverse, reverse, reverseInFlight } = useGatekeeperStore();
  const decisions = useMemo(
    () => graphNodes.filter((node) => node.type === 'Decision'),
    [graphNodes]
  );

  const [old, setOld] = useState('D1');
  const [newId, setNewId] = useState('D4');
  const [newTitle, setNewTitle] = useState('Drop Windows 7 support');
  const [previewedParams, setPreviewedParams] = useState<{ old: string; newId: string; newTitle: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invalidate preview immediately if any input is altered after dry run
  const isPreviewValid = Boolean(
    previewedParams !== null &&
    previewedParams.old === old &&
    previewedParams.newId === newId &&
    previewedParams.newTitle === newTitle
  );

  const preview = isPreviewValid && lastReverse && !lastReverse.committed ? lastReverse : null;
  const committedRows = lastReverse?.committed ? lastReverse.affected_people.length : null;
  const committedNamedPeople = lastReverse?.committed
    ? new Set(lastReverse.affected_people.map((person) => person.person.trim()).filter((person) => person && person.toLowerCase() !== 'anonymous')).size
    : null;

  const handleOldChange = (value: string): void => {
    setOld(value);
    setPreviewedParams(null);
    setConfirming(false);
  };

  const handleNewIdChange = (value: string): void => {
    setNewId(value);
    setPreviewedParams(null);
    setConfirming(false);
  };

  const handleNewTitleChange = (value: string): void => {
    setNewTitle(value);
    setPreviewedParams(null);
    setConfirming(false);
  };

  const runDry = async (): Promise<void> => {
    setError(null);
    if (!old.trim() || !newId.trim() || !newTitle.trim()) {
      setError('Fill every field before previewing the reversal.');
      return;
    }
    try {
      await reverse(old.trim(), newId.trim(), newTitle.trim(), true);
      setPreviewedParams({ old: old.trim(), newId: newId.trim(), newTitle: newTitle.trim() });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Preview failed');
    }
  };

  const commit = async (): Promise<void> => {
    if (!previewedParams) {
      setError('A dry run is required before committing.');
      return;
    }
    try {
      await reverse(previewedParams.old, previewedParams.newId, previewedParams.newTitle, false);
      setPreviewedParams(null);
      setConfirming(false);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Commit failed');
    }
  };

  return (
    <section className="panel reverse-panel dark-rounded-card" aria-labelledby="reverse-title">
      <div className="card-header-row">
        <div className="card-heading-group">
          <div className="card-kicker">02 / CHANGE THE RECORD</div>
          <h2 id="reverse-title" className="card-main-title">
            <RotateCcw size={20} aria-hidden="true" />
            <span>Reverse a Decision</span>
          </h2>
          <p className="card-deck">
            Preview the ripple before you commit changes. A commit introduces a new live decision and invalidates the previous premise.
          </p>
        </div>
        <div className="card-header-action">
            <a href="#ledger" className="dark-card-link" aria-label="Jump to affected answers ledger">
            <span>View Ledger</span>
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="reverse-grid-layout">
        {/* Left Form: Pill inputs with leading circular chips */}
        <div className="reverse-form-col">
          <div className="reverse-field-group">
            <label className="field-label" htmlFor="decision-select">
              Decision being replaced
            </label>
            <div className="pill-input-container">
              <span className="leading-icon-chip" aria-hidden="true">
                <GitBranch size={15} />
              </span>
              <select
                id="decision-select"
                className="pill-input pill-select"
                value={old}
                onChange={(event) => handleOldChange(event.target.value)}
                aria-label="Select decision being replaced"
              >
                {decisions.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.id} — {node.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="reverse-field-group">
            <label className="field-label" htmlFor="new-id-input">
              New decision ID
            </label>
            <div className="pill-input-container">
              <span className="leading-icon-chip" aria-hidden="true">
                <Hash size={15} />
              </span>
              <input
                id="new-id-input"
                className="pill-input"
                value={newId}
                onChange={(event) => handleNewIdChange(event.target.value)}
                aria-label="New decision identifier"
                placeholder="e.g. D4"
              />
            </div>
          </div>

          <div className="reverse-field-group">
            <label className="field-label" htmlFor="new-title-input">
              New decision title
            </label>
            <div className="pill-input-container">
              <span className="leading-icon-chip" aria-hidden="true">
                <Type size={15} />
              </span>
              <input
                id="new-title-input"
                className="pill-input"
                value={newTitle}
                onChange={(event) => handleNewTitleChange(event.target.value)}
                aria-label="New decision title"
                placeholder="e.g. Drop Windows 7 support"
              />
            </div>
          </div>

          {error && (
            <div className="reverse-error-note" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="reverse-action-wrap">
            <button
              type="button"
              className="primary-join-button"
              onClick={() => void runDry()}
              disabled={reverseInFlight}
              aria-label="Run dry-run flip preview"
            >
              <span className="join-label">
                {reverseInFlight ? 'Computing ripple…' : 'Dry-run flip preview'}
              </span>
              <span className="join-arrow-chip" aria-hidden="true">
                <ArrowRight size={15} />
              </span>
            </button>
          </div>
        </div>

        {/* Right Preview Area: Flips & Affected People before commit */}
        <div className="reverse-preview-col">
           {!preview && committedRows === null && (
            <div className="reverse-empty-state">
              <Users size={24} aria-hidden="true" />
              <p>
                No pending reversal. Choose a decision and run a dry run — the graph stays completely untouched until committed.
              </p>
            </div>
          )}

           {/* After commit notice: distinguish answer rows from named people */}
           {committedRows !== null && committedNamedPeople !== null && (
            <div className="commit-complete-banner" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>Reversal Committed Successfully</strong>
                <p>
                   {committedRows} recorded answer {committedRows === 1 ? 'row is' : 'rows are'} linked to the old decision; {committedNamedPeople} distinct named {committedNamedPeople === 1 ? 'viewer is' : 'viewers are'} represented.
                </p>
              </div>
            </div>
          )}

          {/* Dry Run Preview: Flips and Affected People */}
          {preview && (
            <div className="dry-run-card" aria-label="Dry run results">
              <div className="dry-run-header">
                <h3>Dry Run · No changes written yet</h3>
                <span className="dry-run-tag">Simulated ({previewedParams?.old} → {previewedParams?.newId})</span>
              </div>

              {preview.flips.length === 0 ? (
                <div className="no-flips-message">No graph-derived verdicts change for this reversal.</div>
              ) : (
                <div className="flips-list" aria-label="Verdict flips produced by reversal">
                  {preview.flips.map((flip) => (
                    <div className="flip-item-row" key={`${flip.target}-${flip.action}-${flip.decision}`}>
                      <div className="flip-item-meta">
                        <strong>{flip.target}</strong>
                        <span className="flip-action-tag">{flip.action}</span>
                      </div>
                      <div className="flip-item-transition">
                        <span className={`flip-verdict-chip ${verdictClass(flip.from_verdict)}`}>
                          {flip.from_verdict}
                        </span>
                        <span className="flip-arrow" aria-hidden="true">→</span>
                        <span className={`flip-verdict-chip ${verdictClass(flip.to_verdict)}`}>
                          {flip.to_verdict}
                        </span>
                      </div>
                      <span className="flip-decision-id">via {flip.decision}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Affected answer list */}
              <div className="affected-people-section">
                <h4>
                  <Users size={14} aria-hidden="true" />
                  <span>Recorded answers linked to the old decision ({preview.affected_people.length} rows · {new Set(preview.affected_people.map((person) => person.person.trim()).filter((person) => person && person.toLowerCase() !== 'anonymous')).size} named viewers)</span>
                </h4>
                {preview.affected_people.length === 0 ? (
                  <div className="no-affected-message">No recorded answers are linked to this decision.</div>
                ) : (
                  <div className="affected-people-chips">
                    {preview.affected_people.map((person) => (
                      <div className="affected-person-pill" key={person.answer_id}>
                        <span className="person-avatar">{person.person.slice(0, 2).toUpperCase()}</span>
                        <span className="person-name">{person.person}</span>
                        <span className="person-answer-id">{person.answer_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Commit Trigger Button (Only enabled when preview matches inputs) */}
              {!confirming ? (
                <button
                  type="button"
                  className="primary-join-button commit-trigger-button"
                  onClick={() => setConfirming(true)}
                  disabled={!isPreviewValid || reverseInFlight}
                  aria-label="Proceed to commit reversal"
                >
                  <span className="join-label">Continue to commit</span>
                  <span className="join-arrow-chip" aria-hidden="true">
                    <ArrowRight size={15} />
                  </span>
                </button>
              ) : (
                <div className="commit-confirmation-box" role="dialog" aria-labelledby="confirm-heading">
                  <h4 id="confirm-heading">Confirm Reversal</h4>
                  <p>
                    This will write <strong>{previewedParams?.newId}</strong> to the recorded graph, mark <strong>{previewedParams?.old}</strong> superseded, and update dependent verdicts. Continue?
                  </p>
                  <div className="confirm-btn-row">
                    <button
                      type="button"
                      className="primary-join-button"
                      onClick={() => void commit()}
                      disabled={reverseInFlight || !isPreviewValid}
                    >
                      <span className="join-label">
                        {reverseInFlight ? 'Committing…' : 'Commit reversal'}
                      </span>
                      <span className="join-arrow-chip" aria-hidden="true">
                        <ArrowRight size={15} />
                      </span>
                    </button>
                    <button
                      type="button"
                      className="glass-secondary-pill"
                      onClick={() => setConfirming(false)}
                      disabled={reverseInFlight}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
