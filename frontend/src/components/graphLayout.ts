import type { GraphNode, GraphResponse } from '../api/types';

export interface GraphPosition {
  x: number;
  y: number;
}

const ROW_HEIGHT = 132;
const MAX_ROWS = 8;
const COLUMN_GAP = 180;
const GROUP_GAP = 280;

const sortNodes = (nodes: GraphNode[]): GraphNode[] => [...nodes].sort((a, b) => a.id.localeCompare(b.id));

/**
 * Give the graph a stable, readable layout when the API does not provide
 * coordinates. Decisions are layered from the governing decision toward their
 * dependency, while the other node families stay in semantic lanes around it.
 * The result is deliberately deterministic so filters and refreshes do not
 * make the graph jump around.
 */
export function layoutGraph(graph: GraphResponse): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>();
  const decisions = graph.nodes.filter((node) => node.type === 'Decision');
  const decisionIds = new Set(decisions.map((node) => node.id));
  const dependencies = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.type !== 'DEPENDS_ON' || !decisionIds.has(edge.source) || !decisionIds.has(edge.target)) continue;
    dependencies.set(edge.source, [...(dependencies.get(edge.source) ?? []), edge.target]);
  }

  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();
  const decisionDepth = (id: string): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const depth = Math.max(0, ...(dependencies.get(id) ?? []).map(decisionDepth).map((value) => value + 1));
    visiting.delete(id);
    depthCache.set(id, depth);
    return depth;
  };

  decisions.forEach((node) => decisionDepth(node.id));
  const maxDepth = Math.max(0, ...decisions.map((node) => depthCache.get(node.id) ?? 0));
  const decisionsByLayer = new Map<number, GraphNode[]>();
  for (const node of sortNodes(decisions)) {
    const layer = maxDepth - (depthCache.get(node.id) ?? 0);
    decisionsByLayer.set(layer, [...(decisionsByLayer.get(layer) ?? []), node]);
  }

  let nextLaneX = 40;
  const placeLane = (nodes: GraphNode[], startX: number): number => {
    for (const [index, node] of sortNodes(nodes).entries()) {
      positions.set(node.id, {
        x: startX + Math.floor(index / MAX_ROWS) * COLUMN_GAP,
        y: 52 + (index % MAX_ROWS) * ROW_HEIGHT,
      });
    }
    return nodes.length === 0 ? startX : startX + Math.floor((nodes.length - 1) / MAX_ROWS) * COLUMN_GAP;
  };

  nextLaneX = placeLane(graph.nodes.filter((node) => ['Person', 'Team', 'Answer'].includes(node.type)), nextLaneX) + GROUP_GAP;
  nextLaneX = placeLane(graph.nodes.filter((node) => node.type === 'Artifact'), Math.max(320, nextLaneX)) + GROUP_GAP;

  let decisionStartX = Math.max(560, nextLaneX);
  for (const layer of [...decisionsByLayer.keys()].sort((a, b) => a - b)) {
    const layerNodes = decisionsByLayer.get(layer) ?? [];
    for (const [index, node] of layerNodes.entries()) {
      positions.set(node.id, {
        x: decisionStartX + Math.floor(index / MAX_ROWS) * COLUMN_GAP,
        y: 52 + (index % MAX_ROWS) * ROW_HEIGHT,
      });
    }
    decisionStartX += Math.max(COLUMN_GAP, Math.ceil(layerNodes.length / MAX_ROWS) * COLUMN_GAP) + 40;
  }

  const maxDecisionX = decisions.length === 0 ? decisionStartX : Math.max(...decisions.map((node) => positions.get(node.id)?.x ?? decisionStartX));
  nextLaneX = maxDecisionX + GROUP_GAP;
  nextLaneX = placeLane(graph.nodes.filter((node) => ['Doc', 'Ticket', 'Thread'].includes(node.type)), nextLaneX);

  // Keep an unknown future node type visible rather than collapsing it at 0,0.
  const fallbackX = nextLaneX + GROUP_GAP;
  sortNodes(graph.nodes).forEach((node, index) => {
    if (!positions.has(node.id)) positions.set(node.id, { x: fallbackX + Math.floor(index / MAX_ROWS) * COLUMN_GAP, y: 52 + (index % MAX_ROWS) * ROW_HEIGHT });
  });

  return positions;
}
