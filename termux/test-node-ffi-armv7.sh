#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-$PREFIX/bin/node}"
LIB="${1:-$HERE/armv7/libnode-ffi-smoke.so}"
SCRIPT="$HERE/armv7/node-ffi-smoke.mjs"

if [ ! -x "$NODE_BIN" ]; then
  echo "[FAIL] Termux Node not found: $NODE_BIN" >&2
  exit 1
fi
if [ ! -s "$LIB" ]; then
  echo "[FAIL] ARMv7 FFI test library not found: $LIB" >&2
  echo "Place libnode-ffi-smoke.so beside the extracted test files or pass its path." >&2
  exit 1
fi
if [ ! -s "$SCRIPT" ]; then
  echo "[FAIL] Test script missing: $SCRIPT" >&2
  exit 1
fi

echo "Node: $("$NODE_BIN" --version)"
echo "Arch: $("$NODE_BIN" -p 'process.arch')"
echo "Library: $LIB"
exec "$NODE_BIN" --experimental-ffi "$SCRIPT" "$LIB"
