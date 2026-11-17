#!/usr/bin/env bash
# Install the Android ARMv7 Node PTY adapter into a prepared upstream tree.
set -euo pipefail

TARGET="${1:?usage: apply-armv7-pty-adapter.sh <opencode-tree>}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$REPO_ROOT/termux/armv7/pty-termux.node.ts"
DEST="$TARGET/packages/core/src/pty/pty.termux.node.ts"
ENTRY="$TARGET/packages/core/src/pty/pty.node.ts"

[ -s "$SOURCE" ] || { echo "Missing ARMv7 PTY adapter: $SOURCE" >&2; exit 1; }
[ -s "$ENTRY" ] || { echo "Missing upstream Node PTY entry: $ENTRY" >&2; exit 1; }
mkdir -p "$(dirname "$DEST")"
install -m 0644 "$SOURCE" "$DEST"

python3 - "$ENTRY" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
import_line = 'import { spawn as spawnTermux } from "./pty.termux.node.js"\n'
if import_line not in source:
    anchor = 'import type { Opts, Proc } from "./pty.js"\n'
    if source.count(anchor) != 1:
        raise SystemExit("pty.node.ts: could not locate stable import anchor")
    source = source.replace(anchor, anchor + import_line, 1)

anchor = 'function spawnPty(file: string, args: string[], opts: Opts): Proc {\n'
branch = '  if (process.platform === "android" && process.arch === "arm") return spawnTermux(file, args, opts)\n'
if branch not in source:
    if source.count(anchor) != 1:
        raise SystemExit("pty.node.ts: could not locate spawnPty function")
    source = source.replace(anchor, anchor + branch, 1)

path.write_text(source)
print("Installed Android ARMv7 Node PTY adapter without changing other platform paths.")
PY

grep -n -A5 -B2 'spawnTermux' "$ENTRY"
test -s "$DEST"
