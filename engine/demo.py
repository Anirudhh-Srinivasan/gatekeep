from __future__ import annotations

import os

from gatekeeper_engine.db import connect, select_graph
from gatekeeper_engine.fixtures import seed_fixture
from gatekeeper_engine.tools import affected, reverse
from gatekeeper_engine.verdict import check_action


def print_result(label: str, result) -> None:
    print(f"\n{'=' * 76}\n{label}\n{'=' * 76}")
    print(f"verdict : {result.verdict}")
    print(f"target  : {result.target}")
    print(f"action  : {result.action}")
    print(f"depth   : {result.depth}")
    print(f"owner   : {result.owner.model_dump() if result.owner else 'none'}")
    print(f"note    : {result.note}")
    print("path    : " + " -> ".join(node.id for node in result.path.nodes))
    for stale in result.stale:
        for premise in stale.dead_premises:
            print(f"stale   : {stale.decision} / {premise.id} / hop {premise.hops} / via {' > '.join(premise.via)}")


def main() -> None:
    client = connect()
    name = os.getenv("FALKORDB_GRAPH", "gatekeeper")
    graph = select_graph(client, name)
    seed_fixture(graph)

    print_result("1. shim delete / live chain", check_action(graph, "file:compat/win7_shim.js", "delete", 6))
    print_result("2. moment add_dependency / high prohibition", check_action(graph, "package:moment", "add_dependency", 6))
    print_result("3. readme delete / unknown territory", check_action(graph, "file:docs/readme.md", "delete", 6))

    print("\n" + "=" * 76 + "\n4. reverse D1 -> D4 / dry run\n" + "=" * 76)
    preview = reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=True)
    print("flips   :", [flip.model_dump() for flip in preview.flips])
    print("people  :", [person.model_dump() for person in preview.affected_people])
    reverse(graph, "D1", "D4", "Drop Windows 7 support", dry_run=False)
    print_result("4a. same shim / shallow depth 1", check_action(graph, "file:compat/win7_shim.js", "delete", 1))
    print_result("4b. same shim / full depth 4", check_action(graph, "file:compat/win7_shim.js", "delete", 4))
    print("affected:", affected(graph, "D1").model_dump())


if __name__ == "__main__":
    main()
