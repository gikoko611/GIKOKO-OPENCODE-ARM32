#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-$PREFIX/bin/node}"
LIB="${1:-$HERE/libopentui-android-armv7.so}"
SCRIPT="$HERE/node-opentui-load-smoke.mjs"
[ -x "$NODE_BIN" ] || { echo "[FAIL] Termux Node not found: $NODE_BIN" >&2; exit 1; }
[ -s "$LIB" ] || { echo "[FAIL] OpenTUI ARMv7 library not found: $LIB" >&2; exit 1; }
[ -s "$SCRIPT" ] || { echo "[FAIL] Missing test script: $SCRIPT" >&2; exit 1; }
echo "Node: $("$NODE_BIN" --version)"
echo "Library: $LIB"
exec "$NODE_BIN" --experimental-ffi "$SCRIPT" "$LIB"
