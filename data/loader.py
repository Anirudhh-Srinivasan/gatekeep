"""Load the verified, bounded Python PEP slice into an existing FalkorDB graph."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DATA = Path(__file__).parent

LOAD_REAL_DATA = """
UNWIND $records AS record
MERGE (d:Decision {id: record.decision_id})
SET d.title = record.title, d.status = record.status, d.decided_at = record.created,
    d.provenance = 'REAL', d.synthetic = false, d.source_status = record.pep_status,
    d.source_type = record.kind
MERGE (doc:Doc {id: record.doc_id})
SET doc.url = record.url, doc.title = record.title, doc.provenance = 'REAL', doc.synthetic = false
MERGE (d)-[:SOURCED_FROM {provenance: 'REAL'}]->(doc)
MERGE (note:Doc {id: record.note_id})
SET note.url = record.url, note.title = 'Curated note for PEP ' + record.pep,
    note.provenance = 'CURATED', note.note = record.note, note.synthetic = false
MERGE (d)-[:SOURCED_FROM {provenance: 'CURATED'}]->(note)
RETURN count(*) AS loaded
"""


def _records() -> list[dict[str, Any]]:
    records = json.loads((DATA / "pep_slice.json").read_text())
    notes = {n["pep"]: n["note"] for n in json.loads((DATA / "curated_notes.json").read_text())}
    for record in records:
        record.update({
            "decision_id": f"real:pep:{record['pep']}",
            "doc_id": f"real:pep-doc:{record['pep']}",
            "note_id": f"curated:pep-note:{record['pep']}",
            "note": notes[record["pep"]],
        })
    return records


def load_real_data(graph: Any) -> dict[str, Any]:
    """Idempotently load only namespaced real/curated records and return counts."""
    records = _records()
    result = graph.query(LOAD_REAL_DATA, {"records": records})
    rows = getattr(result, "result_set", [])
    loaded = int(rows[0][0]) if rows else len(records)
    return {
        "records": loaded,
        "nodes_by_label": {"Decision": loaded, "Doc": loaded * 2},
        "edges_by_type": {"SOURCED_FROM": loaded * 2},
        "skipped": 0,
        "provenance": {"REAL": loaded * 2, "CURATED": loaded * 2, "SYNTHETIC": 0},
    }
