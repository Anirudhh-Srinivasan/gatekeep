from __future__ import annotations

from datetime import date
from typing import Any

from .db import query
from .ledger import affected as affected_rows
from .models import (
    Action,
    AffectedPerson,
    DecisionStatus,
    EvidencePath,
    Flip,
    GraphEdge,
    GraphNode,
    GraphResponse,
    LoadBearingItem,
    PathEdge,
    PathNode,
    ReverseResponse,
    Source,
    AffectedResponse,
    LedgerRow,
    AuditFinding,
    AuditReport,
    FaultReport,
    ResetResponse,
    TargetItem,
    DecisionItem,
    WhoResponse,
    WhyResponse,
)
from .queries import (
    DECISION_BY_ID,
    DECISION_DEPENDENCIES,
    AFFECTED_DECISIONS,
    AFFECTED_ANSWERS,
    LEDGER_FOR_DECISION,
    PAGERANK,
    REVERSE_COMMIT,
    REVERSAL_GOVERNANCE_PAIRS,
    WHY_SOURCES,
    GRAPH_EDGES,
    GRAPH_NODES,
)
from .verdict import _owner, _resolve, check_action


def _single_decision(graph: Any, decision: str) -> list[Any]:
    rows = list(query(graph, DECISION_BY_ID, {"decision": decision}).result_set)
    if not rows:
        raise ValueError(f"decision {decision!r} does not resolve in the graph")
    return rows[0]


def _decision_premise_chain(graph: Any, decision: str) -> list[dict[str, str]]:
    chain: list[dict[str, str]] = []
    current = decision
    seen: set[str] = set()
    for _ in range(6):
        if current in seen:
            break
        seen.add(current)
        rows = list(query(graph, DECISION_DEPENDENCIES, {"decision": current}).result_set)
        if not rows:
            break
        row = rows[0]
        chain.append({"id": str(row[0]), "title": str(row[1]), "status": str(row[2])})
        current = str(row[0])
    return chain


def why(graph: Any, decision: str) -> WhyResponse:
    _single_decision(graph, decision)
    rows = list(query(graph, WHY_SOURCES, {"decision": decision}).result_set)
    row = rows[0]
    source_values: list[Source] = []
    for value in row[4] or []:
        if not value or not value.get("id"):
            continue
        source_type = str(value.get("type", "doc")).lower()
        if source_type not in {"doc", "ticket", "thread"}:
            source_type = "doc"
        source_values.append(Source(
            type=source_type, id=str(value["id"]), url=str(value.get("url") or ""),
            title=str(value.get("title") or value.get("id") or ""), tag=str(value.get("provenance") or "SYNTHETIC"),
        ))
    source_nodes = [PathNode(id=item.id, label=item.title, type=item.type.title()) for item in source_values]
    decision_row = _single_decision(graph, decision)
    decision_node = PathNode(id=decision, label=str(decision_row[1]), type="Decision", status=DecisionStatus(str(decision_row[2])))
    people = [str(person) for person in (row[5] or []) if person]
    nodes = [*source_nodes, decision_node, *[PathNode(id=person, label=person, type="Person") for person in people]]
    edges = [PathEdge(id=f"{item.id}-source-{decision}", source=item.id, target=decision, type="SOURCED_FROM", provenance=item.tag) for item in source_values]
    edges.extend(PathEdge(id=f"{decision}-by-{person}", source=decision, target=person, type="DECIDED_BY", provenance="SYNTHETIC") for person in people)
    return WhyResponse(
        id=str(row[0]), title=str(row[1]), status=DecisionStatus(str(row[2])), decided_at=str(row[3]),
        sources=source_values, decided_by=people, supersedes=[str(item) for item in (row[6] or []) if item],
        premises=_decision_premise_chain(graph, decision),
        path=EvidencePath(nodes=nodes, edges=edges),
    )


def who(graph: Any, target: str) -> WhoResponse:
    if _resolve(graph, target) is None:
        raise ValueError(f"target {target!r} does not resolve in the graph")
    owner = _owner(graph, target)
    nodes: list[PathNode] = [PathNode(id=target, label=target, type="Artifact")]
    edges: list[PathEdge] = []
    if owner:
        nodes.extend([PathNode(id=owner.team, label=owner.team, type="Team"), *[PathNode(id=person, label=person, type="Person") for person in owner.people]])
        edges.append(PathEdge(id=f"{owner.team}-owns-{target}", source=owner.team, target=target, type="OWNS"))
        edges.extend(PathEdge(id=f"{person}-member-{owner.team}", source=person, target=owner.team, type="MEMBER_OF") for person in owner.people)
    return WhoResponse(target=target, owners=[owner] if owner else [], path=EvidencePath(nodes=nodes if owner else [], edges=edges))


def _ledger_context(graph: Any, decision: str) -> list[dict[str, str]]:
    rows = query(graph, LEDGER_FOR_DECISION, {"decision": decision}).result_set
    return [
        {
            "person": str(row[0]), "answer_id": str(row[1]), "at": str(row[2]), "summary": str(row[3]),
            "answer": str(row[4] or ""), "target": str(row[5] or ""), "action": str(row[6] or ""),
        }
        for row in rows
    ]


def reverse(graph: Any, old: str, new_id: str, new_title: str, dry_run: bool) -> ReverseResponse:
    if not new_id.strip() or not new_title.strip():
        raise ValueError("new_id and new_title are required")
    if old == new_id:
        raise ValueError("new_id must differ from old")
    old_row = _single_decision(graph, old)
    affected = _ledger_context(graph, old)
    flips: list[Flip] = []
    governance_rows = list(query(graph, REVERSAL_GOVERNANCE_PAIRS, {"decision": old}).result_set)
    seen_flips: set[tuple[str, str, str]] = set()
    for row in governance_rows:
        target, action, decision_id = str(row[2]), str(row[3]), str(row[0])
        before = check_action(graph, target, action, 6)
        after = check_action(graph, target, action, 6, overrides=[old])
        if before.verdict != after.verdict:
            flip_key = (target, action, decision_id)
            if flip_key not in seen_flips:
                seen_flips.add(flip_key)
                flips.append(Flip(target=target, action=Action(action), decision=decision_id, from_verdict=before.verdict, to_verdict=after.verdict, path=after.path))
    if not dry_run:
        query(graph, REVERSE_COMMIT, {"old": old, "new_id": new_id, "new_title": new_title, "decided_at": date.today().isoformat()})
    old_status = DecisionStatus(str(old_row[2]))
    path = EvidencePath(
        nodes=[PathNode(id=old, label=str(old_row[1]), type="Decision", status=old_status), PathNode(id=new_id, label=new_title, type="Decision", status=DecisionStatus.LIVE)],
        edges=[PathEdge(id=f"{new_id}-supersedes-{old}", source=new_id, target=old, type="SUPERSEDES")],
    )
    return ReverseResponse(
        flips=flips,
        affected_people=[AffectedPerson(person=item["person"], answer=item["answer"], answer_id=item["answer_id"], at=item["at"], summary=item["summary"], stale_decision=flips[0].decision if flips else old) for item in affected],
        committed=not dry_run,
        path=path,
    )


def affected(graph: Any, decision: str) -> AffectedResponse:
    _single_decision(graph, decision)
    rows = affected_rows(graph, decision)
    dependent_rows = list(query(graph, AFFECTED_DECISIONS, {"decision": decision}).result_set)
    decision_ids = [decision, *[str(row[0]) for row in dependent_rows]]
    answer_rows = list(query(graph, AFFECTED_ANSWERS, {"decision_ids": list(dict.fromkeys(decision_ids))}).result_set)
    old_row = _single_decision(graph, decision)
    nodes: dict[str, PathNode] = {decision: PathNode(id=decision, label=str(old_row[1]), type="Decision", status=DecisionStatus(str(old_row[2])))}
    edges: dict[str, PathEdge] = {}
    for row in dependent_rows:
        dependent_id = str(row[0])
        nodes[dependent_id] = PathNode(id=dependent_id, label=str(row[1]), type="Decision", status=DecisionStatus(str(row[2])))
        via = [str(item) for item in (row[4] or [])]
        for source, target in zip(via, via[1:]):
            edge_id = f"{source}-depends-{target}"
            edges[edge_id] = PathEdge(id=edge_id, source=source, target=target, type="DEPENDS_ON", provenance="SYNTHETIC")
    for row in answer_rows:
        answer_id, used_decision, person = str(row[0]), str(row[1]), str(row[2])
        nodes[answer_id] = PathNode(id=answer_id, label=answer_id, type="Answer", meta="ledger")
        nodes[person] = PathNode(id=person, label=person, type="Person")
        used_edge = f"{answer_id}-used-{used_decision}"
        asked_edge = f"{answer_id}-asked-{person}"
        edges[used_edge] = PathEdge(id=used_edge, source=answer_id, target=used_decision, type="USED_IN", provenance="SYNTHETIC")
        edges[asked_edge] = PathEdge(id=asked_edge, source=answer_id, target=person, type="ASKED_BY", provenance="SYNTHETIC")
    path = EvidencePath(nodes=list(nodes.values()), edges=list(edges.values()))
    return AffectedResponse(decision=decision, rows=rows, path=path)


def load_bearing(graph: Any, limit: int = 5) -> list[LoadBearingItem]:
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 20:
        raise ValueError("limit must be an integer from 1 through 20")
    try:
        rows = query(graph, PAGERANK, {"limit": limit}).result_set
    except Exception:
        return []
    return [LoadBearingItem(id=str(row[0]), title=str(row[1]), score=float(row[2])) for row in rows]


def graph_snapshot(graph: Any) -> GraphResponse:
    nodes = sorted((GraphNode(**dict(row[0])) for row in query(graph, GRAPH_NODES).result_set), key=lambda item: item.id)
    edges = sorted((GraphEdge(**dict(row[0])) for row in query(graph, GRAPH_EDGES).result_set), key=lambda item: item.id)
    return GraphResponse(nodes=nodes, edges=edges)
