import { useMemo, useState } from 'react';
import { Background, Controls, MiniMap, ReactFlow, Handle, Position, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { GraphNode, GraphNodeType } from '../api/types';
import { useGatekeeperStore } from '../store/useGatekeeperStore';

type HighlightableNode = GraphNode & { highlighted?: boolean; dimmed?: boolean } & Record<string, unknown>;
type FlowNode = Node<HighlightableNode>;

const typeColor: Record<GraphNodeType, string> = {
  Person: '#c8f36a', Team: '#8bd5a5', Artifact: '#93b4c7', Decision: '#f0a14c', Doc: '#c6a8e8', Ticket: '#c6a8e8', Thread: '#c6a8e8', Answer: '#e4c662',
};

function GraphNodeView({ data }: NodeProps<FlowNode>): JSX.Element {
  const isDecision = data.type === 'Decision';
  const faded = isDecision && data.status !== 'live';
  return (
    <div className={`custom-graph-node ${isDecision ? 'is-decision' : ''} ${faded ? 'is-superseded' : ''} ${data.dimmed ? 'is-dimmed' : ''}`} style={{ borderColor: data.highlighted ? 'var(--accent)' : `${typeColor[data.type]}66`, boxShadow: data.highlighted ? '0 0 22px rgba(200,243,106,.22)' : undefined }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="graph-node-type" style={{ color: typeColor[data.type] }}>{data.type}</div>
      <div className="graph-node-label" title={data.label}>{data.label}</div>
      {isDecision && <div className="graph-node-status" style={{ color: data.status === 'live' ? 'var(--allow)' : 'var(--stale)' }}><i className="graph-node-dot" />{data.status}</div>}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { graphNode: GraphNodeView };
const filterTypes: Array<{ label: string; types: GraphNodeType[] }> = [
  { label: 'decisions', types: ['Decision'] },
  { label: 'artifacts', types: ['Artifact'] },
  { label: 'people', types: ['Person', 'Team'] },
  { label: 'sources', types: ['Doc', 'Ticket', 'Thread', 'Answer'] },
];

export function GraphExplorer(): JSX.Element {
  const { graph, isLoadingGraph } = useGatekeeperStore();
  const [activeFilters, setActiveFilters] = useState<GraphNodeType[]>(['Decision', 'Artifact', 'Person', 'Team', 'Doc', 'Ticket', 'Thread', 'Answer']);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const nodes = useMemo<FlowNode[]>(() => {
    if (!graph) return [];
    const neighbourIds = hovered ? new Set(graph.edges.flatMap((edge) => edge.source === hovered ? [edge.target] : edge.target === hovered ? [edge.source] : [])) : new Set<string>();
    return graph.nodes.filter((node) => activeFilters.includes(node.type)).map((node) => ({
      id: node.id,
      type: 'graphNode',
      position: { x: node.x ?? 0, y: node.y ?? 0 },
      data: { ...node, highlighted: hovered === node.id, dimmed: Boolean(hovered && hovered !== node.id && !neighbourIds.has(node.id)) },
    }));
  }, [activeFilters, graph, hovered]);
  const edges = useMemo<Edge[]>(() => {
    if (!graph) return [];
    const ids = new Set(nodes.map((node) => node.id));
    return graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({
      id: edge.id, source: edge.source, target: edge.target, label: edge.label ?? edge.type, type: 'smoothstep',
      style: { stroke: hovered && edge.source !== hovered && edge.target !== hovered ? '#35413a' : '#708077', strokeWidth: hovered && (edge.source === hovered || edge.target === hovered) ? 2 : 1 },
      labelStyle: { fill: '#8a9990', fontFamily: 'JetBrains Mono', fontSize: 8 },
      animated: hovered === edge.source || hovered === edge.target,
    }));
  }, [graph, hovered, nodes]);
  const toggleFilter = (types: GraphNodeType[]): void => {
    setActiveFilters((current) => {
      const allOn = types.every((type) => current.includes(type));
      return allOn ? current.filter((type) => !types.includes(type)) : [...new Set([...current, ...types])];
    });
  };
  return (
    <section className="panel" aria-labelledby="graph-title">
      <div className="panel-header"><div><h2 id="graph-title" className="panel-title">Graph explorer</h2><p className="panel-description">The verdict is a traversal, not a badge. Hover to see neighbours; decisions fade when superseded.</p></div><span className="eyebrow-tag" style={{ padding: '6px 8px' }}>synthetic fixture</span></div>
      <div className="panel-body"><div className="graph-legend">{filterTypes.map((filter) => <button key={filter.label} type="button" className={`tab-button ${filter.types.every((type) => activeFilters.includes(type)) ? 'is-active' : ''}`} onClick={() => toggleFilter(filter.types)}>{filter.label}</button>)}</div>{isLoadingGraph && <div className="empty-state">Refreshing the graph…</div>}{!isLoadingGraph && graph && <div className="graph-shell"><ReactFlow<FlowNode, Edge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: .14 }} minZoom={.35} maxZoom={1.4} onNodeMouseEnter={(_, node) => setHovered(node.id)} onNodeMouseLeave={() => setHovered(null)} onNodeClick={(_, node) => setSelected(node.data)} proOptions={{ hideAttribution: true }}><Background color="#26312d" gap={24} size={1} /><Controls showInteractive={false} /><MiniMap nodeColor={(node) => typeColor[(node.data as unknown as HighlightableNode).type]} maskColor="rgba(16,19,19,.78)" /></ReactFlow></div>}{selected && <div className="graph-detail"><strong>{selected.id}</strong> · {selected.type} · {selected.label}{selected.status ? ` · ${selected.status}` : ''}</div>}</div>
    </section>
  );
}
