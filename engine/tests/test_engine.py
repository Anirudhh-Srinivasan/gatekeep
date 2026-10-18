from __future__ import annotations

import pytest
from concurrent.futures import ThreadPoolExecutor

from gatekeeper_engine import Gatekeeper
from gatekeeper_engine.audit import audit, inject_faults
from gatekeeper_engine.db import connect
from gatekeeper_engine import verdict as verdict_module
from gatekeeper_engine.fixtures import graph_counts, seed_fixture
from gatekeeper_engine.models import Action, DecisionStatus, ValidationError, Verdict
from gatekeeper_engine.tools import affected, reverse
from gatekeeper_engine.verdict import check_action
from gatekeeper_engine.queries import RESET_GRAPH, SEED_EDGES, SEED_NODES


def cypher(graph, statement: str, params: dict | None = None):
    return graph.query(statement, params or {})


def test_no_governing_decision_is_ungoverned(graph):
    result = check_action(graph, "file:docs/readme.md", Action.DELETE)
    assert result.verdict == Verdict.UNGOVERNED
    assert "does not mean safe" in (result.note or "")
    assert result.path.nodes[0].id == "file:docs/readme.md"


def test_live_chain_escalates_with_owner_and_ordered_path(graph):
    result = check_action(graph, "file:compat/win7_shim.js", Action.DELETE)
    assert result.verdict == Verdict.ESCALATE
    assert result.owner is not None
    assert result.owner.team == "platform"
    assert result.owner.people == ["bob"]
    assert [node.id for node in result.path.nodes] == ["file:compat/win7_shim.js", "D2", "D5", "D6", "D1"]
    assert all(item.status == DecisionStatus.LIVE for item in result.live)


def test_depth_one_stays_shallow_and_full_depth_finds_dead_premise(graph):
    reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=False)
    shallow = check_action(graph, "file:compat/win7_shim.js", Action.DELETE, depth=1)
    full = check_action(graph, "file:compat/win7_shim.js", Action.DELETE, depth=3)
    assert shallow.verdict == Verdict.ESCALATE
    assert full.verdict == Verdict.STALE
    assert full.stale[0].dead_premises[0].id == "D1"
    assert full.stale[0].dead_premises[0].hops == 3
    assert full.stale[0].dead_premises[0].via == ["D2", "D5", "D6", "D1"]
    assert all(edge.provenance == "SYNTHETIC" for edge in full.path.edges)


def test_all_governance_dead_is_allow_with_history(graph):
    cypher(graph, "MATCH (d:Decision {id: 'D2'}) SET d.status = 'superseded'")
    result = check_action(graph, "file:compat/win7_shim.js", Action.DELETE)
    assert result.verdict == Verdict.ALLOW
    assert [item.decision for item in result.dead] == ["D2"]
    assert "D2" in (result.note or "")


def test_high_severity_prohibition_blocks(graph):
    result = check_action(graph, "package:moment", Action.ADD_DEPENDENCY)
    assert result.verdict == Verdict.BLOCK
    assert result.live[0].decision == "D8"
    assert result.live[0].severity == "high"


def test_other_action_is_ungoverned_with_note(graph):
    result = check_action(graph, "file:compat/win7_shim.js", Action.DEPLOY)
    assert result.verdict == Verdict.UNGOVERNED
    assert "other actions" in (result.note or "")


def test_known_check_records_answer_path_in_ledger(graph):
    before = graph_counts(graph)
    result = check_action(graph, "file:compat/win7_shim.js", Action.DELETE, viewer="alice")
    after = graph_counts(graph)
    assert result.answer_id.startswith("ans-")
    assert after["nodes"] == before["nodes"] + 1
    assert after["edges"] == before["edges"] + 5
    affected_result = affected(graph, "D1")
    rows = [row for row in affected_result.rows if row.answer_id == result.answer_id]
    assert len(rows) == 1
    assert "approval" in rows[0].summary
    assert rows[0].stale_decision == "D2"
    assert affected_result.path.nodes


def test_viewer_is_merged_and_unknown_target_can_be_recorded(graph):
    before = graph_counts(graph)
    result = check_action(graph, "file:missing/nope.js", Action.DELETE, viewer="demo-user")
    after = graph_counts(graph)
    assert result.verdict == Verdict.UNKNOWN_TARGET
    assert after["nodes"] == before["nodes"] + 2
    assert after["edges"] == before["edges"] + 1
    person = graph.query("MATCH (p:Person {handle: 'demo-user'}) RETURN p.handle").result_set
    assert person == [["demo-user"]]


def test_diamond_dependency_deduplicates_dead_premise(graph):
    cypher(graph, """
    CREATE
      (d9:Decision {id: 'D9', title: 'Readme review', status: 'live', decided_at: '2026-01-01'}),
      (d10:Decision {id: 'D10', title: 'Path one', status: 'live', decided_at: '2026-01-01'}),
      (d11:Decision {id: 'D11', title: 'Path two', status: 'live', decided_at: '2026-01-01'}),
      (d12:Decision {id: 'D12', title: 'Dead shared premise', status: 'superseded', decided_at: '2026-01-01'})
    WITH d9, d10, d11, d12
    MATCH (readme:Artifact {id: 'file:docs/readme.md'})
    CREATE
      (d9)-[:DEPENDS_ON]->(d10), (d9)-[:DEPENDS_ON]->(d11),
      (d10)-[:DEPENDS_ON]->(d12), (d11)-[:DEPENDS_ON]->(d12),
      (d9)-[:GOVERNS {constraint: 'requires_approval', actions: 'delete', severity: 'normal'}]->(readme)
    """)
    result = check_action(graph, "file:docs/readme.md", Action.DELETE)
    assert result.verdict == Verdict.STALE
    assert len(result.stale) == 1
    assert [item.id for item in result.stale[0].dead_premises] == ["D12"]


@pytest.mark.timeout(5)
def test_cycle_terminates(graph):
    cypher(graph, """
    CREATE
      (d13:Decision {id: 'D13', title: 'Cycle owner', status: 'live', decided_at: '2026-01-01'}),
      (d14:Decision {id: 'D14', title: 'Cycle A', status: 'live', decided_at: '2026-01-01'}),
      (d15:Decision {id: 'D15', title: 'Cycle B', status: 'live', decided_at: '2026-01-01'})
    WITH d13, d14, d15
    MATCH (readme:Artifact {id: 'file:docs/readme.md'})
    CREATE
      (d13)-[:DEPENDS_ON]->(d14), (d14)-[:DEPENDS_ON]->(d15), (d15)-[:DEPENDS_ON]->(d14),
      (d13)-[:GOVERNS {constraint: 'requires_approval', actions: 'delete', severity: 'normal'}]->(readme)
    """)
    result = check_action(graph, "file:docs/readme.md", Action.DELETE)
    assert result.verdict == Verdict.ESCALATE
    assert len(result.path.nodes) < 8


def test_unknown_target_runs_only_resolve_query(graph, monkeypatch):
    original = verdict_module.query
    calls: list[str] = []

    def spy(selected_graph, statement, params=None):
        calls.append(statement)
        return original(selected_graph, statement, params)

    monkeypatch.setattr(verdict_module, "query", spy)
    result = check_action(graph, "file:missing/nope.js", Action.DELETE)
    assert result.verdict == Verdict.UNKNOWN_TARGET
    assert len(calls) == 1


def test_governance_inherits_from_grandparent(graph):
    cypher(graph, """
    CREATE (d16:Decision {id: 'D16', title: 'Repo deletion review', status: 'live', decided_at: '2026-01-01'})
    WITH d16
    MATCH (repo:Artifact {id: 'repo:app'})
    CREATE (d16)-[:GOVERNS {constraint: 'requires_approval', actions: 'delete', severity: 'normal'}]->(repo)
    """)
    result = check_action(graph, "file:compat/win7_shim.js", Action.DELETE)
    assert result.verdict == Verdict.ESCALATE
    assert "D16" in [item.decision for item in result.live]


def test_reverse_dry_run_writes_nothing_commit_is_idempotent(graph):
    before = graph_counts(graph)
    preview = reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=True)
    assert preview.committed is False
    assert [(item.person, item.answer_id, item.stale_decision) for item in preview.affected_people] == [
        ("alice", "ans-021", "D2"), ("carol", "ans-034", "D2")
    ]
    assert graph_counts(graph) == before
    committed = reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=False)
    assert committed.committed is True
    committed_again = reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=False)
    assert committed_again.committed is True
    assert graph_counts(graph)["nodes"] == before["nodes"] + 1
    assert check_action(graph, "file:compat/win7_shim.js", Action.DELETE, depth=3).verdict == Verdict.STALE
    assert [row.person for row in affected(graph, "D1").rows] == ["alice", "carol"]


def test_reverse_graph_preview_works_without_ledger_and_matches_commit(graph):
    graph.query(RESET_GRAPH)
    graph.query(SEED_NODES)
    graph.query(SEED_EDGES)
    before = graph_counts(graph)
    preview = reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=True)
    delete_flip = next(item for item in preview.flips if item.target == "file:compat/win7_shim.js" and item.action == Action.DELETE)
    assert delete_flip.from_verdict == Verdict.ESCALATE
    assert delete_flip.to_verdict == Verdict.STALE
    assert preview.affected_people == []
    assert graph_counts(graph) == before
    reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=False)
    actual = check_action(graph, "file:compat/win7_shim.js", Action.DELETE, depth=6)
    assert actual.verdict == delete_flip.to_verdict


def test_audit_clean_and_faults(graph):
    clean = audit(graph)
    assert not any(item.type in {"cycle", "consistency", "duplicate_supersession", "zombie", "stale_governing"} for item in clean.findings)
    assert clean.counts.get("orphan_artifact") == 1
    report = inject_faults(graph.client, 5)
    assert report.requested == 5
    assert report.detected == report.injected
    assert report.detection_rate == 1.0


def test_gatekeeper_public_contract_and_validation(graph):
    api = Gatekeeper(graph.client, graph._name)
    check = api.check("file:compat/win7_shim.js", "delete", viewer="contract-user").model_dump(mode="json")
    assert set(["verdict", "target", "action", "depth", "owner", "live", "stale", "dead", "info", "path", "answer_id"]).issubset(check)
    assert check["verdict"] in {"BLOCK", "ESCALATE", "STALE", "ALLOW", "UNGOVERNED", "UNKNOWN_TARGET"}
    assert api.resolve_target("file:compat/win7_shim.js").id == "file:compat/win7_shim.js"
    assert len(api.list_targets()) == 5
    assert len(api.list_decisions()) >= 5
    assert api.why("D2").model_dump(mode="json")["sources"][0]["title"] == "Compatibility module ownership"
    assert api.who("file:compat/win7_shim.js").owners[0].team == "platform"
    assert api.affected("D1").model_dump(mode="json")["path"]["nodes"]
    assert api.reverse("D1", "D4", "Drop Windows 7 support", dry_run=True).model_dump(mode="json")["flips"]
    assert api.load_bearing(10)
    assert api.graph().nodes
    assert api.audit().total >= 1
    assert api.reset().reset is True
    with pytest.raises(ValidationError) as invalid:
        api.check("file:compat/win7_shim.js", "bad-action")
    assert invalid.value.code == "INVALID_ACTION"
    with pytest.raises(ValidationError) as unknown:
        api.resolve_target("file:missing/nope.js")
    assert unknown.value.code == "UNKNOWN_TARGET_NAME"


def test_reset_without_data_loader_keeps_fixture(graph, monkeypatch):
    monkeypatch.delenv("GATEKEEPER_DATA_PATH", raising=False)
    monkeypatch.delenv("GATEKEEPER_LOAD_REAL", raising=False)
    result = Gatekeeper(graph.client, graph._name).reset(include_real=False)
    assert result.fixture_counts == {"nodes": 21, "edges": 26}
    assert result.real_counts is None
    assert result.info is None


def test_reset_loads_fake_real_data_loader(graph, tmp_path, monkeypatch):
    package = tmp_path / "gatekeeper_data"
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "loader.py").write_text(
        "def load_real_data(graph):\n"
        "    return {'nodes': 3, 'edges': 4}\n"
    )
    monkeypatch.setenv("GATEKEEPER_DATA_PATH", str(tmp_path))
    monkeypatch.setenv("GATEKEEPER_LOAD_REAL", "1")
    import sys
    sys.modules.pop("gatekeeper_data.loader", None)
    sys.modules.pop("gatekeeper_data", None)
    result = Gatekeeper(graph.client, graph._name).reset()
    assert result.real_counts == {"nodes": 3, "edges": 4}


def test_reset_loader_failure_restores_clean_fixture(graph, tmp_path, monkeypatch):
    package = tmp_path / "gatekeeper_data"
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "loader.py").write_text(
        "from gatekeeper_engine.db import query\n"
        "def load_real_data(graph):\n"
        "    query(graph, \"CREATE (:Artifact {id: 'partial'})\")\n"
        "    raise RuntimeError('loader boom')\n"
    )
    monkeypatch.setenv("GATEKEEPER_DATA_PATH", str(tmp_path))
    monkeypatch.setenv("GATEKEEPER_LOAD_REAL", "1")
    import sys
    sys.modules.pop("gatekeeper_data.loader", None)
    sys.modules.pop("gatekeeper_data", None)
    result = Gatekeeper(graph.client, graph._name).reset()
    assert result.error == "real-data loader failed: loader boom"
    assert result.fixture_counts == {"nodes": 21, "edges": 26}


def test_shared_client_concurrent_checks_are_isolated(graph):
    api = Gatekeeper(graph.client, graph._name)
    def run(index: int):
        return api.check("file:compat/win7_shim.js", "delete", viewer=f"thread-{index}").verdict
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(run, range(24)))
    assert results == [Verdict.ESCALATE] * 24


def test_fixture_seed_is_idempotent_in_counts(graph):
    first = graph_counts(graph)
    seed_fixture(graph)
    second = graph_counts(graph)
    assert first == second == {"nodes": 21, "edges": 26}


@pytest.mark.parametrize("action", ["not_an_action", "", "DELETE"])
def test_invalid_action_rejected_before_query(graph, action, monkeypatch):
    def fail(*_args, **_kwargs):
        raise AssertionError("database query should not run")

    monkeypatch.setattr(verdict_module, "query", fail)
    with pytest.raises(ValueError):
        check_action(graph, "file:compat/win7_shim.js", action, depth=6)


@pytest.mark.parametrize("depth", [0, 7, -1, 1.0, True, "4"])
def test_invalid_depth_rejected_before_query(graph, depth, monkeypatch):
    def fail(*_args, **_kwargs):
        raise AssertionError("database query should not run")

    monkeypatch.setattr(verdict_module, "query", fail)
    with pytest.raises(ValueError):
        check_action(graph, "file:compat/win7_shim.js", Action.DELETE, depth=depth)
