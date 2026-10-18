export const ACTIONS = ['delete', 'modify', 'add_dependency', 'remove_dependency', 'deploy'] as const;
export type Action = (typeof ACTIONS)[number];

export const VERDICTS = [
  'BLOCK',
  'ESCALATE',
  'STALE',
  'ALLOW',
  'UNGOVERNED',
  'UNKNOWN_TARGET',
] as const;
export type Verdict = (typeof VERDICTS)[number];

export type DecisionStatus = 'live' | 'superseded' | 'withdrawn';
export type SourceType = 'doc' | 'ticket' | 'thread';
export type GraphNodeType = 'Person' | 'Team' | 'Artifact' | 'Decision' | 'Doc' | 'Ticket' | 'Thread' | 'Answer';

export interface Owner {
  team: string;
  people: string[];
}

export interface Premise {
  id: string;
  title: string;
  status: DecisionStatus;
  hops: number;
  via: string[];
}

export interface DecisionRef {
  decision: string;
  title: string;
  status: DecisionStatus;
  constraint: 'prohibits' | 'requires_approval' | 'informational';
  severity: 'high' | 'normal';
  scope: string;
}

export interface StaleDecision extends DecisionRef {
  dead_premises: Premise[];
}

export interface PathNode {
  id: string;
  label: string;
  type: GraphNodeType;
  status?: DecisionStatus;
  meta?: string;
}

export interface PathEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  provenance?: 'REAL' | 'CURATED' | 'SYNTHETIC';
}

export interface EvidencePath {
  nodes: PathNode[];
  edges: PathEdge[];
}

export interface CheckRequest {
  target: string;
  action: Action;
  depth: number;
  viewer?: string;
}

export interface CheckResponse {
  verdict: Verdict;
  target: string;
  action: Action;
  depth: number;
  owner: Owner | null;
  live: DecisionRef[];
  stale: StaleDecision[];
  dead: DecisionRef[];
  info: DecisionRef[];
  path: EvidencePath;
  note?: string;
  answer_id: string;
}

export interface Source {
  type: SourceType;
  id: string;
  url: string;
  title?: string;
  tag: 'REAL' | 'CURATED' | 'SYNTHETIC';
}

export interface WhyResponse {
  id: string;
  title: string;
  status: DecisionStatus;
  decided_at: string;
  sources: Source[];
  decided_by: string[];
  supersedes: string[];
  premises: Array<{ id: string; title: string; status: DecisionStatus }>;
  path: EvidencePath;
}

export interface ReverseRequest {
  old: string;
  new_id: string;
  new_title: string;
  dry_run: boolean;
}

export interface Flip {
  target: string;
  action: Action;
  decision: string;
  from_verdict: Verdict;
  to_verdict: Verdict;
  path: EvidencePath;
}

export interface AffectedPerson {
  person: string;
  answer: string;
  answer_id: string;
  at: string;
  summary: string;
  stale_decision: string;
}

export interface ReverseResponse {
  flips: Flip[];
  affected_people: AffectedPerson[];
  committed: boolean;
  path: EvidencePath;
}

export interface LedgerRow {
  person: string;
  answer_id: string;
  at: string;
  summary: string;
  stale_decision: string;
}

export interface AffectedResponse {
  decision: string;
  rows: LedgerRow[];
  path: EvidencePath;
}

export interface WhoResponse {
  target: string;
  owners: Owner[];
  path: EvidencePath;
}

export interface LoadBearingItem {
  id: string;
  title: string;
  score: number;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  status?: DecisionStatus;
  meta?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  provenance?: 'REAL' | 'CURATED' | 'SYNTHETIC';
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ResetResponse {
  reset: boolean;
  path: EvidencePath;
  fixture_counts: Record<string, number>;
  real_counts?: Record<string, unknown> | null;
  error?: string | null;
  info?: string | null;
}

export interface AgentToolCall {
  tool: string;
  args: Record<string, string | number | boolean>;
  status: 'validated' | 'complete';
}

export interface AskResponse {
  question: string;
  tool_calls: AgentToolCall[];
  result: CheckResponse;
  explanation: string;
  names_verified: boolean;
  post_check?: { passed: boolean };
  source?: 'router' | 'llm';
}

export interface TargetItem { id: string; label?: string; kind?: string; }
export interface DecisionItem { id: string; title?: string; status?: DecisionStatus; }
export interface AuditResponse { [key: string]: unknown; }

export interface GatekeeperApi {
  check(request: CheckRequest): Promise<CheckResponse>;
  why(decision: string): Promise<WhyResponse>;
  reverse(request: ReverseRequest): Promise<ReverseResponse>;
  affected(decision: string): Promise<AffectedResponse>;
  who(target: string): Promise<WhoResponse>;
  loadBearing(limit?: number): Promise<LoadBearingItem[]>;
  graph(): Promise<GraphResponse>;
  reset(): Promise<ResetResponse>;
  ask(question: string): Promise<AskResponse>;
  targets?(): Promise<TargetItem[]>;
  decisions?(): Promise<DecisionItem[]>;
  audit?(): Promise<AuditResponse>;
}

export const isAction = (value: string): value is Action =>
  (ACTIONS as readonly string[]).includes(value);
