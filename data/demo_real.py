from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "engine"))
from gatekeeper_engine.db import connect, select_graph  # noqa: E402
from loader import load_real_data  # noqa: E402


client = connect()
graph = select_graph(client)
print(f"loaded_records={load_real_data(graph)}")
print(graph.query("MATCH (d:Decision) WHERE d.id STARTS WITH 'real:pep:' RETURN d.id, d.title ORDER BY d.id").result_set)
