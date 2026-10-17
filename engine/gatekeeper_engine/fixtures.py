from __future__ import annotations

from typing import Any

from .db import query
from .queries import COUNT_EDGES, COUNT_NODES, RESET_GRAPH, SEED_EDGES, SEED_LEDGER, SEED_NODES


def seed_fixture(graph: Any) -> None:
    query(graph, RESET_GRAPH)
    query(graph, SEED_NODES)
    query(graph, SEED_EDGES)
    query(graph, SEED_LEDGER)


def graph_counts(graph: Any) -> dict[str, int]:
    nodes = query(graph, COUNT_NODES).result_set
    edges = query(graph, COUNT_EDGES).result_set
    return {"nodes": int(nodes[0][0]), "edges": int(edges[0][0])}
