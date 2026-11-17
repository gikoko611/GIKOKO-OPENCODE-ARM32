#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-$PREFIX/bin/node}"
LIB="${1:-$HERE/libpty-api-smoke-android-armv7.so}"
SCRIPT="$HERE/armv7/node-pty-api-smoke.mjs"
[ -s "$SCRIPT" ] || SCRIPT="$HERE/node-pty-api-smoke.mjs"
[ -x "$NODE_BIN" ] || { echo "[FAIL] Termux Node not found: $NODE_BIN" >&2; exit 1; }
[ -s "$LIB" ] || { echo "[FAIL] PTY probe library not found: $LIB" >&2; exit 1; }
[ -s "$SCRIPT" ] || { echo "[FAIL] PTY probe script not found: $SCRIPT" >&2; exit 1; }
echo "Node: $("$NODE_BIN" --version)"
exec "$NODE_BIN" --experimental-ffi "$SCRIPT" "$LIB"
