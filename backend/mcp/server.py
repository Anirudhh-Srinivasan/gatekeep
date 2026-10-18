"""FastMCP adapter around Gatekeeper.

This module intentionally contains no Cypher and no verdict logic. The engine is
the only component allowed to read or mutate the decision graph.
"""

from __future__ import annotations

import os
import re
from typing import Any, Callable

from gatekeeper_engine import Gatekeeper
from gatekeeper_engine.models import ValidationError, validate_action_depth
from mcp.server.fastmcp import FastMCP

_ACTIONS = {"delete", "modify", "add_dependency", "remove_dependency", "deploy"}
_MAX_NAME = 300
_MAX_TITLE = 1000
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _json(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_json(item) for item in value]
    if isinstance(value, dict):
        return {key: _json(item) for key, item in value.items()}
    return value


def _error(code: str, message: str) -> dict[str, Any]:
    return {"ok": False, "error": {"code": code, "message": message}}


def _engine_error(exc: ValidationError) -> dict[str, Any]:
    return _error(exc.code, exc.message)


def _clean(value: Any, field: str, limit: int = _MAX_NAME) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"INVALID_{field.upper()}", f"{field} must be a non-empty string")
    cleaned = _CONTROL_CHARS.sub("", value).strip()
    if not cleaned:
        raise ValidationError(f"INVALID_{field.upper()}", f"{field} must contain visible characters")
    if len(cleaned) > limit:
        raise ValidationError(f"INVALID_{field.upper()}", f"{field} must be at most {limit} characters")
    return cleaned


def _run(fn: Callable[[], Any]) -> dict[str, Any]:
    try:
        return {"ok": True, "result": _json(fn())}
    except ValidationError as exc:
        return _engine_error(exc)
    except Exception as exc:  # pragma: no cover - protects an MCP client from transport crashes
        return _error("INTERNAL_ERROR", str(exc))


def create_server(gatekeeper: Gatekeeper | None = None) -> FastMCP:
    """Create a server, optionally bound to a test or application engine."""

    engine = gatekeeper or Gatekeeper.from_env()
    server = FastMCP(
        "Gatekeeper",
        instructions=(
            "Call check_action before a risky action. Verdicts are deterministic graph results: "
            "BLOCK means stop, ESCALATE means ask the recorded owner, STALE is not allowed, "
            "UNGOVERNED is not safe, and UNKNOWN_TARGET means the target is not recorded. "
            "Always inspect the returned evidence path."
        ),
    )

    @server.tool()
    def check_action(target: str, action: str, depth: int = 6, client_name: str = "mcp-agent") -> dict[str, Any]:
        """Before a risky action, check the recorded graph. The engine decides the verdict; never treat STALE or UNGOVERNED as permission."""
        try:
            target_value = _clean(target, "target")
            client_value = _clean(client_name, "client_name", 80)
            parsed_action, parsed_depth = validate_action_depth(action, depth)
            viewer = f"mcp:{client_value}"
            return _run(lambda: engine.check(target_value, parsed_action, parsed_depth, viewer))
        except ValidationError as exc:
            return _engine_error(exc)

    @server.tool()
    def why(decision: str) -> dict[str, Any]:
        """Inspect why a recorded decision exists, including sources, premises, status, and its evidence path."""
        try:
            return _run(lambda: engine.why(_clean(decision, "decision")))
        except ValidationError as exc:
            return _engine_error(exc)

    @server.tool()
    def who(target: str) -> dict[str, Any]:
        """Find the recorded owner for an artifact before acting when a verdict requires escalation."""
        try:
            return _run(lambda: engine.who(_clean(target, "target")))
        except ValidationError as exc:
            return _engine_error(exc)

    @server.tool()
    def affected(decision: str) -> dict[str, Any]:
        """Review recorded answers linked to a decision before changing it; this is impact evidence, not proof of downstream behavior."""
        try:
            return _run(lambda: engine.affected(_clean(decision, "decision")))
        except ValidationError as exc:
            return _engine_error(exc)

    @server.tool()
    def list_targets() -> dict[str, Any]:
        """List recorded artifact targets that can be checked; an absent target must be treated as UNKNOWN_TARGET."""
        return _run(engine.list_targets)

    @server.tool()
    def list_decisions() -> dict[str, Any]:
        """List recorded decisions and their statuses before selecting a premise to inspect or reverse."""
        return _run(engine.list_decisions)

    @server.tool()
    def audit() -> dict[str, Any]:
        """Audit the graph for cycles, orphaned records, and other findings; findings are evidence gaps, not verdict overrides."""
        return _run(engine.audit)

    @server.tool()
    def reverse_preview(old: str, new_id: str, new_title: str) -> dict[str, Any]:
        """Preview a decision reversal without writing it. Use this to inspect verdict flips and affected answers before any human-authorized commit."""
        try:
            old_value = _clean(old, "old")
            new_id_value = _clean(new_id, "new_id")
            title_value = _clean(new_title, "new_title", _MAX_TITLE)
            return _run(lambda: engine.reverse(old_value, new_id_value, title_value, True))
        except ValidationError as exc:
            return _engine_error(exc)

    if os.getenv("GATEKEEPER_MCP_ALLOW_WRITE") == "1":

        @server.tool()
        def reverse_commit(old: str, new_id: str, new_title: str) -> dict[str, Any]:
            """Commit a reversal only in an explicitly authorized administrative MCP process; this tool is absent by default."""
            try:
                old_value = _clean(old, "old")
                new_id_value = _clean(new_id, "new_id")
                title_value = _clean(new_title, "new_title", _MAX_TITLE)
                return _run(lambda: engine.reverse(old_value, new_id_value, title_value, False))
            except ValidationError as exc:
                return _engine_error(exc)

    @server.prompt("verdict-semantics")
    def verdict_semantics() -> str:
        """Give an MCP client the non-negotiable meaning of each Gatekeeper verdict."""
        return (
            "Gatekeeper verdicts: BLOCK=stop; ESCALATE=ask the recorded owner; STALE=not allowed because a "
            "premise is dead; ALLOW=the graph found only live permitted or historical governance; "
            "UNGOVERNED=not safe because nothing recorded covers the action; UNKNOWN_TARGET=not recorded. "
            "The engine is authoritative and every result includes an evidence path."
        )

    return server


def main() -> None:
    """Run the default stdio MCP transport; set MCP_TRANSPORT=streamable-http for optional HTTP mode."""
    server = create_server()
    server.run(transport=os.getenv("MCP_TRANSPORT", "stdio"))


if __name__ == "__main__":
    main()
