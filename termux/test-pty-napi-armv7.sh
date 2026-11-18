#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-$PREFIX/bin/node}"
ADDON="${1:-$HERE/termux-pty-android-armv7.node}"
SCRIPT="$HERE/node-pty-napi-smoke-armv7.mjs"
[ -x "$NODE_BIN" ] || { echo "[FAIL] Termux Node not found: $NODE_BIN" >&2; exit 1; }
[ -s "$ADDON" ] || { echo "[FAIL] Node-API PTY addon not found: $ADDON" >&2; exit 1; }
[ -s "$SCRIPT" ] || { echo "[FAIL] Node-API PTY smoke script not found: $SCRIPT" >&2; exit 1; }
echo "Node: $("$NODE_BIN" --version)"
exec "$NODE_BIN" "$SCRIPT" "$ADDON"
