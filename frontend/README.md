# Gatekeeper frontend

Gatekeeper is a pre-action checkpoint console for people and agents. It follows recorded decision premises before an action and shows the evidence path behind each result. The frontend uses a deterministic, stateful synthetic mock by default.

## What the console includes

- **Checkpoint console:** check a target, action, and trace depth.
- **Depth contrast:** compare a shallow check with a deeper dependency traversal.
- **Reverse with dry run:** preview affected verdicts and people before committing a replacement decision.
- **Affected people ledger:** inspect answers linked to superseded premises.
- **Why drawer:** inspect a decision’s recorded source, owner, premises, and supersession record.
- **Graph explorer:** browse the fixture’s artifacts, decisions, people, sources, and relationships.
- **Agent mode:** send a canned or typed request through a validated tool router. Deterministic API/engine code supplies the verdict; language model text never determines or overrides it.

## Verdicts

| Verdict | Meaning |
| --- | --- |
| `BLOCK` | A recorded prohibition covers the action. |
| `ESCALATE` | A live rule requires an owner or team to approve. |
| `STALE` | A premise is no longer live; confirm with the owner before acting. |
| `ALLOW` | Only historical or informational decisions cover the action; no live constraint applies. |
| `UNGOVERNED` | No applicable rule is recorded. This is **not safe** and is never presented as a safe result. |
| `UNKNOWN_TARGET` | The supplied name does not resolve to a recorded artifact. |

Meaning is conveyed with labels, explanatory text, icons/patterns, and border styles, not color alone. The UI displays returned verdicts; it does not decide them.

## Run locally

```bash
npm ci
npm run dev -- --port 5190 --strictPort
```

Open <http://localhost:5190>. The ordinary mode defaults to the mock API. `?demo=1` opens the guided recording flow, hides the top bar, and forces mock mode.

To try the main mock flow:

1. Check `file:compat/win7_shim.js` with `delete`.
2. Compare depth 1 with depth 4 in the depth contrast.
3. In **Reverse a Decision**, preview and commit `D1 → D4`.
4. Recheck: depth 1 remains `ESCALATE`, while depth 4 becomes `STALE`.
5. Try `package:moment` with `add_dependency`, then `file:docs/readme.md` with `delete`.

The guided demo uses the mock mode selected by `?demo=1`; its prompts and fixture are deterministic.

## Mock and live API settings

The frontend reads these Vite variables in `src/api/client.ts`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` (mock unless the value is exactly `false`) | Select mock or HTTP API mode. `?demo=1` always forces mock mode. |
| `VITE_API_URL` | `http://localhost:8000` | Base URL for live API requests. |
| `VITE_VIEWER` | `anonymous` | Value sent as the `X-Viewer` header. |
| `VITE_RESET_TOKEN` | unset | Optional `X-Reset-Token` header for reset requests. |

Copy `.env.example` to `.env.local` and set `VITE_USE_MOCK=false` plus `VITE_API_URL` for a local backend. The live adapter calls `/check`, `/why/{decision}`, `/reverse`, `/affected/{decision}`, `/who/{target}`, `/load_bearing`, `/graph`, `/reset`, `/ask`, `/targets`, `/decisions`, and `/audit`. Live mode was not exercised as part of this frontend verification.

The HTTP adapter is in `src/api/client.ts`; the frontend request and response types are in `src/api/types.ts`. The mock implementation is in `src/api/mockApi.ts` and is used by the mock API scenario tests. Both adapters implement the `GatekeeperApi` interface.

## API contract

The HTTP adapter sends JSON requests to these routes. The frontend types include an evidence `path` with ordered `nodes` and `edges` on check, why, reverse, affected, and owner responses.

| Method | Route | Request | Response type |
| --- | --- | --- | --- |
| `POST` | `/check` | `{ target, action, depth }` | `CheckResponse`: verdict, owner, live/stale/dead/info decisions, note, `answer_id`, path |
| `GET` | `/why/{decision}` | — | `WhyResponse`: status, date, sources, decider, supersession, premises, path |
| `POST` | `/reverse` | `{ old, new_id, new_title, dry_run }` | `ReverseResponse`: flips, affected people, committed flag, path |
| `GET` | `/affected/{decision}` | — | `AffectedResponse`: decision, ledger rows, path |
| `GET` | `/who/{target}` | — | `WhoResponse`: owners and path |
| `GET` | `/load_bearing?limit=5` | — | ranked `LoadBearingItem[]` |
| `GET` | `/graph` | — | `GraphResponse`: graph nodes and edges |
| `POST` | `/reset` | — | `ResetResponse`: reset status, fixture counts, path |
| `POST` | `/ask` | `{ question }` | `AskResponse`: tool calls, check result, explanation, name verification |
| `GET` | `/targets` | — | `TargetItem[]` |
| `GET` | `/decisions` | — | `DecisionItem[]` |
| `GET` | `/audit` | — | `AuditResponse` |

Actions are `delete`, `modify`, `add_dependency`, `remove_dependency`, and `deploy`. The console offers trace depths 1, 4, and 6. Agent text does not override the returned check result.

## Data and provenance

The built-in fixture is synthetic. Provenance badges distinguish `REAL`, `CURATED`, and `SYNTHETIC` records and edges; a badge describes provenance, not truth or permission. The mock API is stateful, so reversing `D1` changes later deep checks and its affected ledger. The ledger’s current implementation requests affected answers for `D1`.

## Checks

```bash
npm test
npx tsc --noEmit
npm run build
```

The Vitest suite contains 4 test files and 19 tests. API scenario tests exercise `MockApi` only; the suite also includes API error-mapping and rendered-component tests. It makes no live API calls. Coverage includes the stateful reversal/depth flow, block and ungoverned checks, unknown targets, verdict labels, reset, and canned agent routing. There are no automated browser tests.

## Design

Palette: `#FF6D29` orange, `#453027` brown, `#161316` ink, `#BABABA` grey, and `#FFFFFF` white. The font stack is Neue Montreal, Helvetica Neue, Arial, system UI, and sans-serif; no font files are bundled.

## Screenshots

No screenshots are included in this revision.

## AI disclosure

Built with AI assistance from Codex and Antigravity; the author reviewed the code.

## Limitations

- Verification was mock-only; live backend mode was not run. Docker is unavailable on this machine and `127.0.0.1:6379` did not accept a connection when checked.
- `LedgerPanel` calls `api.affected('D1')` directly.
- There are no automated browser tests.
- Exact 390px layout and browser console behavior were not verified.
- The canned agent response was not verified in a browser; its API routing is covered by the mock unit tests.

This is an advisory prototype, not an enforcement layer. A ledger row records that a decision was retrieved for an answer; it does not prove a later action occurred.
