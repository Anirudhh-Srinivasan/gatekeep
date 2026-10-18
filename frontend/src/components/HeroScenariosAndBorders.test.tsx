import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VERDICTS, type CheckResponse, type GraphNode } from '../api/types';
import { MockApi } from '../api/mockApi';
import { GatekeeperProvider } from '../store/useGatekeeperStore';
import { VerdictCard } from './VerdictCard';
import { DepthContrast } from './DepthContrast';
import { ReversePanel } from './ReversePanel';
import { verdictPatternClass } from './verdictText';

describe('Point 2 & Phase 2: Distinct border classes across all 6 verdicts', () => {
  it('verifies verdictPatternClass returns the exact expected class for each verdict', () => {
    expect(verdictPatternClass('BLOCK')).toBe('verdict-card-block');
    expect(verdictPatternClass('ESCALATE')).toBe('verdict-card-escalate');
    expect(verdictPatternClass('STALE')).toBe('verdict-card-stale');
    expect(verdictPatternClass('ALLOW')).toBe('verdict-card-allow');
    expect(verdictPatternClass('UNGOVERNED')).toBe('verdict-card-ungoverned');
    expect(verdictPatternClass('UNKNOWN_TARGET')).toBe('verdict-card-unknown_target');
  });

  it('renders VerdictCard for all six verdicts and asserts each gets its distinct border pattern class', () => {
    VERDICTS.forEach((verdict) => {
      const mockResult: CheckResponse = {
        verdict,
        target: 'file:compat/win7_shim.js',
        action: 'delete',
        depth: 6,
        answer_id: `ans_${verdict.toLowerCase()}`,
        owner: null,
        live: [],
        stale: [],
        dead: [],
        info: [],
        note: 'Test note',
        path: { nodes: [], edges: [] },
      };

      const markup = renderToStaticMarkup(
        <GatekeeperProvider>
          <VerdictCard result={mockResult} ripple={0} onDecisionClick={() => undefined} />
        </GatekeeperProvider>
      );

      const expectedClass = verdictPatternClass(verdict);
      expect(markup).toContain(expectedClass);
      expect(markup).toContain(verdict);
    });
  });
});

describe('Point 7: Four Hero Scenarios Standalone', () => {
  it('Hero Scenario 1 (Flip): shallow ESCALATE, full STALE after reversing D1 with D4', async () => {
    const api = new MockApi();
    await api.reverse({ old: 'D1', new_id: 'D4', new_title: 'Drop Windows 7 support', dry_run: false });
    const shallow = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 1 });
    const full = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 4 });
    expect(shallow.verdict).toBe('ESCALATE');
    expect(full.verdict).toBe('STALE');
    expect(full.stale[0]?.dead_premises[0]?.id).toBe('D1');
    expect(full.stale[0]?.dead_premises[0]?.hops).toBe(3);
  });

  it('Hero Scenario 2 (Block): moment add_dependency rejects high severity package prohibition', async () => {
    const api = new MockApi();
    const res = await api.check({ target: 'package:moment', action: 'add_dependency', depth: 4 });
    expect(res.verdict).toBe('BLOCK');
  });

  it('Hero Scenario 3 (Ungoverned): readme.md delete returns UNGOVERNED', async () => {
    const api = new MockApi();
    const res = await api.check({ target: 'file:docs/readme.md', action: 'delete', depth: 4 });
    expect(res.verdict).toBe('UNGOVERNED');
  });

  it('Hero Scenario 4 (Ledger): affected(D1) lists alice and carol', async () => {
    const api = new MockApi();
    const res = await api.affected('D1');
    expect(res.rows.map((r) => r.person)).toEqual(['alice', 'carol']);
  });
});

describe('Phase 3: End-to-end hero flow verification on one MockApi instance', () => {
  it('verifies the entire sequence in order on a single MockApi instance', async () => {
    const api = new MockApi();

    // 6.a: check(file:compat/win7_shim.js, delete) at depth 1 and depth 6 before reversal
    const checkD1_before = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 1 });
    const checkD6_before = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 6 });

    console.log('[E2E 6.a] Depth 1 before reversal verdict:', checkD1_before.verdict);
    console.log('[E2E 6.a] Depth 1 path nodes:', checkD1_before.path.nodes.map((n) => n.id));
    console.log('[E2E 6.a] Depth 6 before reversal verdict:', checkD6_before.verdict);
    console.log('[E2E 6.a] Depth 6 path nodes:', checkD6_before.path.nodes.map((n) => n.id));

    expect(checkD1_before.verdict).toBe('ESCALATE');
    expect(checkD6_before.verdict).toBe('ESCALATE');
    expect(checkD1_before.path.nodes.map((n) => n.id)).toEqual(['file:compat/win7_shim.js', 'D2', 'D5']);
    expect(checkD6_before.path.nodes.map((n) => n.id)).toEqual(['file:compat/win7_shim.js', 'D2', 'D5', 'D6', 'D1']);

    // 6.b: reverse D1 with D4 as dry run
    const dryRun = await api.reverse({
      old: 'D1',
      new_id: 'D4',
      new_title: 'Drop Windows 7 support',
      dry_run: true,
    });
    console.log('[E2E 6.b] Dry run committed status:', dryRun.committed);
    console.log('[E2E 6.b] Dry run affected people:', dryRun.affected_people.map((p) => p.person));
    console.log('[E2E 6.b] Dry run flips:', dryRun.flips.map((f) => `${f.target} ${f.from_verdict}->${f.to_verdict}`));

    expect(dryRun.committed).toBe(false);
    expect(dryRun.affected_people.map((p) => p.person)).toEqual(['alice', 'carol']);
    expect(dryRun.flips[0]).toMatchObject({
      target: 'file:compat/win7_shim.js',
      action: 'delete',
      decision: 'D2',
      from_verdict: 'ESCALATE',
      to_verdict: 'STALE',
    });

    // Assert dry run did NOT change later check results
    const checkD6_afterDry = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 6 });
    console.log('[E2E 6.b] Depth 6 after dry-run verdict (must stay ESCALATE):', checkD6_afterDry.verdict);
    expect(checkD6_afterDry.verdict).toBe('ESCALATE');

    // 6.c: reverse committed
    const commitRes = await api.reverse({
      old: 'D1',
      new_id: 'D4',
      new_title: 'Drop Windows 7 support',
      dry_run: false,
    });
    console.log('[E2E 6.c] Commit result committed status:', commitRes.committed);
    expect(commitRes.committed).toBe(true);

    const checkD1_afterCommit = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 1 });
    const checkD4_afterCommit = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 4 });
    const checkD6_afterCommit = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 6 });

    console.log('[E2E 6.c] Depth 1 after commit verdict:', checkD1_afterCommit.verdict);
    console.log('[E2E 6.c] Depth 4 after commit verdict:', checkD4_afterCommit.verdict);
    console.log('[E2E 6.c] Depth 6 after commit verdict:', checkD6_afterCommit.verdict);
    console.log('[E2E 6.c] Depth 6 dead premise ID:', checkD6_afterCommit.stale[0]?.dead_premises[0]?.id);
    console.log('[E2E 6.c] Depth 6 dead premise hops:', checkD6_afterCommit.stale[0]?.dead_premises[0]?.hops);

    expect(checkD1_afterCommit.verdict).toBe('ESCALATE');
    expect(checkD4_afterCommit.verdict).toBe('STALE');
    expect(checkD6_afterCommit.verdict).toBe('STALE');
    expect(checkD6_afterCommit.stale[0]?.dead_premises[0]?.id).toBe('D1');
    expect(checkD6_afterCommit.stale[0]?.dead_premises[0]?.hops).toBe(3);

    // 6.d: check(package:moment, add_dependency) is BLOCK
    const blockRes = await api.check({ target: 'package:moment', action: 'add_dependency', depth: 4 });
    console.log('[E2E 6.d] package:moment add_dependency verdict:', blockRes.verdict);
    expect(blockRes.verdict).toBe('BLOCK');

    // check(file:docs/readme.md, delete) is UNGOVERNED with note saying nothing recorded covers it
    const ungovernedRes = await api.check({ target: 'file:docs/readme.md', action: 'delete', depth: 4 });
    console.log('[E2E 6.d] file:docs/readme.md delete verdict:', ungovernedRes.verdict);
    console.log('[E2E 6.d] file:docs/readme.md note:', ungovernedRes.note);
    expect(ungovernedRes.verdict).toBe('UNGOVERNED');
    expect(ungovernedRes.note).toContain('Nothing recorded covers this');

    // affected(D1) lists alice and carol
    const affectedRes = await api.affected('D1');
    console.log('[E2E 6.d] affected(D1) people:', affectedRes.rows.map((r) => r.person));
    expect(affectedRes.rows.map((r) => r.person)).toEqual(['alice', 'carol']);

    // 6.e: UNKNOWN_TARGET for a nonexistent target
    const unknownRes = await api.check({ target: 'file:missing_fixture.ts', action: 'delete', depth: 6 });
    console.log('[E2E 6.e] Nonexistent target verdict:', unknownRes.verdict);
    console.log('[E2E 6.e] Nonexistent target note:', unknownRes.note);
    expect(unknownRes.verdict).toBe('UNKNOWN_TARGET');
    expect(unknownRes.note).toContain('This name does not resolve to a recorded artifact');
  });

  it('7. Render test: ReversePanel markup contains no enabled commit button before a dry run', () => {
    const mockNodes: GraphNode[] = [
      { id: 'D1', type: 'Decision', label: 'Support Windows 7' },
      { id: 'D2', type: 'Decision', label: 'Require approval for shim' },
    ];

    const markup = renderToStaticMarkup(
      <GatekeeperProvider>
        <ReversePanel graphNodes={mockNodes} />
      </GatekeeperProvider>
    );

    // Dry-run button is present
    expect(markup).toContain('Dry-run flip preview');

    // Commit buttons are strictly NOT rendered prior to a dry run
    expect(markup).not.toContain('Continue to commit');
    expect(markup).not.toContain('Commit reversal');

    // The empty state guidance is visible
    expect(markup).toContain('No pending reversal. Choose a decision and run a dry run');
  });

  it('Render test for the Flip Banner in DepthContrast with fixture results', async () => {
    const api = new MockApi();
    await api.reverse({ old: 'D1', new_id: 'D4', new_title: 'Drop Windows 7 support', dry_run: false });
    const shallow = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 1 });
    const full = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 4 });

    const markup = renderToStaticMarkup(
      <GatekeeperProvider>
        <DepthContrast testShallow={shallow} testFull={full} />
      </GatekeeperProvider>
    );

    expect(markup).toContain('DECISION FLIP DETECTED AT DEPTH');
    expect(markup).toContain('Depth 1: ESCALATE');
    expect(markup).toContain('Full depth: STALE');
    expect(markup).toContain('because D1 was reversed');
    expect(markup).toContain('Premise D1 was invalidated at hop 3');
  });
});
