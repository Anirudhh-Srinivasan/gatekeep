# Gatekeeper frontend

Gatekeeper is a pre-action checkpoint for people and AI agents. It follows recorded decision premises before answering `BLOCK`, `ESCALATE`, `STALE`, `ALLOW`, `UNGOVERNED`, or `UNKNOWN_TARGET`. The default mock API is stateful, so reversing `D1` really changes the next deep check from `ESCALATE` to `STALE`; the same UI can run against the live FastAPI/FalkorDB API.

## Run it

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The useful starting flow is:

1. Run the default `file:compat/win7_shim.js` + `delete` checkpoint.
2. Drag the depth contrast slider or use depth `1` vs `4`.
3. Dry-run and commit `D1 → D4` in **Reverse a decision**.
4. Re-run the check: the deep path is now `STALE`, while the shallow check remains `ESCALATE`.
5. Try the package prohibition and the ungoverned readme action.

The **Play demo** control is deterministic and does not use a network or randomness.

## Switching to FastAPI

Set the Vite variables in the shell or copy the public-only
`frontend/.env.example` to a local, untracked `.env.local` file:

```bash
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:8000
```

The UI talks only to `src/api/client.ts`. `src/api/types.ts` is the shared API contract. The mock implementation lives in `src/api/mockApi.ts`; it is also the fixture used by the Vitest tests.

## API contract

The backend exposes these JSON endpoints. Every check/why/reverse/who response carries an evidence `path` with ordered `nodes` and `edges` where applicable.

| Method | Route | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/check` | `{ target, action, depth }` | `CheckResponse`: verdict, owner, live/stale/dead/info decisions, note, `answer_id`, evidence path |
| `GET` | `/why/{decision}` | — | decision status, date, `sources`, `decided_by`, `supersedes`, premise chain, path |
| `POST` | `/reverse` | `{ old, new_id, new_title, dry_run }` | flips, affected people/answers, committed flag, path |
| `GET` | `/affected/{decision}` | — | ledger rows: person, answer id, time, summary, stale decision |
| `GET` | `/who/{target}` | — | owners via hierarchy and path |
| `GET` | `/load_bearing?limit=5` | — | ranked `{ id, title, score }` decisions |
| `GET` | `/graph` | — | whole graph `{ nodes, edges }` |
| `POST` | `/reset` | — | reseed the demo state |
| `POST` | `/ask` | `{ question }` | validated tool calls, deterministic check result, one-sentence explanation |

Actions are `delete`, `modify`, `add_dependency`, `remove_dependency`, and `deploy`. Depth is an integer from `1` to `6`. The backend should keep verdict calculation deterministic; agent language must not overrule the verdict or invent names that were not returned by the graph.

## Checks

```bash
npm run test
npm run build
```

The mock tests cover the hero depth flip, dry-run affected people, block, ungoverned, and unknown-target states.

## Honest boundaries

This is an advisory guardrail, not a firewall. “Used” in the ledger means a decision was retrieved for an answer through Gatekeeper; it does not prove what a person did afterward. The mock and live adapters implement the same UI contract, and the interface labels graph provenance from the records returned by the selected API.
