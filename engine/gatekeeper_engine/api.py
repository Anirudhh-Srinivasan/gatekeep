from __future__ import annotations

import os
from typing import Any

from .audit import audit as audit_graph
from .db import connect, select_graph
from .fixtures import seed_fixture
from .models import (
    Action,
    AffectedResponse,
    AuditReport,
    CheckResponse,
    DecisionItem,
    EvidencePath,
    GraphResponse,
    LoadBearingItem,
    ResetResponse,
    ReverseResponse,
    TargetItem,
    ValidationError,
    Verdict,
    WhyResponse,
    WhoResponse,
    validate_action_depth,
)
from .tools import affected as affected_tool
from .tools import graph_snapshot, load_bearing, reverse, why, who
from .verdict import _resolve, check_action
from .db import query
from .queries import LIST_ARTIFACTS, LIST_DECISIONS


class Gatekeeper:
    """Small synchronous public API for the future FastAPI adapter.

    The FalkorDB client is shared and uses redis-py's connection pool. A fresh
    Graph wrapper is selected for each method call, avoiding mutable wrapper
    state while preserving pooled client connections across request threads.
    """

    def __init__(self, client: Any, graph_name: str):
        self.client = client
        self.graph_name = graph_name

    @classmethod
    def from_env(cls) -> "Gatekeeper":
        graph_name = os.getenv("FALKORDB_GRAPH", "gatekeeper")
        return cls(connect(), graph_name)

    def _graph(self):
        return select_graph(self.client, self.graph_name)

    @staticmethod
    def _validate_viewer(viewer: str) -> str:
        if not isinstance(viewer, str) or not viewer.strip():
            raise ValidationError("INVALID_VIEWER", "viewer must be a non-empty handle")
        return viewer.strip()

    def resolve_target(self, name: str) -> TargetItem:
        if not isinstance(name, str) or not name.strip():
            raise ValidationError("INVALID_TARGET_NAME", "target must be a non-empty graph id")
        resolved = _resolve(self._graph(), name)
        if resolved is None:
            raise ValidationError("UNKNOWN_TARGET_NAME", f"target {name!r} does not resolve in the graph")
        return TargetItem(**resolved)

    def list_targets(self) -> list[TargetItem]:
        rows = query(self._graph(), LIST_ARTIFACTS).result_set
        return [TargetItem(id=str(row[0]), kind=str(row[1]), name=str(row[2])) for row in rows]

    def list_decisions(self) -> list[DecisionItem]:
        rows = query(self._graph(), LIST_DECISIONS).result_set
        return [DecisionItem(id=str(row[0]), title=str(row[1]), status=str(row[2]), decided_at=str(row[3])) for row in rows]

    def check(self, target: str, action: str | Action, depth: int = 6, viewer: str = "anonymous") -> CheckResponse:
        parsed_action, parsed_depth = validate_action_depth(action, depth)
        viewer_handle = self._validate_viewer(viewer)
        if not isinstance(target, str) or not target.strip():
            raise ValidationError("INVALID_TARGET_NAME", "target must be a non-empty graph id")
        return check_action(self._graph(), target, parsed_action, parsed_depth, viewer=viewer_handle)

    def why(self, decision: str) -> WhyResponse:
        if not isinstance(decision, str) or not decision.strip():
            raise ValidationError("INVALID_DECISION_NAME", "decision must be a non-empty id")
        try:
            return why(self._graph(), decision)
        except ValueError as exc:
            raise ValidationError("UNKNOWN_DECISION_NAME", str(exc)) from exc

    def who(self, target: str) -> WhoResponse:
        self.resolve_target(target)
        try:
            return who(self._graph(), target)
        except ValueError as exc:
            raise ValidationError("UNKNOWN_TARGET_NAME", str(exc)) from exc

    def reverse(self, old: str, new_id: str, new_title: str, dry_run: bool = True) -> ReverseResponse:
        if not isinstance(old, str) or not old.strip():
            raise ValidationError("INVALID_DECISION_NAME", "old decision must be a non-empty id")
        if not isinstance(new_id, str) or not new_id.strip() or not isinstance(new_title, str) or not new_title.strip():
            raise ValidationError("INVALID_REVERSAL", "new_id and new_title are required")
        if not isinstance(dry_run, bool):
            raise ValidationError("INVALID_REVERSAL", "dry_run must be a boolean")
        try:
            return reverse(self._graph(), old, new_id.strip(), new_title.strip(), dry_run)
        except ValueError as exc:
            raise ValidationError("UNKNOWN_DECISION_NAME", str(exc)) from exc

    def affected(self, decision: str) -> AffectedResponse:
        try:
            return affected_tool(self._graph(), decision)
        except ValueError as exc:
            raise ValidationError("UNKNOWN_DECISION_NAME", str(exc)) from exc

    def load_bearing(self, limit: int = 10) -> list[LoadBearingItem]:
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 20:
            raise ValidationError("INVALID_LIMIT", "limit must be an integer from 1 through 20")
        return load_bearing(self._graph(), limit)

    def graph(self) -> GraphResponse:
        return graph_snapshot(self._graph())

    def audit(self) -> AuditReport:
        return audit_graph(self._graph())

    def reset(self) -> ResetResponse:
        graph = self._graph()
        seed_fixture(graph)
        return ResetResponse(reset=True, path=EvidencePath(nodes=[], edges=[]))
