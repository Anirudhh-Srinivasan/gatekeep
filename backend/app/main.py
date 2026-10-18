from __future__ import annotations

import os
import re
import threading
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from gatekeeper_engine import Gatekeeper
from gatekeeper_engine.models import ValidationError

app = FastAPI(title="Gatekeeper API", version="1.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

_engine: Gatekeeper | None = None
_reverse_lock = threading.Lock()
_reset_hits: dict[str, deque[float]] = defaultdict(deque)

def engine() -> Gatekeeper:
    global _engine
    if _engine is None:
        _engine = Gatekeeper.from_env()
    return _engine

def error(exc: ValidationError) -> HTTPException:
    return HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message})

def call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValidationError as exc:
        raise error(exc) from exc

class CheckBody(BaseModel):
    target: str
    action: str
    depth: int = Field(6, ge=1, le=6)

class ReverseBody(BaseModel):
    old: str
    new_id: str
    new_title: str
    dry_run: bool = True

class AskBody(BaseModel):
    question: str = Field(min_length=1, max_length=2000)

def viewer_value(value: str | None) -> str:
    return value or "anonymous"

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.post("/check")
def check(body: CheckBody, x_viewer: str | None = Header(default=None)):
    return call(engine().check, body.target, body.action, body.depth, viewer_value(x_viewer)).model_dump(mode="json")

@app.get("/why/{decision}")
def why(decision: str): return call(engine().why, decision).model_dump(mode="json")

@app.get("/who/{target:path}")
def who(target: str): return call(engine().who, target).model_dump(mode="json")

@app.get("/affected/{decision}")
def affected(decision: str): return call(engine().affected, decision).model_dump(mode="json")

@app.get("/load_bearing")
def load_bearing(limit: int = 5): return [x.model_dump(mode="json") for x in call(engine().load_bearing, limit)]

@app.get("/graph")
def graph(): return call(engine().graph).model_dump(mode="json")

@app.get("/targets")
def targets(): return [x.model_dump(mode="json") for x in call(engine().list_targets)]

@app.get("/resolve/{name:path}")
def resolve(name: str): return call(engine().resolve_target, name).model_dump(mode="json")

@app.get("/decisions")
def decisions(): return [x.model_dump(mode="json") for x in call(engine().list_decisions)]

@app.get("/audit")
def audit(): return call(engine().audit).model_dump(mode="json")

@app.post("/reverse")
def reverse(body: ReverseBody):
    with _reverse_lock:
        return call(engine().reverse, body.old, body.new_id, body.new_title, body.dry_run).model_dump(mode="json")

@app.post("/reset")
def reset(request: Request, x_reset_token: str | None = Header(default=None)):
    expected = os.getenv("RESET_TOKEN", "")
    if expected and x_reset_token != expected:
        raise HTTPException(status_code=403, detail={"code": "INVALID_RESET_TOKEN", "message": "valid X-Reset-Token required"})
    now = time.monotonic(); key = request.client.host if request.client else "unknown"; hits = _reset_hits[key]
    while hits and now - hits[0] > 60: hits.popleft()
    limit = int(os.getenv("RESET_RATE_LIMIT", "3"))
    if len(hits) >= limit: raise HTTPException(status_code=429, detail={"code": "RESET_RATE_LIMITED", "message": "reset rate limit exceeded"})
    hits.append(now)
    return call(engine().reset, True).model_dump(mode="json")

def parse_ask(question: str, targets: list[Any]) -> tuple[str, str]:
    lowered = question.lower()
    actions = ("add_dependency", "remove_dependency", "delete", "modify", "deploy")
    action = next((a for a in actions if a.replace("_", " ") in lowered), "delete" if "delete" in lowered or "remove" in lowered else "modify")
    target = next((t.id for t in targets if t.id.lower() in lowered or t.name.lower() in lowered), "")
    return target, action

@app.post("/ask")
def ask(body: AskBody, x_viewer: str | None = Header(default=None)):
    target, action = parse_ask(body.question, engine().list_targets())
    # Unknown target is deliberately passed to the engine: it returns UNKNOWN_TARGET.
    asked_target = target or next((token for token in re.findall(r"[\w:/.-]+", body.question) if ":" in token), body.question.strip())
    result = call(engine().check, asked_target, action, 6, viewer_value(x_viewer))
    verified = result.verdict != "UNKNOWN_TARGET" and result.target == asked_target
    explanation = (f"{asked_target} is not in the graph, so Gatekeeper will not guess."
                   if result.verdict == "UNKNOWN_TARGET" else
                   f"The graph returned {result.verdict} for {result.target} with evidence path {', '.join(node.id for node in result.path.nodes)}.")
    return {"question": body.question, "tool_calls": [{"tool": "check", "args": {"target": result.target, "action": action, "depth": 6}, "status": "complete"}], "result": result.model_dump(mode="json"), "explanation": explanation, "names_verified": verified, "post_check": {"passed": verified}, "source": "router"}
