from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Action(str, Enum):
    DELETE = "delete"
    MODIFY = "modify"
    ADD_DEPENDENCY = "add_dependency"
    REMOVE_DEPENDENCY = "remove_dependency"
    DEPLOY = "deploy"


class Verdict(str, Enum):
    BLOCK = "BLOCK"
    ESCALATE = "ESCALATE"
    STALE = "STALE"
    ALLOW = "ALLOW"
    UNGOVERNED = "UNGOVERNED"
    UNKNOWN_TARGET = "UNKNOWN_TARGET"


class DecisionStatus(str, Enum):
    LIVE = "live"
    SUPERSEDED = "superseded"
    WITHDRAWN = "withdrawn"


class Constraint(str, Enum):
    PROHIBITS = "prohibits"
    REQUIRES_APPROVAL = "requires_approval"
    INFORMATIONAL = "informational"


class Severity(str, Enum):
    HIGH = "high"
    NORMAL = "normal"


class Owner(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    team: str
    people: list[str]


class Premise(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    title: str = ""
    status: DecisionStatus
    hops: int = Field(ge=1)
    via: list[str]


class DecisionRef(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    decision: str
    title: str
    status: DecisionStatus
    constraint: Constraint
    severity: Severity
    scope: str


class StaleDecision(DecisionRef):
    dead_premises: list[Premise]


GraphNodeType = Literal[
    "Person",
    "Team",
    "Artifact",
    "Decision",
    "Doc",
    "Ticket",
    "Thread",
    "Answer",
]


class PathNode(BaseModel):
    id: str
    label: str
    type: GraphNodeType
    status: DecisionStatus | None = None
    meta: str | None = None


class PathEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: str | None = None
    provenance: Literal["REAL", "CURATED", "SYNTHETIC"] = "SYNTHETIC"


class EvidencePath(BaseModel):
    nodes: list[PathNode]
    edges: list[PathEdge]


class CheckRequest(BaseModel):
    target: str
    action: Action
    depth: int = Field(default=6, ge=1, le=6)
    viewer: str = "anonymous"


class CheckResponse(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    verdict: Verdict
    target: str
    action: Action
    depth: int
    owner: Owner | None
    live: list[DecisionRef]
    stale: list[StaleDecision]
    dead: list[DecisionRef]
    info: list[DecisionRef]
    path: EvidencePath
    note: str | None = None
    answer_id: str


class Source(BaseModel):
    type: Literal["doc", "ticket", "thread"]
    id: str
    url: str
    title: str | None = None
    tag: Literal["REAL", "CURATED", "SYNTHETIC"] = "SYNTHETIC"


class WhyResponse(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    title: str
    status: DecisionStatus
    decided_at: str
    sources: list[Source]
    decided_by: list[str]
    supersedes: list[str]
    premises: list["PremiseSummary"]
    path: EvidencePath


class PremiseSummary(BaseModel):
    id: str
    title: str
    status: DecisionStatus


WhyResponse.model_rebuild()


class ReverseRequest(BaseModel):
    old: str
    new_id: str
    new_title: str
    dry_run: bool


class AffectedPerson(BaseModel):
    person: str
    answer: str
    answer_id: str
    at: str
    summary: str
    stale_decision: str


class LedgerRow(BaseModel):
    person: str
    answer_id: str
    at: str
    summary: str
    stale_decision: str


class AffectedResponse(BaseModel):
    decision: str
    rows: list[LedgerRow]
    path: EvidencePath


class ReverseResponse(BaseModel):
    flips: list[Flip]
    affected_people: list[AffectedPerson]
    committed: bool
    path: EvidencePath


class Flip(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    target: str
    action: Action
    decision: str
    from_verdict: Verdict
    to_verdict: Verdict
    path: EvidencePath


class WhoResponse(BaseModel):
    target: str
    owners: list[Owner]
    path: EvidencePath


class GraphNode(BaseModel):
    id: str
    type: GraphNodeType
    label: str
    status: DecisionStatus | None = None
    meta: str | None = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: str | None = None
    provenance: Literal["REAL", "CURATED", "SYNTHETIC"] = "SYNTHETIC"


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class LoadBearingItem(BaseModel):
    id: str
    title: str
    score: float


class TargetItem(BaseModel):
    id: str
    kind: str
    name: str


class DecisionItem(BaseModel):
    id: str
    title: str
    status: DecisionStatus
    decided_at: str


class ValidationError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class AuditFinding(BaseModel):
    type: str
    ids: list[str]
    explanation: str
    path: EvidencePath


class AuditReport(BaseModel):
    findings: list[AuditFinding]
    counts: dict[str, int]
    total: int


class ResetResponse(BaseModel):
    reset: bool
    path: EvidencePath


class FaultReport(BaseModel):
    requested: int
    injected: list[str]
    detected: list[str]
    detection_rate: float


def validate_action_depth(action: str | Action, depth: int) -> tuple[Action, int]:
    try:
        parsed_action = action if isinstance(action, Action) else Action(action)
    except (TypeError, ValueError) as exc:
        raise ValidationError("INVALID_ACTION", f"action must be one of {[item.value for item in Action]}") from exc
    if not isinstance(depth, int) or isinstance(depth, bool) or not 1 <= depth <= 6:
        raise ValidationError("INVALID_DEPTH", "depth must be an integer from 1 through 6")
    return parsed_action, depth
