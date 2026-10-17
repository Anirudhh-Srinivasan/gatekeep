# Work notes

- Kept the frontend `CheckResponse` shape unchanged except for optional viewer input, edge provenance, and the affected-ledger wrapper requested in this task.
- Preserved `UNKNOWN_TARGET` as a check verdict. The public `resolve_target()` method raises `ValidationError(code="UNKNOWN_TARGET_NAME")`; `Gatekeeper.check()` returns the product verdict and records an Answer for an explicit viewer.
- Treated a dry-run reversal as graph-derived truth plus a separate ledger context. A graph flip is reported even when no Answer nodes exist.
- Included both direct governed artifacts and descendants in reversal pairs. This means the D1 preview includes module and shim pairs, and both `delete` and `modify` for D2; the frontend highlights the requested shim/delete path.
- Treated a live decision with all reachable premises dead as a `zombie` audit finding. A stale decision with at least one live premise is not a zombie.
- Treated root artifacts with no parent and no governance as candidate `orphan_artifact` findings. The clean synthetic fixture currently reports `file:docs/readme.md` as one such candidate.
- Fault detection rate is measured over five synthetic fault categories on a temporary rebuilt graph; it is not a production quality metric.
- Used Python 3.11.2 for the real run because Python 3.12 is unavailable in this container. Python 3.12 remains the requested target runtime.
- Kept the existing Podman/FalkorDB setup and did not add a FastAPI backend or ingestion code.
