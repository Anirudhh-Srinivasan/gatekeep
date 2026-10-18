# Gatekeeper backend

FastAPI adapter for the synchronous deterministic engine in `../engine`.

## Setup

```bash
cd gatekeep/backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
export PYTHONPATH=.:../engine
export RESET_TOKEN=local-development-token
```

FalkorDB must be running on `127.0.0.1:6379` (or configure the engine's
`FALKORDB_*` variables). Start it using the existing setup in `../engine/README.md`.

Run the API with `PYTHONPATH=.:../engine uvicorn app.main:app --reload`.

## API

`POST /check`, `GET /why/{decision}`, `GET /who/{target}`, `POST /reverse`,
`GET /affected/{decision}`, `GET /load_bearing`, `GET /graph`, `GET /targets`,
`GET /decisions`, `GET /audit`, `POST /reset`, and frontend-compatible `POST /ask`.
`X-Viewer` identifies the viewer. `/reset` requires `X-Reset-Token` and is
rate-limited per client. Reverse commits are serialized by a process lock.

`/ask` uses a deterministic target/action router and always post-checks through
the engine. Groq is intentionally optional; no API key is needed for the
deterministic path. `CORS_ORIGINS` configures allowed origins.

## Tests

With FalkorDB available:

```bash
PYTHONPATH=.:../engine .venv/bin/pytest -q
```
