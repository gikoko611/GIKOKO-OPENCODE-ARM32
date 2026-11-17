#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-$PREFIX/bin/node}"
LIB="${1:-$HERE/libopentui-android-armv7.so}"
SCRIPT="$HERE/opentui-native-smoke.mjs"

if [ ! -x "$NODE_BIN" ]; then
  echo "[FAIL] Termux Node not found: $NODE_BIN" >&2
  exit 1
fi
if [ ! -s "$LIB" ]; then
  echo "[FAIL] OpenTUI ARMv7 library not found: $LIB" >&2
  echo "Extract the GitHub Actions artifact into one directory, then run this script." >&2
  exit 1
fi
if [ ! -s "$SCRIPT" ]; then
  echo "[FAIL] OpenTUI test script missing: $SCRIPT" >&2
  exit 1
fi

echo "Node: $("$NODE_BIN" --version)"
echo "Arch: $("$NODE_BIN" -p 'process.arch')"
echo "Platform: $("$NODE_BIN" -p 'process.platform')"
echo "Library: $LIB"
exec "$NODE_BIN" --experimental-ffi "$SCRIPT" "$LIB"
