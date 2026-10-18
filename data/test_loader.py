from __future__ import annotations

from uuid import uuid4

import pytest

from loader import load_real_data


@pytest.fixture
def graph():
    try:
        from falkordb import FalkorDB
        client = FalkorDB(host="127.0.0.1", port=6379)
        name = f"gatekeep_real_test_{uuid4().hex}"
        graph = client.select_graph(name)
        graph.query("RETURN 1")
    except Exception as exc:
        pytest.skip(f"real FalkorDB unavailable: {exc}")
    try:
        yield graph
    finally:
        client.connection.execute_command("GRAPH.DELETE", name)


def test_real_slice_is_idempotent_and_namespaced(graph):
    assert load_real_data(graph)["records"] == 3
    assert load_real_data(graph)["records"] == 3
    nodes = graph.query("MATCH (n) WHERE n.provenance = 'REAL' RETURN count(n)").result_set[0][0]
    decisions = graph.query("MATCH (n:Decision) WHERE n.provenance = 'REAL' RETURN count(n)").result_set[0][0]
    docs = graph.query("MATCH (n:Doc) WHERE n.provenance = 'REAL' RETURN count(n)").result_set[0][0]
    assert (nodes, decisions, docs) == (6, 3, 3)
    assert graph.query("MATCH (n) WHERE n.synthetic = true RETURN count(n)").result_set[0][0] == 0
