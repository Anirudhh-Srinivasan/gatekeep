"""Fixed, human-written Cypher statements used by the engine.

Only the bounded integer depth is interpolated by ``dead_premises_query``.
All names and values remain query parameters.
"""

RESOLVE_ARTIFACT = """
MATCH (a:Artifact {id: $target})
RETURN a.id AS id, a.kind AS kind, a.name AS name
LIMIT 1
"""

LIST_ARTIFACTS = """
MATCH (a:Artifact)
RETURN a.id AS id, a.kind AS kind, a.name AS name
ORDER BY a.id
"""

ARTIFACT_HIERARCHY = """
MATCH (a:Artifact {id: $target})
OPTIONAL MATCH p = (a)-[:PART_OF*1..4]->(parent:Artifact)
RETURN a.id AS id, a.kind AS kind, a.name AS name,
       CASE WHEN parent IS NULL THEN [] ELSE [n IN nodes(p) | n.id] END AS parent_path
"""

DIRECT_ARTIFACT = """
MATCH (a:Artifact {id: $target})
RETURN a.id AS id, a.kind AS kind, a.name AS name
"""

GOVERNING_DECISIONS = """
MATCH (target:Artifact {id: $target})
OPTIONAL MATCH (target)-[:PART_OF*1..4]->(parent:Artifact)
WITH collect(DISTINCT target) + collect(DISTINCT parent) AS scopes
UNWIND scopes AS scope
MATCH (d:Decision)-[g:GOVERNS]->(scope)
RETURN DISTINCT d.id AS decision, d.title AS title, d.status AS status,
       d.decided_at AS decided_at, g.constraint AS constraint,
       g.actions AS actions, g.severity AS severity, scope.id AS scope,
       coalesce(g.provenance, 'SYNTHETIC') AS provenance
"""

DEAD_PREMISES_TEMPLATE = """
MATCH (d:Decision {{id: $decision}})
MATCH p = (d)-[:DEPENDS_ON*1..{depth}]->(premise:Decision)
WHERE premise.status <> 'live'
WITH premise.id AS id, premise.title AS title, premise.status AS status,
     min(length(p)) AS hops, collect(p) AS paths
RETURN id, title, status, hops,
       [node IN nodes(paths[0]) | node.id] AS via
ORDER BY hops, id
"""

DEAD_PREMISES_WITH_OVERRIDES_TEMPLATE = """
MATCH (d:Decision {{id: $decision}})
MATCH p = (d)-[:DEPENDS_ON*1..{depth}]->(premise:Decision)
WHERE premise.status <> 'live' OR premise.id IN $overrides
WITH premise.id AS id, premise.title AS title, premise.status AS status,
     min(length(p)) AS hops, collect(p) AS paths
RETURN id, title, status, hops,
       [node IN nodes(paths[0]) | node.id] AS via
ORDER BY hops, id
"""

DECISION_CHAIN_TEMPLATE = """
MATCH p = (d:Decision {{id: $decision}})-[:DEPENDS_ON*0..{depth}]->(premise:Decision)
RETURN DISTINCT [node IN nodes(p) | node.id] AS via
ORDER BY size(via)
"""

OWNER_HIERARCHY = """
MATCH (target:Artifact {id: $target})
OPTIONAL MATCH (target)-[:PART_OF*0..4]->(scope:Artifact)
OPTIONAL MATCH (team:Team)-[:OWNS]->(scope)
OPTIONAL MATCH (person:Person)-[:MEMBER_OF]->(team)
RETURN DISTINCT scope.id AS scope, team.name AS team,
       collect(DISTINCT person.handle) AS people
"""

DECISION_BY_ID = """
MATCH (d:Decision {id: $decision})
RETURN d.id AS id, d.title AS title, d.status AS status,
       d.decided_at AS decided_at
LIMIT 1
"""

LIST_DECISIONS = """
MATCH (d:Decision)
RETURN d.id AS id, d.title AS title, d.status AS status, d.decided_at AS decided_at
ORDER BY d.id
"""

DECISION_DEPENDENCIES = """
MATCH (d:Decision {id: $decision})-[rel:DEPENDS_ON]->(premise:Decision)
RETURN premise.id AS id, premise.title AS title,
       premise.status AS status, premise.decided_at AS decided_at,
       coalesce(rel.provenance, 'SYNTHETIC') AS provenance
ORDER BY premise.id
"""

DECISIONS_BY_IDS = """
MATCH (d:Decision)
WHERE d.id IN $ids
RETURN d.id AS id, d.title AS title, d.status AS status, d.decided_at AS decided_at
"""

WHY_SOURCES = """
MATCH (d:Decision {id: $decision})
OPTIONAL MATCH (d)-[:SOURCED_FROM]->(source)
OPTIONAL MATCH (d)-[:DECIDED_BY]->(person:Person)
OPTIONAL MATCH (d)-[:SUPERSEDES]->(old:Decision)
RETURN d.id AS id, d.title AS title, d.status AS status,
       d.decided_at AS decided_at,
       collect(DISTINCT {type: labels(source)[0], id: source.id, url: source.url,
                         title: source.title, provenance: coalesce(source.provenance, 'SYNTHETIC')}) AS sources,
       collect(DISTINCT person.handle) AS decided_by,
       collect(DISTINCT old.id) AS supersedes
"""

REVERSE_COMMIT = """
MATCH (old:Decision {id: $old})
MERGE (new:Decision {id: $new_id})
  ON CREATE SET new.title = $new_title,
                new.status = 'live',
                new.decided_at = $decided_at
  ON MATCH SET new.title = $new_title,
               new.status = 'live'
MERGE (new)-[:SUPERSEDES {provenance: 'SYNTHETIC'}]->(old)
SET old.status = 'superseded'
RETURN old.id AS old, new.id AS new_id, old.status AS old_status, new.status AS new_status
"""

LEDGER_CREATE = """
MATCH (viewer:Person {handle: $viewer})
CREATE (answer:Answer {
  id: $answer_id, at: $at, kind: $kind, summary: $summary, session: $session
})
CREATE (answer)-[:ASKED_BY]->(viewer)
WITH answer
UNWIND $decision_ids AS decision_id
MATCH (decision:Decision {id: decision_id})
CREATE (answer)-[:USED_IN]->(decision)
RETURN answer.id AS answer_id
"""

LEDGER_CREATE_WITH_CONTEXT = """
MERGE (viewer:Person {handle: $viewer})
  ON CREATE SET viewer.synthetic = $synthetic
CREATE (answer:Answer {
  id: $answer_id, at: $at, kind: $kind, summary: $summary, session: $session,
  target: $target, action: $action, verdict: $verdict, synthetic: $synthetic
})
CREATE (answer)-[:ASKED_BY]->(viewer)
WITH answer
UNWIND $decision_ids AS decision_id
MATCH (decision:Decision {id: decision_id})
CREATE (answer)-[:USED_IN]->(decision)
RETURN answer.id AS answer_id
"""

LEDGER_CREATE_WITHOUT_DECISIONS = """
MERGE (viewer:Person {handle: $viewer})
  ON CREATE SET viewer.synthetic = $synthetic
CREATE (answer:Answer {
  id: $answer_id, at: $at, kind: $kind, summary: $summary, session: $session,
  target: $target, action: $action, verdict: $verdict, synthetic: $synthetic
})
CREATE (answer)-[:ASKED_BY]->(viewer)
RETURN answer.id AS answer_id
"""

LEDGER_AFFECTED = """
MATCH (answer:Answer)-[:USED_IN]->(decision:Decision {id: $decision})
MATCH (answer)-[:ASKED_BY]->(person:Person)
MATCH (answer)-[:USED_IN]->(governing:Decision)-[:GOVERNS]->(scope:Artifact)
RETURN DISTINCT person.handle AS person, answer.id AS answer_id,
       answer.at AS at, answer.summary AS summary, answer.verdict AS answer_value,
       governing.id AS stale_decision
ORDER BY answer.at
"""

LEDGER_FOR_DECISION = """
MATCH (answer:Answer)-[:USED_IN]->(decision:Decision {id: $decision})
MATCH (answer)-[:ASKED_BY]->(person:Person)
RETURN DISTINCT person.handle AS person, answer.id AS answer_id,
       answer.at AS at, answer.summary AS summary, answer.verdict AS answer_value,
       answer.target AS target, answer.action AS action
ORDER BY answer.at
"""

REVERSAL_GOVERNANCE_PAIRS = """
MATCH p = (dependent:Decision)-[:DEPENDS_ON*0..6]->(old:Decision {id: $decision})
WITH DISTINCT dependent
MATCH (dependent)-[g:GOVERNS]->(scope:Artifact)
MATCH (target:Artifact)-[:PART_OF*0..4]->(scope)
UNWIND CASE WHEN g.actions = '*' THEN
  ['delete', 'modify', 'add_dependency', 'remove_dependency', 'deploy']
  ELSE split(g.actions, ',') END AS action
RETURN DISTINCT dependent.id AS decision, dependent.title AS decision_title,
       target.id AS target, action, g.constraint AS constraint,
       g.severity AS severity, coalesce(g.provenance, 'SYNTHETIC') AS provenance
ORDER BY target, action, decision
"""

AFFECTED_DECISIONS = """
MATCH p = (dependent:Decision)-[:DEPENDS_ON*1..6]->(old:Decision {id: $decision})
WITH dependent.id AS id, dependent.title AS title, dependent.status AS status,
     min(length(p)) AS hops, collect(p) AS paths
RETURN id, title, status, hops,
       [node IN nodes(paths[0]) | node.id] AS via
ORDER BY hops, id
"""

AFFECTED_ANSWERS = """
MATCH (answer:Answer)-[:USED_IN]->(used:Decision)
MATCH (person:Person)<-[:ASKED_BY]-(answer)
WHERE used.id IN $decision_ids
RETURN DISTINCT answer.id AS answer_id, used.id AS decision,
       person.handle AS person
ORDER BY answer_id, decision
"""

CYCLE_AUDIT = """
MATCH p = (d:Decision)-[:DEPENDS_ON*1..6]->(d)
RETURN DISTINCT d.id AS decision, min(length(p)) AS hops
ORDER BY decision
"""

ZOMBIE_AUDIT = """
MATCH p = (d:Decision)-[:DEPENDS_ON*1..6]->(premise:Decision)
WHERE d.status = 'live'
RETURN d.id AS decision, premise.id AS premise,
       premise.status AS premise_status, length(p) AS hops
ORDER BY decision, hops, premise
"""

LIVE_INCOMING_SUPERSEDES_AUDIT = """
MATCH (new:Decision)-[:SUPERSEDES]->(old:Decision)
WHERE old.status = 'live' AND new.status = 'live'
RETURN old.id AS old, new.id AS new
ORDER BY old, new
"""

DUPLICATE_SUPERSEDERS_AUDIT = """
MATCH (new:Decision)-[s:SUPERSEDES]->(old:Decision)
WHERE new.status = 'live'
WITH old.id AS old, collect(DISTINCT new.id) AS superseders, count(s) AS edge_count
WHERE size(superseders) > 1
RETURN old, superseders, edge_count
ORDER BY old
"""

ORPHAN_DECISIONS_AUDIT = """
MATCH (d:Decision)
WHERE NOT (d)-[:GOVERNS]->()
  AND NOT (d)-[:DEPENDS_ON]->()
  AND NOT ()-[:DEPENDS_ON]->(d)
  AND NOT (d)-[:SUPERSEDES]->()
  AND NOT ()-[:SUPERSEDES]->(d)
  AND NOT (d)-[:SOURCED_FROM]->()
  AND NOT (d)-[:DECIDED_BY]->()
RETURN d.id AS id, d.status AS status
ORDER BY id
"""

ORPHAN_ARTIFACTS_AUDIT = """
MATCH (a:Artifact)
WHERE NOT (a)-[:PART_OF]->()
  AND NOT ()-[:PART_OF]->(a)
  AND NOT ()-[:GOVERNS]->(a)
RETURN a.id AS id, a.kind AS kind
ORDER BY id
"""

GOVERNING_DECISION_IDS = """
MATCH (d:Decision)-[g:GOVERNS]->(scope:Artifact)
RETURN DISTINCT d.id AS decision, scope.id AS scope, g.actions AS actions
ORDER BY decision, scope
"""

FAULT_CYCLE = """
MATCH (a:Decision {id: 'D6'}), (b:Decision {id: 'D2'})
MERGE (a)-[:DEPENDS_ON {provenance: 'SYNTHETIC'}]->(b)
"""

FAULT_ZOMBIE = """
CREATE (z:Decision {id: $id, title: 'Synthetic zombie fault', status: 'live', decided_at: '2026-01-01', synthetic: true}),
       (dead:Decision {id: $premise, title: 'Synthetic dead premise', status: 'superseded', decided_at: '2026-01-01', synthetic: true})
CREATE (z)-[:DEPENDS_ON {provenance: 'SYNTHETIC'}]->(dead)
"""

FAULT_CONSISTENCY = """
MERGE (new:Decision {id: 'D4'})
  ON CREATE SET new.title = 'Synthetic consistency superseder', new.decided_at = '2026-01-01', new.synthetic = true
WITH new
MATCH (old:Decision {id: 'D1'})
SET new.status = 'live', old.status = 'live'
MERGE (new)-[:SUPERSEDES {provenance: 'SYNTHETIC'}]->(old)
"""

FAULT_DUPLICATE_SUPERSESSION = """
CREATE (new_a:Decision {id: $id_a, title: 'Synthetic superseder A', status: 'live', decided_at: '2026-01-01', synthetic: true}),
       (new_b:Decision {id: $id_b, title: 'Synthetic superseder B', status: 'live', decided_at: '2026-01-01', synthetic: true})
WITH new_a, new_b
MATCH (old:Decision {id: 'D8'})
MERGE (new_a)-[:SUPERSEDES {provenance: 'SYNTHETIC'}]->(old)
MERGE (new_b)-[:SUPERSEDES {provenance: 'SYNTHETIC'}]->(old)
"""

FAULT_ORPHANS = """
CREATE (d:Decision {id: $decision, title: 'Synthetic orphan decision', status: 'live', decided_at: '2026-01-01', synthetic: true}),
       (a:Artifact {id: $artifact, kind: 'file', name: 'orphan.txt', synthetic: true})
"""

COUNT_NODES = "MATCH (n) RETURN count(n) AS count"
COUNT_EDGES = "MATCH ()-[r]->() RETURN count(r) AS count"

GRAPH_NODES = """
MATCH (node)
WHERE any(label IN labels(node) WHERE label IN
  ['Person', 'Team', 'Artifact', 'Decision', 'Doc', 'Ticket', 'Thread', 'Answer'])
RETURN DISTINCT {
  id: coalesce(node.id, node.handle, node.name),
  type: labels(node)[0],
  label: coalesce(node.title, node.name, node.handle, node.id),
  status: node.status,
  meta: node.kind
} AS node
"""

GRAPH_EDGES = """
MATCH (node)-[edge]->(neighbor)
WHERE any(label IN labels(node) WHERE label IN
  ['Person', 'Team', 'Artifact', 'Decision', 'Doc', 'Ticket', 'Thread', 'Answer'])
  AND any(label IN labels(neighbor) WHERE label IN
  ['Person', 'Team', 'Artifact', 'Decision', 'Doc', 'Ticket', 'Thread', 'Answer'])
RETURN DISTINCT {
  id: coalesce(node.id, node.handle, node.name) + '-' + type(edge) + '-' + coalesce(neighbor.id, neighbor.handle, neighbor.name),
  source: coalesce(node.id, node.handle, node.name),
   target: coalesce(neighbor.id, neighbor.handle, neighbor.name), type: type(edge),
   provenance: coalesce(edge.provenance, 'SYNTHETIC')
} AS edge
"""

PAGERANK = """
CALL algo.pageRank('Decision', 'DEPENDS_ON')
YIELD node, score
RETURN node.id AS id, node.title AS title, score
ORDER BY score DESC
LIMIT $limit
"""

CREATE_INDEX_DECISION = "CREATE INDEX FOR (d:Decision) ON (d.id)"
CREATE_INDEX_ARTIFACT = "CREATE INDEX FOR (a:Artifact) ON (a.id)"
CREATE_INDEX_PERSON = "CREATE INDEX FOR (p:Person) ON (p.handle)"

RESET_GRAPH = """
MATCH (n)
DETACH DELETE n
"""

SEED_NODES = """
CREATE
  (alice:Person {handle: 'alice', synthetic: true}),
  (bob:Person {handle: 'bob', synthetic: true}),
  (carol:Person {handle: 'carol', synthetic: true}),
  (platform:Team {name: 'platform', synthetic: true}),
  (repo:Artifact {id: 'repo:app', kind: 'repo', name: 'app', synthetic: true}),
  (compat:Artifact {id: 'module:compat', kind: 'module', name: 'compat', synthetic: true}),
  (shim:Artifact {id: 'file:compat/win7_shim.js', kind: 'file', name: 'win7_shim.js', synthetic: true}),
  (readme:Artifact {id: 'file:docs/readme.md', kind: 'file', name: 'readme.md', synthetic: true}),
  (moment:Artifact {id: 'package:moment', kind: 'package', name: 'moment', synthetic: true}),
  (adr017:Doc {id: 'ADR-017', url: 'https://example.invalid/doc/adr-017', title: 'Browser support policy', provenance: 'SYNTHETIC', synthetic: true}),
  (plat188:Ticket {id: 'PLAT-188', url: 'https://example.invalid/ticket/plat-188', title: 'Bundle compatibility review', provenance: 'SYNTHETIC', synthetic: true}),
  (eng42:Thread {id: 'eng-42', url: 'https://example.invalid/thread/eng-42', title: 'Polyfill trade-offs', provenance: 'SYNTHETIC', synthetic: true}),
  (adr021:Doc {id: 'ADR-021', url: 'https://example.invalid/doc/adr-021', title: 'Compatibility module ownership', provenance: 'SYNTHETIC', synthetic: true}),
  (plat441:Ticket {id: 'PLAT-441', url: 'https://example.invalid/ticket/plat-441', title: 'Remove unmaintained package', provenance: 'SYNTHETIC', synthetic: true}),
  (d1:Decision {id: 'D1', title: 'Support Windows 7 clients', status: 'live', decided_at: '2021-03-01', synthetic: true}),
  (d6:Decision {id: 'D6', title: 'Ship legacy-compatible bundles', status: 'live', decided_at: '2021-04-01', synthetic: true}),
  (d5:Decision {id: 'D5', title: 'Keep polyfill layer', status: 'live', decided_at: '2021-05-01', synthetic: true}),
  (d2:Decision {id: 'D2', title: 'Keep win7 shim in compat module', status: 'live', decided_at: '2021-06-01', synthetic: true}),
  (d8:Decision {id: 'D8', title: 'Do not use moment.js', status: 'live', decided_at: '2025-01-15', synthetic: true})
"""

SEED_EDGES = """
MATCH
  (alice:Person {handle: 'alice'}), (bob:Person {handle: 'bob'}), (carol:Person {handle: 'carol'}),
  (platform:Team {name: 'platform'}), (repo:Artifact {id: 'repo:app'}), (compat:Artifact {id: 'module:compat'}),
  (shim:Artifact {id: 'file:compat/win7_shim.js'}), (moment:Artifact {id: 'package:moment'}),
  (adr017:Doc {id: 'ADR-017'}), (plat188:Ticket {id: 'PLAT-188'}), (eng42:Thread {id: 'eng-42'}),
  (adr021:Doc {id: 'ADR-021'}), (plat441:Ticket {id: 'PLAT-441'}),
  (d1:Decision {id: 'D1'}), (d6:Decision {id: 'D6'}), (d5:Decision {id: 'D5'}),
  (d2:Decision {id: 'D2'}), (d8:Decision {id: 'D8'})
CREATE
  (bob)-[:MEMBER_OF]->(platform),
  (platform)-[:OWNS]->(compat),
  (shim)-[:PART_OF]->(compat),
  (compat)-[:PART_OF]->(repo),
  (d6)-[:DEPENDS_ON {provenance: 'SYNTHETIC'}]->(d1),
  (d5)-[:DEPENDS_ON {provenance: 'SYNTHETIC'}]->(d6),
  (d2)-[:DEPENDS_ON {provenance: 'SYNTHETIC'}]->(d5),
  (d2)-[:GOVERNS {constraint: 'requires_approval', actions: 'delete,modify', severity: 'normal', provenance: 'SYNTHETIC', synthetic: true}]->(compat),
  (d8)-[:GOVERNS {constraint: 'prohibits', actions: 'add_dependency', severity: 'high', provenance: 'SYNTHETIC', synthetic: true}]->(moment),
  (d2)-[:DECIDED_BY]->(bob),
  (d8)-[:DECIDED_BY]->(bob),
  (d1)-[:SOURCED_FROM {provenance: 'SYNTHETIC'}]->(adr017),
  (d6)-[:SOURCED_FROM {provenance: 'SYNTHETIC'}]->(plat188),
  (d5)-[:SOURCED_FROM {provenance: 'SYNTHETIC'}]->(eng42),
  (d2)-[:SOURCED_FROM {provenance: 'SYNTHETIC'}]->(adr021),
  (d8)-[:SOURCED_FROM {provenance: 'SYNTHETIC'}]->(plat441)
"""

SEED_LEDGER = """
MATCH (alice:Person {handle: 'alice'}), (carol:Person {handle: 'carol'}),
      (d1:Decision {id: 'D1'}), (d6:Decision {id: 'D6'}),
      (d5:Decision {id: 'D5'}), (d2:Decision {id: 'D2'})
CREATE
  (a1:Answer {id: 'ans-021', at: '2025-02-03T09:12:00Z', kind: 'check', summary: 'Deletion of win7_shim.js needs platform approval.', session: 'seed', target: 'file:compat/win7_shim.js', action: 'delete', verdict: 'ESCALATE', synthetic: true}),
  (a2:Answer {id: 'ans-034', at: '2025-04-18T15:41:00Z', kind: 'answer', summary: 'Ask platform before removing the Windows 7 shim.', session: 'seed', target: 'file:compat/win7_shim.js', action: 'delete', verdict: 'ESCALATE', synthetic: true}),
  (a1)-[:ASKED_BY {provenance: 'SYNTHETIC'}]->(alice), (a2)-[:ASKED_BY {provenance: 'SYNTHETIC'}]->(carol),
  (a1)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d2), (a1)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d5), (a1)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d6), (a1)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d1),
  (a2)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d2), (a2)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d5), (a2)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d6), (a2)-[:USED_IN {provenance: 'SYNTHETIC'}]->(d1)
"""


def dead_premises_query(depth: int) -> str:
    if not isinstance(depth, int) or isinstance(depth, bool) or not 1 <= depth <= 6:
        raise ValueError("depth must be an integer from 1 through 6")
    return DEAD_PREMISES_TEMPLATE.format(depth=depth)


def dead_premises_with_overrides_query(depth: int) -> str:
    if not isinstance(depth, int) or isinstance(depth, bool) or not 1 <= depth <= 6:
        raise ValueError("depth must be an integer from 1 through 6")
    return DEAD_PREMISES_WITH_OVERRIDES_TEMPLATE.format(depth=depth)


def decision_chain_query(depth: int) -> str:
    if not isinstance(depth, int) or isinstance(depth, bool) or not 0 <= depth <= 6:
        raise ValueError("depth must be an integer from 0 through 6")
    return DECISION_CHAIN_TEMPLATE.format(depth=depth)
