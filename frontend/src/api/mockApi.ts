import {
  type Action,
  type AffectedResponse,
  type AffectedPerson,
  type AgentToolCall,
  type AskResponse,
  type CheckRequest,
  type CheckResponse,
  type DecisionRef,
  type DecisionStatus,
  type EvidencePath,
  type GatekeeperApi,
  type GraphEdge,
  type GraphNode,
  type GraphResponse,
  type LoadBearingItem,
  type Owner,
  type PathEdge,
  type PathNode,
  type ReverseRequest,
  type ReverseResponse,
  type ResetResponse,
  type Source,
  type StaleDecision,
  type Verdict,
  type WhoResponse,
  type WhyResponse,
} from './types';

interface DecisionRecord {
  id: string;
  title: string;
  status: DecisionStatus;
  decided_at: string;
  depends_on: string[];
  scope?: string;
  constraint?: DecisionRef['constraint'];
  actions?: string[];
  severity?: DecisionRef['severity'];
  decided_by: string[];
  sources: Source[];
  supersedes: string[];
}

interface ArtifactRecord {
  id: string;
  kind: string;
  name: string;
  part_of?: string;
}

interface LedgerRecord extends AffectedPerson {
  used: string[];
}

const wait = (ms = 30): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

const source = (type: Source['type'], id: string, title: string, tag: Source['tag'] = 'SYNTHETIC'): Source => ({
  type,
  id,
  title,
  url: `https://example.invalid/${type}/${id.toLowerCase()}`,
  tag,
});

const cleanAction = (action: Action): string => action.replace('_', ' ');
const pathEdge = (id: string, sourceId: string, targetId: string, type: string): PathEdge => ({ id, source: sourceId, target: targetId, type, provenance: 'SYNTHETIC' });

export class MockApi implements GatekeeperApi {
  private decisionRecords = new Map<string, DecisionRecord>();
  private artifacts = new Map<string, ArtifactRecord>();
  private ledger: LedgerRecord[] = [];
  private answerSequence = 100;

  constructor() {
    this.seed();
  }

  private seed(): void {
    this.decisionRecords = new Map([
      ['D1', {
        id: 'D1', title: 'Support Windows 7 clients', status: 'live', decided_at: '2021-03-01',
        depends_on: [], decided_by: ['platform'], sources: [source('doc', 'ADR-017', 'Browser support policy')], supersedes: [],
      }],
      ['D6', {
        id: 'D6', title: 'Ship legacy-compatible bundles', status: 'live', decided_at: '2021-04-01',
        depends_on: ['D1'], decided_by: ['platform'], sources: [source('ticket', 'PLAT-188', 'Bundle compatibility review')], supersedes: [],
      }],
      ['D5', {
        id: 'D5', title: 'Keep polyfill layer', status: 'live', decided_at: '2021-05-01',
        depends_on: ['D6'], decided_by: ['platform'], sources: [source('thread', 'eng-42', 'Polyfill trade-offs')], supersedes: [],
      }],
      ['D2', {
        id: 'D2', title: 'Keep win7 shim in compat module', status: 'live', decided_at: '2021-06-01',
        depends_on: ['D5'], scope: 'module:compat', constraint: 'requires_approval', actions: ['delete', 'modify'], severity: 'normal',
        decided_by: ['bob'], sources: [source('doc', 'ADR-021', 'Compatibility module ownership')], supersedes: [],
      }],
      ['D8', {
        id: 'D8', title: 'Do not use moment.js', status: 'live', decided_at: '2025-01-15',
        depends_on: [], scope: 'package:moment', constraint: 'prohibits', actions: ['add_dependency'], severity: 'high',
        decided_by: ['bob'], sources: [source('ticket', 'PLAT-441', 'Remove unmaintained package')], supersedes: [],
      }],
    ]);

    this.artifacts = new Map([
      ['repo:app', { id: 'repo:app', kind: 'repo', name: 'app' }],
      ['module:compat', { id: 'module:compat', kind: 'module', name: 'compat', part_of: 'repo:app' }],
      ['file:compat/win7_shim.js', { id: 'file:compat/win7_shim.js', kind: 'file', name: 'win7_shim.js', part_of: 'module:compat' }],
      ['file:docs/readme.md', { id: 'file:docs/readme.md', kind: 'file', name: 'readme.md' }],
      ['package:moment', { id: 'package:moment', kind: 'package', name: 'moment' }],
    ]);

    this.ledger = [
      {
        person: 'alice', answer: 'ESCALATE', answer_id: 'ans-021', at: '2025-02-03T09:12:00Z',
        summary: 'Deletion of win7_shim.js needs platform approval.', stale_decision: 'D2', used: ['D2', 'D5', 'D6', 'D1'],
      },
      {
        person: 'carol', answer: 'ESCALATE', answer_id: 'ans-034', at: '2025-04-18T15:41:00Z',
        summary: 'Ask platform before removing the Windows 7 shim.', stale_decision: 'D2', used: ['D2', 'D5', 'D6', 'D1'],
      },
    ];
    this.answerSequence = 100;
  }

  private record(id: string): DecisionRecord {
    const decision = this.decisionRecords.get(id);
    if (!decision) throw new Error(`Decision ${id} is not in the graph`);
    return decision;
  }

  private resolveArtifact(target: string): ArtifactRecord | undefined {
    return this.artifacts.get(target);
  }

  private artifactScopes(target: string): string[] {
    const scopes: string[] = [];
    let current = this.artifacts.get(target);
    while (current) {
      scopes.push(current.id);
      current = current.part_of ? this.artifacts.get(current.part_of) : undefined;
    }
    return scopes;
  }

  private ownerFor(target: string): Owner | null {
    if (!this.resolveArtifact(target)) return null;
    if (this.artifactScopes(target).includes('module:compat')) return { team: 'platform', people: ['bob'] };
    if (target === 'package:moment') return { team: 'platform', people: ['bob'] };
    return null;
  }

  private toRef(decision: DecisionRecord): DecisionRef {
    return {
      decision: decision.id,
      title: decision.title,
      status: decision.status,
      constraint: decision.constraint ?? 'informational',
      severity: decision.severity ?? 'normal',
      scope: decision.scope ?? 'company',
    };
  }

  private findDeadPremises(id: string, maxDepth: number): Array<{ id: string; status: DecisionStatus; hops: number; via: string[] }> {
    const dead: Array<{ id: string; status: DecisionStatus; hops: number; via: string[] }> = [];
    const queue: Array<{ id: string; hops: number; via: string[] }> = [{ id, hops: 0, via: [id] }];
    const seen = new Set<string>([id]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.hops >= maxDepth) continue;
      const decision = this.record(current.id);
      for (const premiseId of decision.depends_on) {
        if (seen.has(premiseId)) continue;
        seen.add(premiseId);
        const premise = this.record(premiseId);
        const hops = current.hops + 1;
        const via = [...current.via, premiseId];
        if (premise.status !== 'live') dead.push({ id: premise.id, status: premise.status, hops, via });
        if (premise.status === 'live') queue.push({ id: premiseId, hops, via });
      }
    }
    return dead;
  }

  private chainFor(id: string, maxDepth: number): string[] {
    const chain = [id];
    let current = id;
    for (let hop = 0; hop < maxDepth; hop += 1) {
      const next = this.record(current).depends_on[0];
      if (!next) break;
      chain.push(next);
      current = next;
    }
    return chain;
  }

  private pathFor(target: string, decisionIds: string[], depth: number): EvidencePath {
    const nodes: PathNode[] = [];
    const edges: PathEdge[] = [];
    const addNode = (node: PathNode): void => {
      if (!nodes.some((item) => item.id === node.id)) nodes.push(node);
    };
    addNode({ id: target, label: this.artifacts.get(target)?.name ?? target, type: 'Artifact', meta: target });
    for (const decisionId of decisionIds) {
      const chain = this.chainFor(decisionId, depth);
      const chainNodes = chain.map((id) => this.record(id));
      chainNodes.forEach((decision) => addNode({
        id: decision.id, label: decision.title, type: 'Decision', status: decision.status, meta: decision.decided_at,
      }));
      if (chain[0]) {
        edges.push(pathEdge(`${target}-governs-${chain[0]}`, target, chain[0], 'GOVERNS'));
      }
      for (let index = 0; index < chain.length - 1; index += 1) {
        edges.push(pathEdge(`${chain[index]}-depends-${chain[index + 1]}`, chain[index], chain[index + 1], 'DEPENDS_ON'));
      }
    }
    return { nodes, edges };
  }

  async check(request: CheckRequest): Promise<CheckResponse> {
    await wait();
    const target = this.resolveArtifact(request.target);
    if (!target) {
      return {
        verdict: 'UNKNOWN_TARGET', target: request.target, action: request.action, depth: request.depth,
        owner: null, live: [], stale: [], dead: [], info: [], path: {
          nodes: [{ id: request.target, label: request.target, type: 'Artifact' }], edges: [],
        }, note: 'This name does not resolve to a recorded artifact. Gatekeeper will not guess.', answer_id: this.nextAnswer(),
      };
    }

    const scopes = this.artifactScopes(target.id);
    const allGovernance = [...this.decisionRecords.values()].filter((decision) => decision.scope && scopes.includes(decision.scope));
    const applicable = allGovernance.filter((decision) => {
      const actions = decision.actions ?? [];
      return actions.includes('*') || actions.includes(request.action);
    });
    const live: DecisionRef[] = [];
    const stale: StaleDecision[] = [];
    const dead: DecisionRef[] = [];
    const info: DecisionRef[] = [];
    for (const decision of applicable) {
      const ref = this.toRef(decision);
      if (decision.status !== 'live') {
        dead.push(ref);
      } else {
        const deadPremises = this.findDeadPremises(decision.id, request.depth);
        if (deadPremises.length > 0) {
          stale.push({ ...ref, dead_premises: deadPremises.map((premise) => ({
            id: premise.id, title: this.record(premise.id).title, status: premise.status, hops: premise.hops, via: premise.via,
          })) });
        } else if (decision.constraint === 'informational') {
          info.push(ref);
        } else {
          live.push(ref);
        }
      }
    }

    let verdict: Verdict = 'UNGOVERNED';
    let note = 'Nothing recorded covers this action. That does not mean safe.';
    if (live.some((decision) => decision.constraint === 'prohibits' && decision.severity === 'high')) {
      verdict = 'BLOCK';
      note = 'A live high-severity prohibition covers this action.';
    } else if (live.length > 0) {
      verdict = 'ESCALATE';
      note = 'A live decision requires an owner to approve this action.';
    } else if (stale.length > 0) {
      verdict = 'STALE';
      note = 'The rule is live, but its reason expired. Confirm with the owner before acting.';
    } else if (dead.length > 0 || info.length > 0) {
      verdict = 'ALLOW';
      note = `Only historical or informational decisions cover this action. ${dead.map((item) => item.decision).join(', ') || 'No live constraint'} is not live.`;
    } else if (allGovernance.length > 0) {
      note = `This target is recorded, but no decision covers ${cleanAction(request.action)}.`;
    }
    const pathDecisionIds = [...new Set([...live, ...stale, ...dead, ...info].map((item) => item.decision))];
    return {
      verdict, target: request.target, action: request.action, depth: request.depth, owner: this.ownerFor(request.target),
      live, stale, dead, info, path: this.pathFor(request.target, pathDecisionIds, request.depth), note, answer_id: this.nextAnswer(),
    };
  }

  private nextAnswer(): string {
    this.answerSequence += 1;
    return `ans-${this.answerSequence}`;
  }

  async why(decisionId: string): Promise<WhyResponse> {
    await wait();
    const decision = this.record(decisionId);
    const premiseIds = this.chainFor(decisionId, 6).slice(1);
    const pathNodes: PathNode[] = [
      ...decision.sources.map((item) => ({ id: item.id, label: item.title, type: item.type === 'doc' ? 'Doc' : item.type === 'ticket' ? 'Ticket' : 'Thread' } as PathNode)),
      { id: decision.id, label: decision.title, type: 'Decision', status: decision.status },
      ...decision.decided_by.map((person) => ({ id: person, label: person, type: 'Person' } as PathNode)),
    ];
    const pathEdges: PathEdge[] = [];
    decision.sources.forEach((item) => pathEdges.push(pathEdge(`${item.id}-source-${decision.id}`, item.id, decision.id, 'SOURCED_FROM')));
    decision.decided_by.forEach((person) => pathEdges.push(pathEdge(`${decision.id}-by-${person}`, decision.id, person, 'DECIDED_BY')));
    return {
      id: decision.id,
      title: decision.title,
      status: decision.status,
      decided_at: decision.decided_at,
      sources: decision.sources,
      decided_by: decision.decided_by,
      supersedes: decision.supersedes,
      premises: premiseIds.map((id) => ({ id, title: this.record(id).title, status: this.record(id).status })),
      path: { nodes: pathNodes, edges: pathEdges },
    };
  }

  private affectedFor(oldId: string): AffectedResponse {
    const entries = this.ledger.filter((entry) => entry.used.includes(oldId));
    const decisionIds = [...new Set(entries.flatMap((entry) => entry.used))];
    const nodes: PathNode[] = decisionIds.map((id) => {
      const decision = this.record(id);
      return { id, label: decision.title, type: 'Decision', status: decision.status, meta: decision.decided_at };
    });
    const edges: PathEdge[] = [];
    for (let index = 0; index < decisionIds.length - 1; index += 1) {
      edges.push(pathEdge(`${decisionIds[index]}-depends-${decisionIds[index + 1]}`, decisionIds[index], decisionIds[index + 1], 'DEPENDS_ON'));
    }
    for (const entry of entries) {
      nodes.push({ id: entry.answer_id, label: entry.answer_id, type: 'Answer', meta: 'ledger' });
      nodes.push({ id: entry.person, label: entry.person, type: 'Person' });
      edges.push(pathEdge(`${entry.answer_id}-asked-${entry.person}`, entry.answer_id, entry.person, 'ASKED_BY'));
      for (const used of entry.used) edges.push(pathEdge(`${entry.answer_id}-used-${used}`, entry.answer_id, used, 'USED_IN'));
    }
    return {
      decision: oldId,
      rows: entries.map(({ used: _used, answer: _answer, ...entry }) => ({ ...entry })),
      path: { nodes, edges },
    };
  }

  private reversePath(oldId: string, newId: string, newTitle: string): EvidencePath {
    return {
      nodes: [
        { id: oldId, label: this.record(oldId).title, type: 'Decision', status: this.record(oldId).status },
        { id: newId, label: newTitle, type: 'Decision', status: 'live' },
      ],
      edges: [pathEdge(`${newId}-supersedes-${oldId}`, newId, oldId, 'SUPERSEDES')],
    };
  }

  async reverse(request: ReverseRequest): Promise<ReverseResponse> {
    await wait(60);
    const old = this.record(request.old);
    const affected = this.ledger.filter((entry) => entry.used.includes(old.id));
    const before = await this.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 6 });
    let afterVerdict: Verdict = before.verdict;
    if (old.id === 'D1') afterVerdict = 'STALE';
    const flips = before.verdict !== afterVerdict ? [{ target: 'file:compat/win7_shim.js', action: 'delete' as const, decision: 'D2', from_verdict: before.verdict, to_verdict: afterVerdict, path: this.pathFor('file:compat/win7_shim.js', ['D2'], 6) }] : [];
    if (!request.dry_run) {
      old.status = 'superseded';
      this.decisionRecords.set(request.new_id, {
        id: request.new_id,
        title: request.new_title,
        status: 'live',
        decided_at: '2026-10-17',
        depends_on: [],
        decided_by: ['platform'],
        sources: [source('doc', `${request.new_id}-record`, 'Reversal record')],
        supersedes: [old.id],
      });
    }
    return {
      flips,
      affected_people: affected.map(({ used: _used, ...entry }) => ({ ...entry })),
      committed: !request.dry_run,
      path: this.reversePath(old.id, request.new_id, request.new_title),
    };
  }

  async affected(decision: string): Promise<AffectedResponse> {
    await wait();
    this.record(decision);
    return this.affectedFor(decision);
  }

  async who(target: string): Promise<WhoResponse> {
    await wait();
    const owner = this.ownerFor(target);
    return {
      target,
      owners: owner ? [owner] : [],
      path: {
        nodes: owner ? [
          { id: target, label: this.artifacts.get(target)?.name ?? target, type: 'Artifact' },
          { id: owner.team, label: owner.team, type: 'Team' },
          ...owner.people.map((person) => ({ id: person, label: person, type: 'Person' as const })),
        ] : [],
        edges: owner ? [
          { id: `${owner.team}-owns-${target}`, source: owner.team, target, type: 'OWNS' },
          ...owner.people.map((person) => ({ id: `${person}-member-${owner.team}`, source: person, target: owner.team, type: 'MEMBER_OF' })),
        ] : [],
      },
    };
  }

  async loadBearing(limit = 5): Promise<LoadBearingItem[]> {
    await wait();
    const scores: LoadBearingItem[] = [
      { id: 'D1', title: 'Support Windows 7 clients', score: 0.94 },
      { id: 'D6', title: 'Ship legacy-compatible bundles', score: 0.78 },
      { id: 'D5', title: 'Keep polyfill layer', score: 0.63 },
      { id: 'D2', title: 'Keep win7 shim in compat module', score: 0.49 },
      { id: 'D8', title: 'Do not use moment.js', score: 0.18 },
    ];
    return scores.filter((item) => this.decisionRecords.has(item.id)).slice(0, limit);
  }

  graph(): Promise<GraphResponse> {
    const nodes: GraphNode[] = [
      { id: 'alice', type: 'Person', label: 'alice', meta: 'person', x: 56, y: 80 },
      { id: 'bob', type: 'Person', label: 'bob', meta: 'person', x: 56, y: 220 },
      { id: 'carol', type: 'Person', label: 'carol', meta: 'person', x: 56, y: 360 },
      { id: 'platform', type: 'Team', label: 'platform', meta: 'team', x: 220, y: 220 },
      { id: 'repo:app', type: 'Artifact', label: 'repo:app', meta: 'repo', x: 420, y: 80 },
      { id: 'module:compat', type: 'Artifact', label: 'module:compat', meta: 'module', x: 420, y: 220 },
      { id: 'file:compat/win7_shim.js', type: 'Artifact', label: 'win7_shim.js', meta: 'file', x: 420, y: 360 },
      { id: 'file:docs/readme.md', type: 'Artifact', label: 'readme.md', meta: 'file', x: 420, y: 500 },
      { id: 'package:moment', type: 'Artifact', label: 'package:moment', meta: 'package', x: 420, y: 640 },
      ...[...this.decisionRecords.values()].map((decision, index) => ({
        id: decision.id, type: 'Decision' as const, label: decision.title, status: decision.status,
        meta: decision.decided_at, x: 710, y: 60 + index * 130,
      })),
      { id: 'ADR-017', type: 'Doc', label: 'ADR-017', meta: 'source', x: 990, y: 40 },
      { id: 'PLAT-188', type: 'Ticket', label: 'PLAT-188', meta: 'source', x: 990, y: 170 },
      { id: 'eng-42', type: 'Thread', label: 'eng-42', meta: 'source', x: 990, y: 300 },
      { id: 'ADR-021', type: 'Doc', label: 'ADR-021', meta: 'source', x: 990, y: 430 },
      { id: 'PLAT-441', type: 'Ticket', label: 'PLAT-441', meta: 'source', x: 990, y: 560 },
      { id: 'ans-021', type: 'Answer', label: 'ans-021', meta: 'ledger', x: 220, y: 500 },
      { id: 'ans-034', type: 'Answer', label: 'ans-034', meta: 'ledger', x: 220, y: 620 },
    ];
    const edges: GraphEdge[] = [
      { id: 'bob-member-platform', source: 'bob', target: 'platform', type: 'MEMBER_OF' },
      { id: 'platform-owns-compat', source: 'platform', target: 'module:compat', type: 'OWNS' },
      { id: 'shim-part-compat', source: 'file:compat/win7_shim.js', target: 'module:compat', type: 'PART_OF' },
      { id: 'compat-part-repo', source: 'module:compat', target: 'repo:app', type: 'PART_OF' },
      { id: 'd2-governs-compat', source: 'D2', target: 'module:compat', type: 'GOVERNS', label: 'delete · modify' },
      { id: 'd8-governs-moment', source: 'D8', target: 'package:moment', type: 'GOVERNS', label: 'add_dependency' },
      { id: 'd2-dep-d5', source: 'D2', target: 'D5', type: 'DEPENDS_ON' },
      { id: 'd5-dep-d6', source: 'D5', target: 'D6', type: 'DEPENDS_ON' },
      { id: 'd6-dep-d1', source: 'D6', target: 'D1', type: 'DEPENDS_ON' },
      { id: 'D1-source', source: 'D1', target: 'ADR-017', type: 'SOURCED_FROM' },
      { id: 'D6-source', source: 'D6', target: 'PLAT-188', type: 'SOURCED_FROM' },
      { id: 'D5-source', source: 'D5', target: 'eng-42', type: 'SOURCED_FROM' },
      { id: 'D2-source', source: 'D2', target: 'ADR-021', type: 'SOURCED_FROM' },
      { id: 'D8-source', source: 'D8', target: 'PLAT-441', type: 'SOURCED_FROM' },
      { id: 'D2-decided-bob', source: 'D2', target: 'bob', type: 'DECIDED_BY' },
      { id: 'D8-decided-bob', source: 'D8', target: 'bob', type: 'DECIDED_BY' },
      { id: 'ans21-alice', source: 'ans-021', target: 'alice', type: 'ASKED_BY' },
      { id: 'ans34-carol', source: 'ans-034', target: 'carol', type: 'ASKED_BY' },
      { id: 'ans21-d2', source: 'ans-021', target: 'D2', type: 'USED_IN' },
      { id: 'ans34-d2', source: 'ans-034', target: 'D2', type: 'USED_IN' },
    ];
    for (const decision of this.decisionRecords.values()) {
      if (decision.supersedes[0]) edges.push({ id: `${decision.id}-supersedes-${decision.supersedes[0]}`, source: decision.id, target: decision.supersedes[0], type: 'SUPERSEDES' });
    }
    return Promise.resolve({ nodes, edges: edges.map((edge) => ({ ...edge, provenance: 'SYNTHETIC' as const })) });
  }

  async reset(): Promise<ResetResponse> {
    await wait(70);
    this.seed();
    const graph = await this.graph();
    return {
      reset: true,
      path: { nodes: [], edges: [] },
      fixture_counts: { nodes: graph.nodes.length, edges: graph.edges.length },
      real_counts: null,
    };
  }

  async ask(question: string): Promise<AskResponse> {
    await wait(80);
    const lower = question.toLowerCase();
    let request: CheckRequest = { target: 'file:compat/win7_shim.js', action: 'delete', depth: 6 };
    let explanation = 'The recorded graph has a live approval rule for this action.';
    if (lower.includes('moment')) {
      request = { target: 'package:moment', action: 'add_dependency', depth: 6 };
      explanation = 'A live high-severity prohibition covers adding moment.js.';
    } else if (lower.includes('readme')) {
      request = { target: 'file:docs/readme.md', action: 'delete', depth: 6 };
      explanation = 'This artifact resolves, but nothing recorded covers deleting it.';
    } else if (lower.includes('unknown') || lower.includes('not in')) {
      request = { target: 'file:unknown/ghost.ts', action: 'delete', depth: 6 };
      explanation = 'That name was not returned by the graph, so Gatekeeper refuses to guess.';
    }
    const result = await this.check(request);
    const tool_calls: AgentToolCall[] = [
      { tool: 'resolve_target', args: { target: request.target }, status: 'validated' },
      { tool: 'check_action', args: { target: request.target, action: request.action, depth: request.depth }, status: 'complete' },
    ];
    return { question, tool_calls, result, explanation, names_verified: result.verdict !== 'UNKNOWN_TARGET' };
  }
}
