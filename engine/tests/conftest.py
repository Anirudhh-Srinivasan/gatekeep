from __future__ import annotations

from uuid import uuid4

import pytest

from gatekeeper_engine.db import connect, drop_graph, select_graph
from gatekeeper_engine.fixtures import seed_fixture


@pytest.fixture
def graph():
    client = connect()
    name = f"gatekeeper_test_{uuid4().hex}"
    selected = select_graph(client, name)
    seed_fixture(selected)
    try:
        yield selected
    finally:
        drop_graph(client, name)
