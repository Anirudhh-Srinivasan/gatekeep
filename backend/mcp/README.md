# Gatekeeper MCP server

The MCP adapter exposes the deterministic `Gatekeeper` engine to an MCP client.
It does not contain Cypher or verdict logic. Call `check_action` before a risky
action and inspect the returned `path`; `STALE` is not permission,
`UNGOVERNED` is not safe, and `UNKNOWN_TARGET` means the target is not recorded.

## Run over stdio

From the repository root, with FalkorDB running and the backend virtualenv
installed:

```bash
FALKORDB_HOST=127.0.0.1 FALKORDB_PORT=6380 FALKORDB_GRAPH=gatekeeper \
PYTHONPATH="$PWD/engine" "$PWD/backend/.venv/bin/python" "$PWD/backend/mcp/server.py"
```

The default tool catalogue is:

- `check_action(target, action, depth=6, client_name="mcp-agent")`
- `why(decision)`
- `who(target)`
- `affected(decision)`
- `list_targets()`
- `list_decisions()`
- `audit()`
- `reverse_preview(old, new_id, new_title)`

`reverse_commit` is not registered unless `GATEKEEPER_MCP_ALLOW_WRITE=1` is
explicitly set in the server environment. This prevents an agent from changing
company decisions by default. The write-enabled process should be isolated and
human-authorized; an MCP client cannot make a write safe merely by requesting it.

## Client configuration snippets

Replace every `/ABSOLUTE/PATH/TO/gatekeep` placeholder. The snippets use port
`6380` because that is the host port used by the project machine; use the actual
value of `FALKORDB_PORT` for another environment.

### Claude Desktop

Add this server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gatekeeper": {
      "command": "/ABSOLUTE/PATH/TO/gatekeep/backend/.venv/bin/python",
      "args": ["/ABSOLUTE/PATH/TO/gatekeep/backend/mcp/server.py"],
      "env": {
        "PYTHONPATH": "/ABSOLUTE/PATH/TO/gatekeep/engine",
        "FALKORDB_HOST": "127.0.0.1",
        "FALKORDB_PORT": "6380",
        "FALKORDB_GRAPH": "gatekeeper"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add gatekeeper \
  --env PYTHONPATH=/ABSOLUTE/PATH/TO/gatekeep/engine \
  --env FALKORDB_HOST=127.0.0.1 \
  --env FALKORDB_PORT=6380 \
  --env FALKORDB_GRAPH=gatekeeper \
  -- /ABSOLUTE/PATH/TO/gatekeep/backend/.venv/bin/python \
  /ABSOLUTE/PATH/TO/gatekeep/backend/mcp/server.py
```

### Cursor

Add the equivalent server to Cursor's MCP settings:

```json
{
  "mcpServers": {
    "gatekeeper": {
      "command": "/ABSOLUTE/PATH/TO/gatekeep/backend/.venv/bin/python",
      "args": ["/ABSOLUTE/PATH/TO/gatekeep/backend/mcp/server.py"],
      "env": {
        "PYTHONPATH": "/ABSOLUTE/PATH/TO/gatekeep/engine",
        "FALKORDB_HOST": "127.0.0.1",
        "FALKORDB_PORT": "6380",
        "FALKORDB_GRAPH": "gatekeeper"
      }
    }
  }
}
```

## What was tested

The repository tests use the official Python `mcp` SDK client and an in-memory
server/client transport against a real FalkorDB graph. They also start the
documented server file as a subprocess and initialize it over stdio. Claude
Desktop, Claude Code, and Cursor were not installed here, so their snippets
were written but those applications were not tested.

Run the MCP tests with:

```bash
cd backend
FALKORDB_HOST=127.0.0.1 FALKORDB_PORT=6380 \
PYTHONPATH=.:../engine .venv/bin/pytest mcp/tests -q
```

The server also accepts `MCP_TRANSPORT=streamable-http` for the SDK's optional
HTTP transport. Stdio is the supported/default integration for local agent
clients.
