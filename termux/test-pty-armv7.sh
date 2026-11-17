#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${1:-$HERE/armv7-pty-smoke}"
if [ ! -x "$BIN" ]; then
  echo "[FAIL] ARMv7 PTY smoke binary not found or not executable: $BIN" >&2
  echo "Extract armv7-pty-bionic-probe artifact into this directory first." >&2
  exit 1
fi
echo "Device ABI: $(getprop ro.product.cpu.abi 2>/dev/null || echo unknown)"
echo "Kernel: $(uname -m)"
exec "$BIN"
