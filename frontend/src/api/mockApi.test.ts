import { describe, expect, it } from 'vitest';
import { MockApi } from './mockApi';

describe('Gatekeeper stateful mock API', () => {
  it('Flip: explains the depth change after reversing D1', async () => {
    const api = new MockApi();
    const shallowBefore = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 1 });
    const fullBefore = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 4 });
    expect(shallowBefore.verdict).toBe('ESCALATE');
    expect(fullBefore.verdict).toBe('ESCALATE');
    expect(fullBefore.path.nodes.map((node) => node.id)).toEqual(['file:compat/win7_shim.js', 'D2', 'D5', 'D6', 'D1']);

    const preview = await api.reverse({ old: 'D1', new_id: 'D4', new_title: 'Drop Windows 7 support', dry_run: true });
    expect(preview.committed).toBe(false);
    expect(preview.flips[0]).toMatchObject({ target: 'file:compat/win7_shim.js', action: 'delete', decision: 'D2', from_verdict: 'ESCALATE', to_verdict: 'STALE' });
    expect(preview.flips[0].path.edges.every((edge) => edge.provenance === 'SYNTHETIC')).toBe(true);
    expect(preview.affected_people.map((person) => person.person)).toEqual(['alice', 'carol']);

    await api.reverse({ old: 'D1', new_id: 'D4', new_title: 'Drop Windows 7 support', dry_run: false });
    const shallowAfter = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 1 });
    const fullAfter = await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 4 });
    expect(shallowAfter.verdict).toBe('ESCALATE');
    expect(fullAfter.verdict).toBe('STALE');
    expect(fullAfter.stale[0].dead_premises[0]).toMatchObject({ id: 'D1', hops: 3, status: 'superseded' });
  });

  it('Block: rejects a high severity package prohibition', async () => {
    const api = new MockApi();
    const result = await api.check({ target: 'package:moment', action: 'add_dependency', depth: 6 });
    expect(result.verdict).toBe('BLOCK');
    expect(result.live[0].decision).toBe('D8');
    expect(result.path.nodes.map((node) => node.id)).toContain('D8');
  });

  it('Ungoverned: distinguishes missing policy from an unknown target', async () => {
    const api = new MockApi();
    const ungoverned = await api.check({ target: 'file:docs/readme.md', action: 'delete', depth: 6 });
    const unknown = await api.check({ target: 'file:does-not-exist.ts', action: 'delete', depth: 6 });
    expect(ungoverned.verdict).toBe('UNGOVERNED');
    expect(ungoverned.note).toContain('does not mean safe');
    expect(unknown.verdict).toBe('UNKNOWN_TARGET');
    expect(unknown.path.nodes[0].id).toBe('file:does-not-exist.ts');
  });

  it('Ledger: identifies the people who received the old answer', async () => {
    const api = new MockApi();
    const preview = await api.reverse({ old: 'D1', new_id: 'D4', new_title: 'Drop Windows 7 support', dry_run: true });
    expect(preview.affected_people).toHaveLength(2);
    expect(preview.affected_people.map((person) => person.person)).toEqual(['alice', 'carol']);
    await api.reverse({ old: 'D1', new_id: 'D4', new_title: 'Drop Windows 7 support', dry_run: false });
    const affected = await api.affected('D1');
    expect(affected.rows).toHaveLength(2);
    expect(affected.rows.map((row) => [row.person, row.answer_id, row.stale_decision])).toEqual([
      ['alice', 'ans-021', 'D2'],
      ['carol', 'ans-034', 'D2'],
    ]);
  });

  it('Reset: returns the engine response shape and restores the synthetic graph', async () => {
    const api = new MockApi();
    await api.reverse({ old: 'D1', new_id: 'D4', new_title: 'Drop Windows 7 support', dry_run: false });
    const result = await api.reset();
    expect(result).toMatchObject({ reset: true, path: { nodes: [], edges: [] }, real_counts: null });
    expect(result.fixture_counts.nodes).toBeGreaterThan(0);
    expect(result.fixture_counts.edges).toBeGreaterThan(0);
    expect((await api.check({ target: 'file:compat/win7_shim.js', action: 'delete', depth: 6 })).verdict).toBe('ESCALATE');
  });
});
