#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-$PREFIX/bin/node}"
SCRIPT="$HERE/node-runtime-smoke.mjs"
[ -x "$NODE_BIN" ] || { echo "[FAIL] Termux Node not found: $NODE_BIN" >&2; exit 1; }
[ -s "$SCRIPT" ] || { echo "[FAIL] Missing test script: $SCRIPT" >&2; exit 1; }
echo "Node: $("$NODE_BIN" --version)"
exec "$NODE_BIN" "$SCRIPT"
