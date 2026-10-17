# FalkorDB verification log

These checks were run against a real `docker.io/falkordb/falkordb:v4.22.1` container on 2026-10-17. The container runtime available in the environment was Podman 4.3.1; Docker and Compose were not installed. The image was started directly with:

```bash
podman run -d --name gatekeep-falkordb \
  --network=host --cgroups=disabled \
  -e AUTH_SECRET=gatekeep-test -e ENCRYPTION_KEY=gatekeep-test \
  docker.io/falkordb/falkordb:v4.22.1
```

`--network=host` and `--cgroups=disabled` are container-sandbox workarounds for this verification environment. On a normal Fedora laptop, use the repository compose file with Docker Compose or Podman Compose, or the documented direct `podman run -p` fallback.

## Results

### Variable-length range with lower bound zero — PASS

Probe:

```cypher
MATCH (t:Artifact {id:$target})
MATCH (t)-[:PART_OF*0..4]->(s:Artifact)
RETURN collect(s.id) AS ids
```

Result for the shim: `file:compat/win7_shim.js`, `module:compat`, `repo:app`. The handoff concern about `*0..N` does not apply to FalkorDB v4.22.1, so the engine can use the direct target plus parent path approach. The governance query still uses the target separately and parent range `*1..4` to avoid relying on optional zero-hop rows.

### Parameter inside a variable-length range — FAIL

Probe:

```cypher
MATCH p=(d:Decision {id:$decision})-[:DEPENDS_ON*1..$depth]->(q:Decision)
RETURN [n IN nodes(p) | n.id] AS via
```

FalkorDB returned:

```text
ResponseError: Encountered unhandled type in inlined properties.
```

Fallback used: `dead_premises_query(depth)` validates the integer in Python (`1 <= depth <= 6`) and formats only that bounded integer into the fixed query template. All graph ids and values remain parameters. This is why the engine never formats a user-supplied string into Cypher.

### Index creation syntax — PASS

All three statements executed successfully on a fresh verification graph:

```cypher
CREATE INDEX FOR (d:Decision) ON (d.id)
CREATE INDEX FOR (a:Artifact) ON (a.id)
CREATE INDEX FOR (p:Person) ON (p.handle)
```

They are kept as named constants. The fixture does not require indexes to be created automatically, because a shared graph may already have them; deployment/seed tooling can run them once.

### `algo.pageRank` shape — PASS

This worked exactly as drafted:

```cypher
CALL algo.pageRank('Decision', 'DEPENDS_ON')
YIELD node, score
RETURN node.id AS id, node.title AS title, score
ORDER BY score DESC
LIMIT $limit
```

The fixture returned D1, D6, D5, D8, and D2 for limit 5. The engine keeps `load_bearing()` as an optional tool and returns an empty list if a deployment does not expose the algorithm.

### Bound relationship properties — PASS

```cypher
MATCH (d:Decision)-[g:GOVERNS]->(a:Artifact)
RETURN d.id, g.constraint, g.actions, g.severity
```

Returned D2 with `requires_approval / delete,modify / normal` and D8 with `prohibits / add_dependency / high`. The engine always binds `GOVERNS` as `g` when reading its properties.

### Cycles in `DEPENDS_ON` — PASS

The real test `test_cycle_terminates` creates a live D14 ↔ D15 cycle and runs the engine under a five-second pytest timeout. It returns `ESCALATE`, does not hang, and the client-side evidence path uses a visited set. The Cypher traversal itself is bounded to six hops.

### Diamonds in `DEPENDS_ON` — PASS, with a query correction

The real test `test_diamond_dependency_deduplicates_dead_premise` creates two paths from D9 to the same dead D12. A raw `RETURN DISTINCT ... via` still returned D12 twice because each path has a different `via` array. The engine therefore uses:

```cypher
WITH premise.id AS id, premise.title AS title, premise.status AS status,
     min(length(p)) AS hops, collect(p) AS paths
RETURN id, title, status, hops,
       [node IN nodes(paths[0]) | node.id] AS via
```

The test returns one D12 premise row with the shortest proof path.

### Graph snapshot edge ids — initial probe FAILED, fallback PASS

The first graph snapshot probe used the handoff-style `elementId(edge)` expression. FalkorDB v4.22.1 returned `Unknown function 'elementId'`. The engine now uses two fixed queries, `GRAPH_NODES` and `GRAPH_EDGES`, and constructs a stable edge id from source id, edge type, and target id. Both queries return the expected 21 nodes and 26 fixture edges.

### Browser — PASS

The pinned image started the FalkorDB browser at `http://localhost:3000` and returned HTTP 200. Redis/FalkorDB listens on port 6379.

## Runtime caveat

The requested project runtime is Python 3.12. `python3.12` is not installed in the current verification container; only Python 3.11.2 is available. The engine virtual environment and all 27 real database tests were run with Python 3.11.2. Recreate `engine/.venv` with Python 3.12 on the Fedora laptop before treating Python-version compatibility as fully verified.

## New verification pass

### Override list parameter — PASS

The reverse dry-run query uses `premise.id IN $overrides` inside a bounded variable-length traversal. Against FalkorDB v4.22.1, passing `{"overrides": ["D1"]}` returned D1 as the dead premise; passing an empty list returned no override match. The range itself remains formatted only from a validated integer because `*1..$depth` still fails with `Encountered unhandled type in inlined properties.`

### Graph-derived reverse preview — PASS

The fresh no-ledger test rebuilds only `SEED_NODES` and `SEED_EDGES` (19 nodes / 16 edges), then previews D1. It reports the shim `delete` pair as `ESCALATE → STALE` and leaves node/edge counts unchanged. A subsequent commit followed by a real depth-6 check returns the predicted `STALE` verdict.

### Audit queries — PASS

The clean fixture reports one candidate `orphan_artifact` (`file:docs/readme.md`) and no cycle, zombie, supersession-consistency, duplicate-supersession, or stale-governing findings. The synthetic fault runner rebuilds a temporary unique graph, injects five known faults, and measured detection of all five: **5/5, 1.0**. This is a synthetic fault measurement, not a production data-quality rate.

The bounded cycle test still terminates. Zombie detection returns every premise before Python checks that every premise is dead; this avoids misclassifying a stale decision as a zombie.

### Shared-client concurrency — PASS

The contract test used one `FalkorDB` client, per-call graph wrappers, and a `ThreadPoolExecutor` with 8 workers running 24 checks. All 24 returned `ESCALATE` with no cross-talk or query errors. The engine uses redis-py's pooled client; it does not use `single_connection_client=True`. Reversal writes remain multi-query operations and should be serialized by the future HTTP layer if concurrent writes matter.

### Provenance and source metadata — PASS

Fixture Doc/Ticket/Thread nodes now carry titles and `provenance: SYNTHETIC`. `GOVERNS`, `DEPENDS_ON`, and path edges carry the same provenance value. The real `why(D2)` output returns the source title `Compatibility module ownership` and tag `SYNTHETIC`.

### Public contract — PASS

The contract test calls every `Gatekeeper` method on a fresh fixture and checks required serialized keys/enums. It uses Pydantic `model_dump(mode="json")` plus explicit key/enum assertions rather than generating a TypeScript schema.
