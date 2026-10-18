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
| `ALLOW` | A live recorded rule permits the scoped action. |
| `UNGOVERNED` | No applicable rule is recorded. This is **not safe** and is never presented as a safe result. |
| `UNKNOWN_TARGET` | The supplied name does not resolve to a recorded artifact. |

Meaning is conveyed with labels, explanatory text, icons/patterns, and border styles, not color alone. The UI displays returned verdicts; it does not decide them.

## Run locally

```bash
npm ci
npm run dev -- --port 5190 --strictPort
```

Open <http://localhost:5190>. The ordinary mode defaults to the mock API. `?demo=1` opens the guided recording flow, hides the top bar, and forces mock mode.

## Mock and live API settings

The frontend reads these Vite variables in `src/api/client.ts`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` (mock unless the value is exactly `false`) | Select mock or HTTP API mode. `?demo=1` always forces mock mode. |
| `VITE_API_URL` | `http://localhost:8000` | Base URL for live API requests. |
| `VITE_VIEWER` | `anonymous` | Value sent as the `X-Viewer` header. |
| `VITE_RESET_TOKEN` | unset | Optional `X-Reset-Token` header for reset requests. |

Copy `.env.example` to `.env.local` and set `VITE_USE_MOCK=false` plus `VITE_API_URL` for a local backend. The live adapter calls `/check`, `/why/{decision}`, `/reverse`, `/affected/{decision}`, `/who/{target}`, `/load_bearing`, `/graph`, `/reset`, `/ask`, `/targets`, `/decisions`, and `/audit`. Live mode was not exercised as part of this frontend verification.

## Data and provenance

The built-in fixture is synthetic. Provenance badges distinguish `REAL`, `CURATED`, and `SYNTHETIC` records and edges; a badge describes provenance, not truth or permission. The mock API is stateful, so reversing `D1` changes later deep checks and its affected ledger. The ledger’s current implementation requests affected answers for `D1`.

## Checks

```bash
npm test
npx tsc --noEmit
npm run build
```

The Vitest suite contains 4 test files and 19 tests. They run against the mock API and cover client behavior, verdict labels, the stateful reversal/depth flow, block and ungoverned checks, and agent demo routing. There are no automated browser tests.

## Design

Palette: `#FF6D29` orange, `#453027` brown, `#161316` ink, `#BABABA` grey, and `#FFFFFF` white. The font stack is Neue Montreal with Helvetica Neue and Arial fallbacks; no font files are bundled.

## Screenshots

No viewport-accurate screenshots are included in this revision. The app was visually inspected in the available Chrome window, but image files could not be saved for the requested exact viewport sizes.

## AI disclosure

Built with AI assistance from Codex and Antigravity; the author reviewed the code.

## Limitations

- Live backend mode was not verified. The checked-in frontend configuration defaults to the mock API.
- The affected people ledger currently queries `D1` directly.
- There are no automated browser tests.
- The design pass was visually observed in Chrome at the available desktop window size; exact 1440×900, 1920×1080, and 390×844 captures and glow pixel-step measurements were not obtained.

This is an advisory prototype, not an enforcement layer. A ledger row records that a decision was retrieved for an answer; it does not prove a later action occurred.
