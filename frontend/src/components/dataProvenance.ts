import type { GraphResponse } from '../api/types';

export type GraphProvenance = 'REAL' | 'CURATED' | 'SYNTHETIC';

const isGraphProvenance = (value: unknown): value is GraphProvenance => value === 'REAL' || value === 'CURATED' || value === 'SYNTHETIC';

export function graphProvenanceValues(graph: GraphResponse | null): GraphProvenance[] {
  if (!graph) return [];
  const values = new Set<GraphProvenance>();
  for (const node of graph.nodes) {
    const provenance = (node as GraphResponse['nodes'][number] & { provenance?: unknown }).provenance;
    if (isGraphProvenance(provenance)) values.add(provenance);
  }
  for (const edge of graph.edges) {
    if (isGraphProvenance(edge.provenance)) values.add(edge.provenance);
  }
  return [...values];
}

export function dataBadgeForGraph(graph: GraphResponse | null): string {
  const values = graphProvenanceValues(graph);
  if (values.length === 0) return 'DATA PENDING';
  return values.every((value) => value === 'SYNTHETIC')
    ? 'SYNTHETIC DATA'
    : 'MIXED DATA (synthetic + real/curated)';
}
