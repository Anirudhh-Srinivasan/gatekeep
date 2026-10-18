# Real PEP data slice

This directory contains a bounded, offline snapshot of three real records from the
public `python/peps` repository. Network verification and the observed source fields
are recorded in `source_metadata.json`; the snapshot itself is `pep_slice.json`.

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

The test expects 3 decisions, 3 source documents, and 3 curated-note documents
(6 namespaced nodes total), and verifies a second load has the same counts.
