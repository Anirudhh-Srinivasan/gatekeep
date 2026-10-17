from __future__ import annotations

import os
from typing import Any

from falkordb import FalkorDB


def connect() -> FalkorDB:
    kwargs: dict[str, Any] = {
        "host": os.getenv("FALKORDB_HOST", "127.0.0.1"),
        "port": int(os.getenv("FALKORDB_PORT", "6379")),
    }
    if os.getenv("FALKORDB_MAX_CONNECTIONS"):
        kwargs["max_connections"] = int(os.getenv("FALKORDB_MAX_CONNECTIONS", "32"))
    username = os.getenv("FALKORDB_USERNAME", "")
    password = os.getenv("FALKORDB_PASSWORD", "")
    if username:
        kwargs["username"] = username
    if password:
        kwargs["password"] = password
    return FalkorDB(**kwargs)


def select_graph(client: FalkorDB, name: str | None = None):
    return client.select_graph(name or os.getenv("FALKORDB_GRAPH", "gatekeeper"))


def graph_name(name: str | None = None) -> str:
    return name or os.getenv("FALKORDB_GRAPH", "gatekeeper")


def drop_graph(client: FalkorDB, name: str) -> None:
    # FalkorDB exposes graph deletion through the Redis command directly.
    client.connection.execute_command("GRAPH.DELETE", name)


def query(graph: Any, statement: str, params: dict[str, Any] | None = None):
    return graph.query(statement, params or {})
