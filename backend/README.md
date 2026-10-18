# Gatekeeper backend

FastAPI adapter and MCP server for the synchronous deterministic engine in
`../engine`. The engine remains the only verdict and Cypher implementation.

## Setup

```bash
cd gatekeep/backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
export PYTHONPATH=.:../engine
export RESET_TOKEN=local-development-token
```

FalkorDB must be running on `127.0.0.1:${FALKORDB_PORT:-6379}` (or configure the engine's
`FALKORDB_*` variables). Start it using the existing setup in `../engine/README.md`.

Run the API with `PYTHONPATH=.:../engine uvicorn app.main:app --reload`.

## API

`POST /check`, `GET /why/{decision}`, `GET /who/{target}`, `POST /reverse`,
`GET /affected/{decision}`, `GET /load_bearing`, `GET /graph`, `GET /targets`,
`GET /decisions`, `GET /audit`, `POST /reset`, and frontend-compatible `POST /ask`.
`X-Viewer` identifies the viewer. `/reset` requires `X-Reset-Token` when
`RESET_TOKEN` is configured and is rate-limited per client. Reverse commits are
serialized by a process-local lock; this is not a distributed deployment
control.

`/ask` uses a deterministic target/action router and always post-checks through
the engine. Groq is intentionally optional; no API key is needed for the
deterministic path. `CORS_ORIGINS` configures allowed origins.

## MCP

The official Python MCP SDK/FastMCP adapter is in [`mcp/`](mcp/README.md).
Stdio is the default transport. The default server exposes read/check tools and
`reverse_preview`; `reverse_commit` is absent unless
`GATEKEEPER_MCP_ALLOW_WRITE=1`.

```bash
cd gatekeep
FALKORDB_HOST=127.0.0.1 FALKORDB_PORT=6380 \
PYTHONPATH="$PWD/engine" "$PWD/backend/.venv/bin/python" \
"$PWD/backend/mcp/server.py"
```

## Tests

With FalkorDB available:

```bash
cd gatekeep
FALKORDB_HOST=127.0.0.1 FALKORDB_PORT=6380 RESET_TOKEN=test-token \
PYTHONPATH=backend:engine backend/.venv/bin/pytest backend/tests -q
FALKORDB_HOST=127.0.0.1 FALKORDB_PORT=6380 \
PYTHONPATH=backend:engine backend/.venv/bin/pytest backend/mcp/tests -q
```
