from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import uuid4

from .db import drop_graph, query, select_graph
from .fixtures import seed_fixture
from .models import AuditFinding, AuditReport, DecisionStatus, EvidencePath, FaultReport, PathNode
from .queries import (
    CYCLE_AUDIT,
    DUPLICATE_SUPERSEDERS_AUDIT,
    FAULT_CONSISTENCY,
    FAULT_CYCLE,
    FAULT_DUPLICATE_SUPERSESSION,
    FAULT_ORPHANS,
    FAULT_ZOMBIE,
    GOVERNING_DECISION_IDS,
    LIVE_INCOMING_SUPERSEDES_AUDIT,
    ORPHAN_ARTIFACTS_AUDIT,
    ORPHAN_DECISIONS_AUDIT,
    ZOMBIE_AUDIT,
)
from .verdict import check_action


def _path(ids: list[str]) -> EvidencePath:
    return EvidencePath(nodes=[PathNode(id=item, label=item, type="Artifact" if ":" in item and not item.startswith("D") else "Decision") for item in dict.fromkeys(ids)], edges=[])


def _finding(kind: str, ids: list[str], explanation: str) -> AuditFinding:
    return AuditFinding(type=kind, ids=list(dict.fromkeys(ids)), explanation=explanation, path=_path(ids))


def audit(graph: Any) -> AuditReport:
    findings: list[AuditFinding] = []
    cycle_rows = query(graph, CYCLE_AUDIT).result_set
    for row in cycle_rows:
        findings.append(_finding("cycle", [str(row[0])], f"{row[0]} participates in a DEPENDS_ON cycle of at least {row[1]} hops."))

    zombie_groups: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for row in query(graph, ZOMBIE_AUDIT).result_set:
        zombie_groups[str(row[0])].append((str(row[1]), str(row[2])))
    for decision, premises in sorted(zombie_groups.items()):
        if premises and all(status != DecisionStatus.LIVE.value for _, status in premises):
            findings.append(_finding("zombie", [decision, *[item[0] for item in premises]], f"{decision} is marked live but every reachable premise found by the bounded audit is dead."))

    for row in query(graph, LIVE_INCOMING_SUPERSEDES_AUDIT).result_set:
        findings.append(_finding("consistency", [str(row[0]), str(row[1])], f"live decision {row[1]} supersedes live decision {row[0]}; stored status and supersession edge disagree."))

    for row in query(graph, DUPLICATE_SUPERSEDERS_AUDIT).result_set:
        superseders = [str(item) for item in (row[1] or [])]
        findings.append(_finding("duplicate_supersession", [str(row[0]), *superseders], f"{row[0]} has {len(superseders)} live superseding decisions."))

    for row in query(graph, ORPHAN_DECISIONS_AUDIT).result_set:
        findings.append(_finding("orphan_decision", [str(row[0])], f"decision {row[0]} has no recorded governance, dependency, supersession, source, or decider edge."))
    for row in query(graph, ORPHAN_ARTIFACTS_AUDIT).result_set:
        findings.append(_finding("orphan_artifact", [str(row[0])], f"artifact {row[0]} has no hierarchy or incoming GOVERNS edge; this may be a legitimate root or a data gap."))

    governing_rows = query(graph, GOVERNING_DECISION_IDS).result_set
    for row in governing_rows:
        decision, scope = str(row[0]), str(row[1])
        actions = ["delete", "modify", "add_dependency", "remove_dependency", "deploy"] if str(row[2]) == "*" else [item for item in str(row[2] or "").split(",") if item]
        for action in actions:
            result = check_action(graph, scope, action, 6)
            stale = next((item for item in result.stale if item.decision == decision), None)
            if stale:
                premise_ids = [item.id for item in stale.dead_premises]
                findings.append(_finding("stale_governing", [decision, scope, *premise_ids], f"live governing decision {decision} produces STALE for {scope} / {action}."))

    findings.sort(key=lambda item: (item.type, item.ids))
    counts: dict[str, int] = defaultdict(int)
    for finding in findings:
        counts[finding.type] += 1
    return AuditReport(findings=findings, counts=dict(sorted(counts.items())), total=len(findings))


def inject_faults(client: Any, count: int = 5) -> FaultReport:
    if not isinstance(count, int) or isinstance(count, bool) or not 0 <= count <= 5:
        raise ValueError("count must be an integer from 0 through 5")
    graph_name = f"gatekeeper_faults_{uuid4().hex}"
    graph = select_graph(client, graph_name)
    fault_names = ["cycle", "zombie", "consistency", "duplicate_supersession", "orphans"][:count]
    try:
        seed_fixture(graph)
        if "cycle" in fault_names:
            query(graph, FAULT_CYCLE)
        if "zombie" in fault_names:
            query(graph, FAULT_ZOMBIE, {"id": "F-ZOMBIE", "premise": "F-DEAD"})
        if "consistency" in fault_names:
            query(graph, FAULT_CONSISTENCY)
        if "duplicate_supersession" in fault_names:
            query(graph, FAULT_DUPLICATE_SUPERSESSION, {"id_a": "F-SUPER-A", "id_b": "F-SUPER-B"})
        if "orphans" in fault_names:
            query(graph, FAULT_ORPHANS, {"decision": "F-ORPHAN-D", "artifact": "file:orphan.txt"})
        report = audit(graph)
        detected_types = {finding.type for finding in report.findings}
        detected = [fault for fault in fault_names if fault in detected_types or (fault == "orphans" and {"orphan_decision", "orphan_artifact"} & detected_types)]
        return FaultReport(requested=count, injected=fault_names, detected=detected, detection_rate=(len(detected) / len(fault_names) if fault_names else 1.0))
    finally:
        drop_graph(client, graph_name)
