#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
install -m 0755 "$ROOT/src/index.mjs" "$BIN/giko"
echo "Installed: $BIN/giko"
echo "Run: giko --version"
