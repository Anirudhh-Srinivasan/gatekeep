from __future__ import annotations

import json
from pathlib import Path

from gatekeeper_engine.db import connect, select_graph
from gatekeeper_engine.audit import audit
from gatekeeper_engine.fixtures import seed_fixture
from gatekeeper_engine.tools import affected, graph_snapshot, reverse, who, why
from gatekeeper_engine.verdict import check_action


ROOT = Path(__file__).resolve().parent
EXAMPLES = ROOT / "examples"


def write(name: str, value) -> None:
    (EXAMPLES / name).write_text(json.dumps(value.model_dump(mode="json"), indent=2, sort_keys=True) + "\n")


def main() -> None:
    EXAMPLES.mkdir(exist_ok=True)
    graph = select_graph(connect(), "gatekeeper_examples")

    seed_fixture(graph)
    write("check_escalate.json", check_action(graph, "file:compat/win7_shim.js", "delete", 6))

    seed_fixture(graph)
    reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=False)
    write("check_stale_after_reverse.json", check_action(graph, "file:compat/win7_shim.js", "delete", 4))
    write("check_shallow_escalate.json", check_action(graph, "file:compat/win7_shim.js", "delete", 1))

    seed_fixture(graph)
    write("check_block.json", check_action(graph, "package:moment", "add_dependency", 6))
    write("check_ungoverned.json", check_action(graph, "file:docs/readme.md", "delete", 6))
    write("check_unknown_target.json", check_action(graph, "file:missing/nope.js", "delete", 6))
    write("why_D2.json", why(graph, "D2"))
    write("who_shim.json", who(graph, "file:compat/win7_shim.js"))
    write("reverse_dry_run_D1.json", reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=True))
    write("reverse_commit_D1.json", reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=False))
    write("affected_D1.json", affected(graph, "D1"))
    write("audit_after_reverse.json", audit(graph))

    seed_fixture(graph)
    write("audit_clean.json", audit(graph))
    write("graph.json", graph_snapshot(graph))
    seed_fixture(graph)


if __name__ == "__main__":
    main()
