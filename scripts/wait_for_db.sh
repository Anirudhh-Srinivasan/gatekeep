#!/usr/bin/env bash
set -euo pipefail

host="${FALKORDB_HOST:-127.0.0.1}"
port="${FALKORDB_PORT:-6379}"
timeout="${FALKORDB_WAIT_TIMEOUT:-30}"

if command -v redis-cli >/dev/null 2>&1; then
  ping_db() { [[ "$(redis-cli -h "$host" -p "$port" ping 2>/dev/null || true)" == "PONG" ]]; }
else
  python_bin="${PYTHON_BIN:-}"
  if [[ -z "$python_bin" && -x "$(dirname "$0")/../engine/.venv/bin/python" ]]; then
    python_bin="$(dirname "$0")/../engine/.venv/bin/python"
  fi
  if [[ -z "$python_bin" ]]; then
    python_bin="python3"
  fi
  if ! "$python_bin" -c 'import redis' >/dev/null 2>&1; then
    printf 'error: redis-cli or a Python interpreter with redis is required to check FalkorDB at %s:%s\n' "$host" "$port" >&2
    exit 1
  fi
  ping_db() { "$python_bin" - "$host" "$port" <<'PY'
import sys
import redis

try:
    redis.Redis(host=sys.argv[1], port=int(sys.argv[2]), socket_connect_timeout=1).ping()
except Exception:
    raise SystemExit(1)
PY
  }
fi

deadline=$((SECONDS + timeout))
while (( SECONDS < deadline )); do
  if ping_db; then
    printf 'FalkorDB is ready at %s:%s\n' "$host" "$port"
    exit 0
  fi
  sleep 1
done

printf 'error: FalkorDB did not answer within %ss at %s:%s\n' "$timeout" "$host" "$port" >&2
exit 1
