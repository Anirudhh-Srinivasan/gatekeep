import { describe, expect, it } from 'vitest';
import type { GraphResponse, LoadBearingItem } from '../api/types';
import { filterLoadBearingItems } from './loadBearingUtils';

describe('load-bearing decision filter', () => {
  it('keeps only positive-score decisions with at least one dependent', () => {
    const items: LoadBearingItem[] = [
      { id: 'D1', title: 'root', score: 0.9 },
      { id: 'D2', title: 'isolated', score: 0.8 },
      { id: 'D3', title: 'zero', score: 0 },
    ];
    const graph: GraphResponse = {
      nodes: [],
      edges: [{ id: 'D2-D1', source: 'D2', target: 'D1', type: 'DEPENDS_ON' }],
    };
    expect(filterLoadBearingItems(items, graph).map((item) => item.id)).toEqual(['D1']);
  });
});
