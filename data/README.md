# Real PEP data slice

This directory contains a small, bounded, offline proof of concept: three real
records from the public `python/peps` repository plus three curated notes. It is
not a broad PEP corpus and it does not form a real `DEPENDS_ON` or `SUPERSEDES`
chain. Network verification and the observed source fields are recorded in
`source_metadata.json`; the snapshot itself is `pep_slice.json`.

`loader.py` exposes `load_real_data(graph)`. It uses one parameterized, fixed Cypher
statement with `MERGE`, so repeated loads do not duplicate nodes or relationships.
Real IDs use the `real:pep:` namespace and curated notes use `curated:pep-note:`.
The loader never resets or writes synthetic fixture nodes.

## Run

From `engine/` (using the existing environment and a running FalkorDB):

```sh
PYTHONPATH=../data pytest ../data/test_loader.py -q
python ../data/demo_real.py
```

The test expects 3 real decisions, 3 real source documents, and 3 curated-note
documents, and verifies a second load has the same counts. The loader uses
`MERGE`, does not reset synthetic nodes, and performs no network request at load
time.

## Scope boundary

The records are useful for proving namespacing, provenance, and idempotent
loading. They are not enough to demonstrate a real multi-hop PEP dependency
chain, real artifact ownership, or real governance decisions. Those were
explicitly deferred from this run.
