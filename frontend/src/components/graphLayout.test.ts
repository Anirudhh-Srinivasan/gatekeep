import { describe, expect, it } from 'vitest';
import type { GraphResponse } from '../api/types';
import { layoutGraph } from './graphLayout';

describe('graph layout', () => {
  it('layers dependency decisions left-to-right and keeps every node apart', () => {
    const graph: GraphResponse = {
      nodes: [
        { id: 'D1', type: 'Decision', label: 'root' },
        { id: 'D2', type: 'Decision', label: 'dependent' },
        { id: 'app', type: 'Artifact', label: 'app' },
        { id: 'pep', type: 'Doc', label: 'pep' },
        { id: 'alice', type: 'Person', label: 'alice' },
      ],
      edges: [{ id: 'D2-D1', source: 'D2', target: 'D1', type: 'DEPENDS_ON' }],
    };

    const positions = layoutGraph(graph);
    expect(positions.get('D2')?.x).toBeLessThan(positions.get('D1')?.x ?? 0);
    expect(new Set([...positions.values()].map((position) => `${position.x}:${position.y}`)).size).toBe(graph.nodes.length);
    expect([...positions.values()].every((position) => Number.isFinite(position.x) && Number.isFinite(position.y))).toBe(true);
  });
});
