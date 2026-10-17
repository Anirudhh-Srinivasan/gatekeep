# Gatekeeper engine

The engine is the deterministic brain for Gatekeeper. It owns the liveness rule, verdict aggregation, fixed Cypher queries, reversal write path, and the answer ledger. There is no LLM code here: the engine resolves names, follows the graph, computes the verdict, and returns an evidence path.

## Runtime

The requested runtime is Python 3.12. The current verification container only exposes Python 3.11.2, so the checked virtual environment at `engine/.venv` was created with Python 3.11.2. The code uses standard Python 3.11-compatible typing and should be rerun with Python 3.12 on the Fedora laptop before merging.

FalkorDB is pinned to `falkordb/falkordb:v4.22.1`. This is a versioned stable release tag rather than `latest`, and it includes the FalkorDB browser on port 3000.

## Start FalkorDB

From `gatekeep/`:

```bash
# Preferred when Docker Compose is installed:
docker compose up -d falkordb

# Podman Compose is equivalent if that plugin is installed:
podman compose up -d falkordb

# Portable direct fallback when neither compose command exists:
podman run -d --name gatekeep-falkordb \
  -p 6379:6379 -p 3000:3000 \
  -v gatekeep-falkordb-data:/data \
  docker.io/falkordb/falkordb:v4.22.1
```

The repository's `docker-compose.yml` uses the same image and environment-configurable ports. Open the browser at http://localhost:3000 when the container is ready.

## Create the engine environment

```bash
cd gatekeep/engine
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

Copy `gatekeep/.env.example` to `gatekeep/.env`, then source it for Python (Compose loads it automatically), or export the variables directly:

```bash
cd gatekeep
cp .env.example .env
set -a; . ./.env; set +a
```

The client defaults to `127.0.0.1:6379` and graph `gatekeeper`.

## Run tests

```bash
cd gatekeep/engine
PYTHONPATH=. .venv/bin/pytest -q
```

The tests use a unique FalkorDB graph per test and delete it in teardown. They are real database tests, not an in-memory substitute.

## Run the terminal demo

```bash
cd gatekeep/engine
PYTHONPATH=. .venv/bin/python demo.py
```

The demo wipes and reseeds the configured graph, then runs the four hero scenarios: approval escalation and evidence path, moment.js block, ungoverned readme, and the D1 reversal/depth flip/affected ledger.

## Files

- `gatekeeper_engine/db.py` — FalkorDB connection and graph selection.
- `gatekeeper_engine/fixtures.py` — self-contained synthetic fixture seed.
- `gatekeeper_engine/queries.py` — fixed parameterized Cypher catalogue.
- `gatekeeper_engine/verdict.py` — deterministic validation, liveness, aggregation, path, and optional ledger write.
- `gatekeeper_engine/tools.py` — why, who, reverse, affected, and load-bearing tools.
- `gatekeeper_engine/api.py` — the single `Gatekeeper` entry point for the backend teammate.
- `gatekeeper_engine/audit.py` — read-only integrity audit and synthetic fault measurement.
- `gatekeeper_engine/ledger.py` — Answer nodes and USED_IN / ASKED_BY links.
- `make_examples.py` — rerunnable JSON fixtures under `examples/`.
- `ENGINE_CONTRACT.md` — public method signatures and serialized shapes.
- `SCHEMA.md` — graph node/edge schema and Mermaid model.
- `LIMITS.md` — explicit prototype limitations.
- `QUERIES.md` — query-by-query explanation for judge walkthroughs.
- `VERIFIED.md` — commands actually run against FalkorDB v4.22.1 and behavior observed.
