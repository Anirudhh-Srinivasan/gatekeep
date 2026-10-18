# Gatekeeper Cypher catalogue

All runtime Cypher is in `gatekeeper_engine/queries.py` as named constants. Values are passed as parameters. The only formatted value is a validated integer depth in `dead_premises_query()` and `decision_chain_query()`, bounded to 1–6 or 0–6 respectively.

The graph is necessary because the answer is a traversal: governance inherits through an artifact hierarchy, liveness follows recursive decision premises, provenance crosses source/decision/person edges, and the ledger points back from a past answer to every decision retrieved for it. A flat rules table cannot provide those paths without reimplementing the graph relationships elsewhere.

## Query catalogue

| Constant / helper | Parameters | What it does | Representative fixture result |
| --- | --- | --- | --- |
| `RESOLVE_ARTIFACT` | `target` | Resolves the requested artifact. This is always the first query in `check_action`; an empty result returns `UNKNOWN_TARGET` and stops. | `file:compat/win7_shim.js`, `file`, `win7_shim.js` |
| `LIST_ARTIFACTS` / `LIST_DECISIONS` | — | Stable graph-backed name lists for the public API validation layer. | 5 artifacts / 5 decisions |
| `ARTIFACT_HIERARCHY` | `target` | Returns the target and each parent reached by `PART_OF` up to four hops. This supplies inherited governance scopes. | shim → `module:compat` → `repo:app` |
| `DIRECT_ARTIFACT` | `target` | Small direct artifact lookup retained as a query-catalog fallback; the engine currently uses `RESOLVE_ARTIFACT`. | the target artifact row |
| `GOVERNING_DECISIONS` | `target` | Matches decisions whose bound `GOVERNS` edge points to the target or one of its parents. The relationship is bound as `g` so constraint properties are read from the correct edge. | D2 on `module:compat`; D8 on `package:moment` |
| `DEAD_PREMISES_TEMPLATE` / `dead_premises_query()` | `decision` | Traverses `DEPENDS_ON` up to the validated depth and returns only non-live premises, including hop count and ordered `via`. A `WITH ... collect(paths)` reduction collapses diamond paths by premise id. | D2 → D5 → D6 → D1 at hop 3 after reversal |
| `DEAD_PREMISES_WITH_OVERRIDES_TEMPLATE` | `decision`, `overrides` | Same traversal for reverse dry runs. It treats validated ids in `overrides` as dead in the query result without writing the graph. | simulated D1 supersession makes D2 stale |
| `DECISION_CHAIN_TEMPLATE` / `decision_chain_query()` | `decision` | Bounded chain helper that supports a zero lower bound. The current `why()` implementation walks one-hop rows client-side to terminate safely on cycles. | D2 → D5 → D6 → D1 |
| `OWNER_HIERARCHY` | `target` | Walks artifact parents and connects scopes to owning teams and team members. | `platform` / `bob` |
| `DECISION_BY_ID` | `decision` | Validates a decision name and gets its title/status/date before tools operate. | D1, live, 2021-03-01 |
| `DECISION_DEPENDENCIES` | `decision` | One-hop dependency lookup used by the bounded client-side path builders. | D2 → D5 |
| `DECISIONS_BY_IDS` | `ids` | Fetches labels and statuses for ids already returned by fixed graph traversals. The ids are parameters, not interpolated. | D2, D5, D6, D1 |
| `WHY_SOURCES` | `decision` | Joins a decision to its source records, deciders, and superseded records. `SOURCED_FROM`, `DECIDED_BY`, and `SUPERSEDES` are separate graph evidence links. | ADR-021 → D2 → bob |
| `REVERSE_COMMIT` | `old`, `new_id`, `new_title`, `decided_at` | Idempotent write path: `MERGE` the new live decision, `MERGE` the supersession edge, and mark the old decision superseded. | D4 supersedes D1 |
| `LEDGER_CREATE` | viewer / answer data / decision ids | Legacy ledger write shape retained in the catalogue for compatibility; the engine uses the context-carrying variant below. | Answer → ASKED_BY → alice; Answer → USED_IN → D2…D1 |
| `LEDGER_CREATE_WITH_CONTEXT` | viewer, answer metadata, target, action, verdict, decision ids | Writes an `Answer`, links it to the viewer, and creates `USED_IN` edges for every retrieved decision. Target/action/verdict are extra answer properties used by reverse dry-run inspection. | `ans-<id>` with ESCALATE context |
| `LEDGER_CREATE_WITHOUT_DECISIONS` | viewer, answer metadata | Writes an Answer for `UNGOVERNED` results without inventing a decision edge. | Answer with zero `USED_IN` edges |
| `LEDGER_AFFECTED` | `decision` | Finds answers that used the requested old decision, their people, and the governing decision used by the answer. The extra match prevents premise nodes such as D5/D6 from being reported as the governing stale decision. | alice + ans-021 + D2; carol + ans-034 + D2 |
| `LEDGER_FOR_DECISION` | `decision` | Reads answer context (target/action/verdict) for reverse dry-run simulation. | shim / delete / ESCALATE |
| `REVERSAL_GOVERNANCE_PAIRS` | `decision` | Finds every dependent decision and every artifact/action pair governed by those decisions, including descendant artifacts. This is the graph-derived dry-run input; it does not inspect the ledger. | shim + module × delete/modify via D2 |
| `AFFECTED_DECISIONS` / `AFFECTED_ANSWERS` | decision / decision ids | Builds the affected ledger evidence path: old decision → dependent decisions → Answer nodes → people. | D1 → D6/D5/D2 → ans-021/ans-034 → alice/carol |
| `COUNT_NODES` / `COUNT_EDGES` | — | Fixture idempotency assertions. | 21 nodes, 26 edges |
| `GRAPH_NODES` | — | Returns typed graph nodes for the future backend graph explorer. | 21 synthetic nodes |
| `GRAPH_EDGES` | — | Returns typed graph edges with a stable `source-type-target` id. | 26 synthetic edges |
| `PAGERANK` | `limit` | Calls FalkorDB's graph algorithm over Decision/DEPENDS_ON. The UI panel is optional if this algorithm is unavailable. | D1 ranks highest on the fixture |
| `CREATE_INDEX_*` | — | Creates indexes for `Decision.id`, `Artifact.id`, and `Person.handle`. | all three execute successfully on v4.22.1 |
| `RESET_GRAPH` | — | Deletes all nodes/edges in the selected test/demo graph before reseeding. | empty graph |
| `SEED_NODES` | — | Creates the synthetic people, team, artifacts, source records, and decisions. | 21 nodes after the full fixture |
| `SEED_EDGES` | — | Creates ownership, hierarchy, premise, governance, provenance, and decider relationships. | 16 non-ledger edges |
| `SEED_LEDGER` | — | Creates Alice and Carol's pre-reversal Answer records and their four `USED_IN` links each. | 2 Answers + 10 ledger edges |
| `CYCLE_AUDIT` | — | Bounded cycle detection over `DEPENDS_ON`. | no rows in clean fixture |
| `ZOMBIE_AUDIT` | — | Returns all reachable premises for live decisions; Python reports a zombie only when every returned premise is dead. | D6 becomes zombie after D1 reversal |
| `LIVE_INCOMING_SUPERSEDES_AUDIT` | — | Finds live decisions with incoming supersession from another live decision. | synthetic consistency fault |
| `DUPLICATE_SUPERSEDERS_AUDIT` | — | Binds and counts `SUPERSEDES` edges, reporting multiple live superseders of one old decision. | synthetic duplicate fault |
| `ORPHAN_DECISIONS_AUDIT` / `ORPHAN_ARTIFACTS_AUDIT` | — | Finds records with no meaningful relationship edges. Artifact results are candidates, not automatically bugs. | clean fixture has one orphan artifact |
| `GOVERNING_DECISION_IDS` | — | Supplies direct governing decision/scope/action rows for deterministic stale-governing checks. | D2 / module:compat |
| `FAULT_*` | bounded fault ids | Synthetic fault injection statements used only on a temporary rebuilt graph for detection-rate measurement. | 5/5 detected in current run |

## Important query details

### Resolve before anything else

```cypher
MATCH (a:Artifact {id: $target})
RETURN a.id AS id, a.kind AS kind, a.name AS name
LIMIT 1
```

`check_action()` validates action/depth in Python, then runs this resolver. Unknown names return the typed unknown result and do not run governance, owner, or premise queries. When a viewer is explicitly supplied, the result is still recorded as an Answer with no `USED_IN` edges.

### Inherited governance

```cypher
MATCH (target:Artifact {id: $target})
OPTIONAL MATCH (target)-[:PART_OF*1..4]->(parent:Artifact)
WITH collect(DISTINCT target) + collect(DISTINCT parent) AS scopes
UNWIND scopes AS scope
MATCH (d:Decision)-[g:GOVERNS]->(scope)
RETURN DISTINCT d.id, d.title, d.status, d.decided_at,
       g.constraint, g.actions, g.severity, scope.id, coalesce(g.provenance, 'SYNTHETIC')
```

The bound `g` is important: FalkorDB can verify the existence of an unbound relationship without giving a reliable edge property row. The query returns the decision and the actual governed scope, which is why D2 on `module:compat` applies to its shim child.

### Recursive liveness evidence

```cypher
MATCH (d:Decision {id: $decision})
MATCH p = (d)-[:DEPENDS_ON*1..4]->(premise:Decision)
WHERE premise.status <> 'live'
WITH premise.id AS id, premise.title AS title, premise.status AS status,
     min(length(p)) AS hops, collect(p) AS paths
RETURN id, title, status, hops,
       [node IN nodes(paths[0]) | node.id] AS via
ORDER BY hops, id
```

The bound integer `4` is generated only after Python validates depth. The query returns the shortest observed path to a dead premise. `DISTINCT` over the whole row is not enough for a diamond: two paths have different `via` arrays. Grouping by premise id and selecting the shortest path gives one stale premise row.

### Reversal write

```cypher
MATCH (old:Decision {id: $old})
MERGE (new:Decision {id: $new_id})
  ON CREATE SET new.title = $new_title,
                new.status = 'live', new.decided_at = $decided_at
  ON MATCH SET new.title = $new_title, new.status = 'live'
MERGE (new)-[:SUPERSEDES {provenance: 'SYNTHETIC'}]->(old)
SET old.status = 'superseded'
RETURN old.id, new.id, old.status, new.status
```

Dry-run never calls this statement. It first reads graph-derived governance pairs, then asks the deterministic verdict function to treat the old id as superseded through the parameterized override query. Ledger context is returned separately but cannot hide a graph flip. Commit can be run again without creating another node or duplicate `SUPERSEDES` edge.

### Ledger

Every `check_action()` with a viewer writes an `Answer`. `USED_IN` contains all decisions retrieved for that response, including stale/dead decisions; `ASKED_BY` connects it to the viewer. Viewer handles are `MERGE`d into `Person`, so the default `anonymous` viewer is still a graph node. An unknown target writes an Answer only when a viewer was explicitly supplied; it has no decision edges.

### Overrides verification

The reverse dry-run variant uses this fixed predicate:

```cypher
MATCH p = (d:Decision {id: $decision})-[:DEPENDS_ON*1..6]->(premise:Decision)
WHERE premise.status <> 'live' OR premise.id IN $overrides
```

`$overrides` is a list of validated decision ids. FalkorDB v4.22.1 accepts the list parameter. A parameter in the range itself (`*1..$depth`) still fails, so only the validated bounded integer is formatted.

### Audit queries

Audit is read-only and bounded. Cycles use `MATCH p=(d)-[:DEPENDS_ON*1..6]->(d)`. Zombie detection intentionally returns every premise first; otherwise a stale decision would look like a zombie because a query filtered out its live premises. Supersession queries bind the relationship when counting it. Orphan artifact output is a candidate data-quality finding because root artifacts can be legitimate.

## Fixture sample

After `seed_fixture()`:

```text
nodes = 21
edges = 26

check(file:compat/win7_shim.js, delete, depth=6)
  verdict = ESCALATE
  path = file:compat/win7_shim.js -> D2 -> D5 -> D6 -> D1
  owner = platform / bob

check(package:moment, add_dependency)
  verdict = BLOCK
  path = package:moment -> D8

check(file:docs/readme.md, delete)
  verdict = UNGOVERNED
  note = nothing recorded covers this action; that does not mean safe
```
