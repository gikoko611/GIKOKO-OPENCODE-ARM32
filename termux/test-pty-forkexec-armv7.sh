#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
BIN="${1:-$PWD/pty-forkexec-smoke-android-armv7}"
[ -x "$BIN" ] || { echo "[FAIL] Missing executable: $BIN" >&2; exit 1; }
echo "Device: $(getprop ro.product.model 2>/dev/null || echo Android)"
echo "Kernel: $(uname -m)"
file "$BIN" 2>/dev/null || true
exec "$BIN"
