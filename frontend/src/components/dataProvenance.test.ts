import { describe, expect, it } from 'vitest';
import type { GraphResponse } from '../api/types';
import { dataBadgeForGraph } from './dataProvenance';

describe('graph data provenance badge', () => {
  it('labels a graph with only synthetic provenance as synthetic', () => {
    const graph: GraphResponse = {
      nodes: [{ id: 'D1', type: 'Decision', label: 'decision' }],
      edges: [{ id: 'edge', source: 'D1', target: 'D1', type: 'TEST', provenance: 'SYNTHETIC' }],
    };
    expect(dataBadgeForGraph(graph)).toBe('SYNTHETIC DATA');
  });

  it('labels real or curated provenance alongside synthetic provenance as mixed', () => {
    const graph: GraphResponse = {
      nodes: [{ id: 'D1', type: 'Decision', label: 'decision' }],
      edges: [
        { id: 'synthetic', source: 'D1', target: 'D1', type: 'TEST', provenance: 'SYNTHETIC' },
        { id: 'real', source: 'D1', target: 'D1', type: 'SOURCED_FROM', provenance: 'REAL' },
        { id: 'curated', source: 'D1', target: 'D1', type: 'SOURCED_FROM', provenance: 'CURATED' },
      ],
    };
    expect(dataBadgeForGraph(graph)).toBe('MIXED DATA (synthetic + real/curated)');
  });
});
