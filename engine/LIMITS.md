# Engine limits

- **Advisory only.** The engine returns a recommendation; it does not stop a person, agent, deployment, or file operation.
- **Recorded knowledge only.** An unrecorded artifact/action is `UNGOVERNED`, not safe. An unknown name is `UNKNOWN_TARGET`.
- **Ledger meaning.** `USED_IN` means the decision was retrieved for an answer through Gatekeeper. It does not prove the person causally used the answer, and the ledger only covers answers given through this system.
- **Curated governance.** The `GOVERNS` mapping is a small synthetic/curated relationship layer. It is not automatically inferred from arbitrary text.
- **Synthetic fixture.** The current 21-node/26-edge demo fixture is synthetic. Source records and provenance say `SYNTHETIC`.
- **Bounded traversal.** Premise and hierarchy traversals are capped at six and four hops. A cycle or very deep dependency beyond the bound can be reported as incomplete rather than proven clean.
- **Small prototype.** The tests use FalkorDB `v4.22.1`, Python `3.11.2` in this environment, `falkordb` `1.8.0`, and Pydantic `2.x`. Python 3.12 is the requested target runtime but was unavailable for this run.
- **Concurrency.** Read checks were tested with one pooled client, fresh graph wrappers, and 8 concurrent workers. Reversal is a multi-query read/compute/write sequence and needs application-level serialization if concurrent writes are allowed.
- **PageRank optional.** `load_bearing()` returns an empty list if the deployed FalkorDB build does not expose the verified algorithm.
- **No LLM.** The engine does not select tools, generate explanations, perform prompt injection defense, or post-check names. Those belong outside this lane.
- **Provenance fallback.** Missing source/edge provenance is treated as `SYNTHETIC` for backward compatibility. That is a safe label for the prototype, not proof of origin.
