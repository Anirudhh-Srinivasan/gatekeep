from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4

from .db import query
from .models import LedgerRow
from .queries import LEDGER_AFFECTED, LEDGER_CREATE_WITHOUT_DECISIONS, LEDGER_CREATE_WITH_CONTEXT


def record_answer(
    graph: Any,
    *,
    viewer: str,
    decision_ids: Iterable[str],
    summary: str,
    answer_id: str | None = None,
    at: str | None = None,
    kind: str = "check",
    session: str = "engine",
    target: str = "",
    action: str = "",
    verdict: str = "",
) -> str:
    answer_id = answer_id or f"ans-{uuid4().hex[:10]}"
    at = at or datetime.now(timezone.utc).isoformat()
    decision_list = list(dict.fromkeys(decision_ids))
    statement = LEDGER_CREATE_WITH_CONTEXT if decision_list else LEDGER_CREATE_WITHOUT_DECISIONS
    rows = query(graph, statement, {
        "viewer": viewer,
        "decision_ids": decision_list,
        "summary": summary,
        "answer_id": answer_id,
        "at": at,
        "kind": kind,
        "session": session,
        "target": target,
        "action": action,
        "verdict": verdict,
        "synthetic": session == "seed",
    }).result_set
    if not rows:
        raise ValueError(f"viewer {viewer!r} is not recorded as a Person")
    return str(rows[0][0])


def affected(graph: Any, decision: str) -> list[LedgerRow]:
    rows = query(graph, LEDGER_AFFECTED, {"decision": decision}).result_set
    return [LedgerRow(
        person=str(row[0]), answer_id=str(row[1]), at=str(row[2]), summary=str(row[3]),
        stale_decision=str(row[5]),
    ) for row in rows]
