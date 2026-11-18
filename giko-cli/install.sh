#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
install -m 0755 "$ROOT/src/index.mjs" "$BIN/gcode"
echo "Installed: $BIN/gcode"
echo "Run: gcode --version"
