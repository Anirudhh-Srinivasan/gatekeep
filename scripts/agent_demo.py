"""Deterministic scripted-agent demo using Gatekeeper over MCP stdio."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "backend" / "mcp" / "server.py"
PYTHON = Path(sys.executable)


def decode(result) -> dict:
    return json.loads(result.content[0].text)


def print_path(path: dict) -> None:
    nodes = " -> ".join(node["id"] for node in path.get("nodes", [])) or "(no path)"
    print(f"    evidence path: {nodes}")


def decision(verdict: str, result: dict) -> str:
    if verdict == "BLOCK":
        return "STOP: the engine returned a prohibition."
    if verdict == "ESCALATE":
        return "ASK OWNER: approval is required."
    if verdict == "STALE":
        dead = [item["decision"] for item in result.get("stale", [])]
        return f"ASK OWNER: stale premise(s) {', '.join(dead) or 'recorded'}; stale is not allowed."
    if verdict == "ALLOW":
        return "PROCEED WITH HISTORY NOTE: the graph permits this with recorded history."
    if verdict == "UNGOVERNED":
        return "PROCEED WITH WARNING: nothing recorded covers this action; this is not proof of safety."
    return "STOP: the target is not in the recorded graph."


async def main() -> None:
    print("Gatekeeper scripted-agent demo (no LLM; deterministic stand-in)\n")
    env = {
        **os.environ,
        "PYTHONPATH": str(ROOT / "engine"),
        "GATEKEEPER_MCP_ALLOW_WRITE": "1",
        "FALKORDB_HOST": os.getenv("FALKORDB_HOST", "127.0.0.1"),
        "FALKORDB_PORT": os.getenv("FALKORDB_PORT", "6380"),
        "FALKORDB_GRAPH": os.getenv("FALKORDB_GRAPH", "gatekeeper"),
    }
    params = StdioServerParameters(command=str(PYTHON), args=[str(SERVER)], env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tasks = [
                ("delete win7_shim.js", "file:compat/win7_shim.js", "delete", 6),
                ("add moment", "package:moment", "add_dependency", 6),
                ("delete readme.md", "file:docs/readme.md", "delete", 6),
                ("touch ghost.ts", "file:unknown/ghost.ts", "delete", 6),
            ]
            for label, target, action, depth in tasks:
                print(f"→ task: {label}")
                wrapped = decode(await session.call_tool("check_action", {"target": target, "action": action, "depth": depth, "client_name": "screen-demo"}))
                if not wrapped["ok"]:
                    print(f"    error: {wrapped['error']['code']}: {wrapped['error']['message']}\n")
                    continue
                result = wrapped["result"]
                print(f"    verdict: {result['verdict']}")
                print_path(result["path"])
                print(f"    scripted decision: {decision(result['verdict'], result)}\n")

            print("→ decision reversal preview: D1 → D4")
            preview = decode(await session.call_tool("reverse_preview", {"old": "D1", "new_id": "D4", "new_title": "Drop Windows 7 support"}))
            flip = preview["result"]["flips"][0]
            print(f"    preview: {flip['from_verdict']} → {flip['to_verdict']} via {flip['decision']}")
            print_path(flip["path"])
            committed = decode(await session.call_tool("reverse_commit", {"old": "D1", "new_id": "D4", "new_title": "Drop Windows 7 support"}))
            print(f"    scripted authorized commit: {committed['result']['committed']}")
            rerun = decode(await session.call_tool("check_action", {"target": "file:compat/win7_shim.js", "action": "delete", "depth": 6, "client_name": "screen-demo"}))
            print(f"    rerun at full depth: {rerun['result']['verdict']}")
            print_path(rerun["result"]["path"])


if __name__ == "__main__":
    asyncio.run(main())
