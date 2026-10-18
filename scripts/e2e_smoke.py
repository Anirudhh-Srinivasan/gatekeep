from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor

import httpx

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")
RESET_TOKEN = os.getenv("RESET_TOKEN", "")
headers = {"X-Reset-Token": RESET_TOKEN, "X-Viewer": "e2e"} if RESET_TOKEN else {"X-Viewer": "e2e"}


def main() -> None:
    with httpx.Client(base_url=BASE_URL, timeout=30, headers=headers) as client:
        def check(condition: bool, label: str) -> None:
            if not condition:
                raise AssertionError(label)

        reset = client.post("/reset")
        check(reset.is_success, f"reset {reset.status_code}: {reset.text}")
        shim = client.post("/check", json={"target": "file:compat/win7_shim.js", "action": "delete", "depth": 6}).json()
        check(shim["verdict"] == "ESCALATE", "shim escalation")
        before = client.get("/graph").json()
        preview = client.post("/reverse", json={"old": "D1", "new_id": "D4", "new_title": "Drop Windows 7 support", "dry_run": True}).json()
        check(preview["committed"] is False and any(f["from_verdict"] == "ESCALATE" and f["to_verdict"] == "STALE" for f in preview["flips"]), "reverse preview")
        check(client.get("/graph").json() == before, "dry run changed graph")
        check(client.post("/reverse", json={"old": "D1", "new_id": "D4", "new_title": "Drop Windows 7 support", "dry_run": False}).json()["committed"], "reverse commit")
        check(client.post("/check", json={"target": "file:compat/win7_shim.js", "action": "delete", "depth": 6}).json()["verdict"] == "STALE", "stale after commit")
        check(client.post("/check", json={"target": "file:compat/win7_shim.js", "action": "delete", "depth": 1}).json()["verdict"] == "ESCALATE", "shallow escalation")
        check(client.post("/check", json={"target": "package:moment", "action": "add_dependency"}).json()["verdict"] == "BLOCK", "moment block")
        check(client.post("/check", json={"target": "file:docs/readme.md", "action": "delete"}).json()["verdict"] == "UNGOVERNED", "readme ungoverned")
        check(client.post("/check", json={"target": "file:unknown/ghost.ts", "action": "delete"}).json()["verdict"] == "UNKNOWN_TARGET", "unknown target")
        affected = client.get("/affected/D1").json()
        check({row["person"] for row in affected["rows"]} >= {"alice", "carol"} and affected["path"]["nodes"], "affected")
        check(client.post("/check", json={"target": "x", "action": "bad"}).status_code == 422, "bad action")
        check(client.post("/check", json={"target": "x", "action": "delete", "depth": 7}).status_code == 422, "bad depth")
        for prompt in ["Can I delete win7_shim.js?", "Can we add moment.js?", "Can I delete readme.md?", "What about file:unknown/ghost.ts?"]:
            answer = client.post("/ask", json={"question": prompt}).json()
            check(answer["tool_calls"] and "result" in answer and "explanation" in answer, f"ask {prompt}")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: client.post("/reverse", json={"old": "D1", "new_id": "D4", "new_title": "Drop Windows 7 support", "dry_run": True}), range(2)))
        check(all(item.is_success for item in results), "concurrent reverse")
        check(client.post("/reset").is_success, "repeat reset")
    print("e2e smoke: PASS")


if __name__ == "__main__":
    main()
