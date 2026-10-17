from __future__ import annotations

from collections import deque
from typing import Any

from .db import query
from .ledger import record_answer
from .models import (
    Action,
    CheckResponse,
    Constraint,
    DecisionRef,
    DecisionStatus,
    EvidencePath,
    Owner,
    PathEdge,
    PathNode,
    Premise,
    Severity,
    StaleDecision,
    ValidationError,
    Verdict,
    validate_action_depth,
)
from .queries import (
    ARTIFACT_HIERARCHY,
    DECISION_DEPENDENCIES,
    DECISIONS_BY_IDS,
    GOVERNING_DECISIONS,
    OWNER_HIERARCHY,
    RESOLVE_ARTIFACT,
    dead_premises_query,
    dead_premises_with_overrides_query,
)


def _rows(response: Any) -> list[list[Any]]:
    return list(response.result_set)


def _resolve(graph: Any, target: str) -> dict[str, str] | None:
    rows = _rows(query(graph, RESOLVE_ARTIFACT, {"target": target}))
    if not rows:
        return None
    return {"id": str(rows[0][0]), "kind": str(rows[0][1]), "name": str(rows[0][2])}


def _artifact_scopes(graph: Any, target: str) -> list[str]:
    rows = _rows(query(graph, ARTIFACT_HIERARCHY, {"target": target}))
    scopes = [str(target)]
    for row in rows:
        parent_path = row[3] or []
        scopes.extend(str(item) for item in parent_path)
    return list(dict.fromkeys(scopes))


def _decision_ref(row: list[Any]) -> DecisionRef:
    return DecisionRef(
        decision=str(row[0]),
        title=str(row[1]),
        status=DecisionStatus(str(row[2])),
        constraint=Constraint(str(row[4] or "informational")),
        severity=Severity(str(row[6] or "normal")),
        scope=str(row[7]),
    )


def _owner(graph: Any, target: str) -> Owner | None:
    rows = _rows(query(graph, OWNER_HIERARCHY, {"target": target}))
    owners: list[Owner] = []
    for row in rows:
        if row[1]:
            owners.append(Owner(team=str(row[1]), people=[str(person) for person in (row[2] or []) if person]))
    return owners[0] if owners else None


def _dead_premises(graph: Any, decision: str, depth: int, overrides: list[str] | None = None) -> list[Premise]:
    overrides = overrides or []
    if overrides:
        rows = _rows(query(graph, dead_premises_with_overrides_query(depth), {"decision": decision, "overrides": list(overrides)}))
    else:
        rows = _rows(query(graph, dead_premises_query(depth), {"decision": decision}))
    return [Premise(id=str(row[0]), title=str(row[1]), status=DecisionStatus.SUPERSEDED if str(row[0]) in overrides else DecisionStatus(str(row[2])), hops=int(row[3]), via=[str(item) for item in row[4]]) for row in rows]


def _validate_overrides(graph: Any, overrides: list[str] | None) -> list[str]:
    if overrides is None:
        return []
    if not isinstance(overrides, list) or any(not isinstance(item, str) or not item.strip() for item in overrides):
        raise ValidationError("INVALID_OVERRIDES", "overrides must be a list of non-empty decision id strings")
    ids = list(dict.fromkeys(overrides))
    known = {str(row[0]) for row in _rows(query(graph, DECISIONS_BY_IDS, {"ids": ids}))}
    if known != set(ids):
        missing = sorted(set(ids) - known)
        raise ValidationError("UNKNOWN_DECISION_NAME", f"override decisions do not resolve: {', '.join(missing)}")
    return ids


def _decision_rows(graph: Any, ids: set[str]) -> dict[str, list[Any]]:
    if not ids:
        return {}
    # IDs are never interpolated. This query is only used for labels/statuses after
    # the fixed governance query has returned validated graph IDs.
    response = query(graph, DECISIONS_BY_IDS, {"ids": list(ids)})
    return {str(row[0]): row for row in response.result_set}


def _evidence_path(graph: Any, target: str, refs: list[DecisionRef], stale: list[StaleDecision], depth: int, governance_provenance: dict[str, str] | None = None) -> EvidencePath:
    nodes: dict[str, PathNode] = {
        target: PathNode(id=target, label=target.split(":", 1)[-1], type="Artifact", meta=target),
    }
    edges: dict[str, PathEdge] = {}
    all_ids = [ref.decision for ref in [*refs, *stale]]
    decision_rows = _decision_rows(graph, set(all_ids) | {premise.id for item in stale for premise in item.dead_premises})
    for ref in [*refs, *stale]:
        queue: deque[tuple[str, int, list[str]]] = deque([(ref.decision, 0, [ref.decision])])
        seen: set[str] = set()
        while queue:
            current, hops, via = queue.popleft()
            if current in seen or hops > depth:
                continue
            seen.add(current)
            row = decision_rows.get(current)
            if row:
                status = DecisionStatus(str(row[2]))
                nodes[current] = PathNode(id=current, label=str(row[1]), type="Decision", status=status, meta=str(row[3]))
            if hops == 0:
                edge_id = f"{target}-governs-{current}"
                edges[edge_id] = PathEdge(id=edge_id, source=target, target=current, type="GOVERNS", provenance=(governance_provenance or {}).get(current, "SYNTHETIC"))
            dependency_rows = _rows(query(graph, DECISION_DEPENDENCIES, {"decision": current}))
            for dependency in dependency_rows:
                premise_id = str(dependency[0])
                nodes[premise_id] = PathNode(
                    id=premise_id,
                    label=str(dependency[1]),
                    type="Decision",
                    status=DecisionStatus(str(dependency[2])),
                    meta=str(dependency[3]),
                )
                edge_id = f"{current}-depends-{premise_id}"
                edges[edge_id] = PathEdge(id=edge_id, source=current, target=premise_id, type="DEPENDS_ON", provenance=str(dependency[4] or "SYNTHETIC"))
                queue.append((premise_id, hops + 1, [*via, premise_id]))
    ordered_ids = [target]
    for ref in [*refs, *stale]:
        queue = deque([ref.decision])
        local_seen: set[str] = set()
        while queue:
            current = queue.popleft()
            if current in local_seen or current not in nodes:
                continue
            local_seen.add(current)
            ordered_ids.append(current)
            dependency_rows = _rows(query(graph, DECISION_DEPENDENCIES, {"decision": current}))
            queue.extend(str(row[0]) for row in dependency_rows)
    return EvidencePath(nodes=[nodes[node_id] for node_id in dict.fromkeys(ordered_ids) if node_id in nodes], edges=list(edges.values()))


def check_action(
    graph: Any,
    target: str,
    action: str | Action,
    depth: int = 6,
    *,
    viewer: str | None = None,
    overrides: list[str] | None = None,
) -> CheckResponse:
    parsed_action, parsed_depth = validate_action_depth(action, depth)
    resolved = _resolve(graph, target)
    if resolved is None:
        answer_id = f"unknown-{target}"
        if viewer is not None:
            answer_id = record_answer(graph, viewer=viewer or "anonymous", decision_ids=[], summary="This target does not resolve in the graph.", target=target, action=parsed_action.value, verdict=Verdict.UNKNOWN_TARGET.value)
        response = CheckResponse(
            verdict=Verdict.UNKNOWN_TARGET, target=target, action=parsed_action, depth=parsed_depth, owner=None,
            live=[], stale=[], dead=[], info=[], path=EvidencePath(nodes=[PathNode(id=target, label=target, type="Artifact")], edges=[]),
            note="This target does not resolve in the graph. Gatekeeper will not guess.", answer_id=answer_id,
        )
        return response
    override_ids = _validate_overrides(graph, overrides)

    scopes = _artifact_scopes(graph, target)
    rows = [row for row in _rows(query(graph, GOVERNING_DECISIONS, {"target": target})) if str(row[7]) in scopes]
    applicable = []
    for row in rows:
        actions = str(row[5] or "").split(",")
        if "*" in actions or parsed_action.value in actions:
            applicable.append(row)
    live: list[DecisionRef] = []
    stale: list[StaleDecision] = []
    dead: list[DecisionRef] = []
    info: list[DecisionRef] = []
    provenance: dict[str, str] = {}
    for row in applicable:
        ref = _decision_ref(row)
        provenance[ref.decision] = str(row[8] or "SYNTHETIC")
        if ref.decision in override_ids:
            ref = DecisionRef(**{**ref.model_dump(), "status": DecisionStatus.SUPERSEDED})
        if ref.status != DecisionStatus.LIVE:
            dead.append(ref)
            continue
        premises = _dead_premises(graph, ref.decision, parsed_depth, override_ids)
        if premises:
            stale.append(StaleDecision(**ref.model_dump(), dead_premises=premises))
        elif ref.constraint == Constraint.INFORMATIONAL:
            info.append(ref)
        else:
            live.append(ref)

    if any(item.constraint == Constraint.PROHIBITS and item.severity == Severity.HIGH for item in live):
        verdict = Verdict.BLOCK
        note = "A live high-severity prohibition covers this action."
    elif live:
        verdict = Verdict.ESCALATE
        note = "A live decision requires approval from the recorded owner."
    elif stale:
        verdict = Verdict.STALE
        note = "The reason for this rule expired; confirm with the owner."
    elif dead or info:
        verdict = Verdict.ALLOW
        history = ", ".join(item.decision for item in dead) or "informational decisions"
        note = f"Previously governed by {history}; those constraints are not live."
    else:
        verdict = Verdict.UNGOVERNED
        note = "Nothing recorded covers this action; that does not mean safe."
        if rows:
            note += " The target is governed for other actions, not this one."

    refs_for_path = [*live, *dead, *info]
    response = CheckResponse(
        verdict=verdict,
        target=target,
        action=parsed_action,
        depth=parsed_depth,
        owner=_owner(graph, target),
        live=live,
        stale=stale,
        dead=dead,
        info=info,
        path=_evidence_path(graph, target, refs_for_path, stale, parsed_depth, provenance),
        note=note,
        answer_id="",
    )
    if viewer:
        response.answer_id = record_answer(
            graph,
            viewer=viewer,
            decision_ids=[node.id for node in response.path.nodes if node.type == "Decision"],
            summary=note,
            target=target,
            action=parsed_action.value,
            verdict=verdict.value,
        )
    return response
