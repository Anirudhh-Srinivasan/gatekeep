import type { CheckResponse, Verdict } from '../api/types';

export const verdictClass = (verdict: Verdict): string => {
  const classes: Record<Verdict, string> = {
    BLOCK: 'verdict-block',
    ESCALATE: 'verdict-escalate',
    STALE: 'verdict-stale',
    ALLOW: 'verdict-allow',
    UNGOVERNED: 'verdict-ungoverned',
    UNKNOWN_TARGET: 'verdict-unknown',
  };
  return classes[verdict];
};

export const verdictReason = (result: CheckResponse): string => {
  switch (result.verdict) {
    case 'BLOCK': return 'A high-severity prohibition covers this action.';
    case 'ESCALATE': return result.owner ? `Ask ${result.owner.people.join(' / ')} on ${result.owner.team} before acting.` : 'A live decision requires an owner to approve this action.';
    case 'STALE': return 'The rule is live, but one of its reasons is dead. Confirm with the owner.';
    case 'ALLOW': return 'No live constraint covers this action; the recorded rule is history, not safety.';
    case 'UNGOVERNED': return 'Nothing recorded covers this action. That does not mean safe.';
    case 'UNKNOWN_TARGET': return 'This target name does not resolve in the recorded graph.';
  }
};

export const verdictPatternClass = (verdict: Verdict): string => {
  if (verdict === 'STALE') return 'verdict-card-stale';
  if (verdict === 'UNGOVERNED') return 'verdict-card-ungoverned';
  return '';
};
