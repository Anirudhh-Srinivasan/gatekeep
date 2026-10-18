import { Ban, CheckCircle2, CircleHelp, Clock3, TriangleAlert, UserRound } from 'lucide-react';
import type { Verdict } from '../api/types';

const verdictIcons = {
  BLOCK: Ban,
  ESCALATE: UserRound,
  STALE: Clock3,
  ALLOW: CheckCircle2,
  UNGOVERNED: CircleHelp,
  UNKNOWN_TARGET: TriangleAlert,
} satisfies Record<Verdict, typeof Ban>;

const verdictLabels: Record<Verdict, string> = {
  BLOCK: 'Blocked',
  ESCALATE: 'Approval needed',
  STALE: 'Reason is stale',
  ALLOW: 'History shown, see evidence',
  UNGOVERNED: 'Nothing recorded covers this. Not safe.',
  UNKNOWN_TARGET: 'Target not found',
};

export function VerdictMark({ verdict }: { verdict: Verdict }): JSX.Element {
  const Icon = verdictIcons[verdict];
  return (
    <span className={`verdict-mark verdict-mark-${verdict.toLowerCase()}`}>
      <Icon size={19} aria-hidden="true" />
      <span>{verdictLabels[verdict]}</span>
    </span>
  );
}
