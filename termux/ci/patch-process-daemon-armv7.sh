#!/usr/bin/env bash
# Patch the pinned OpenCode v2.3.0 process-daemon build for Android ARMv7.
# Regenerates Ghostty bindings for the actual 32-bit Android C ABI.
set -euo pipefail

ROOT="${1:?usage: patch-process-daemon-armv7.sh /path/to/opencode}"
NDK="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-${NDK_HOME:-}}}"
API="${ANDROID_API_LEVEL:-29}"
TARGET="armv7-linux-androideabi"
ZIG_TARGET="arm-linux-androideabi"
CLANG_TARGET="armv7a-linux-androideabi${API}"

test -n "$NDK" && test -d "$NDK"
BUILD="$ROOT/packages/process-daemon/build.rs"
BINDINGS="$ROOT/packages/process-daemon/src/ghostty/ffi.rs"
SCRIPT="$ROOT/packages/process-daemon/script/ghostty-bindings"
test -s "$BUILD" && test -s "$BINDINGS" && test -x "$SCRIPT"

python3 - "$BUILD" "$ZIG_TARGET" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
zig_target = sys.argv[2]
s = p.read_text()
needle = '            "aarch64-unknown-linux-gnu" => "aarch64-linux-gnu",\n'
addition = needle + f'            "armv7-linux-androideabi" => "{zig_target}",\n'
old = '            "armv7-linux-androideabi" => "arm-linux-android",'
if old in s:
    s = s.replace(old, f'            "armv7-linux-androideabi" => "{zig_target}",')
elif f'"armv7-linux-androideabi" => "{zig_target}"' not in s:
    if s.count(needle) != 1:
        raise SystemExit("build.rs: expected one stable Android target insertion point")
    s = s.replace(needle, addition, 1)
p.write_text(s)
PY

export BINDGEN_EXTRA_CLANG_ARGS="--target=$CLANG_TARGET --sysroot=$NDK/toolchains/llvm/prebuilt/linux-x86_64/sysroot"
"$SCRIPT" "$ROOT/../ghostty"
grep -q 'armv7-linux-androideabi.*arm-linux-androideabi' "$BUILD"
grep -q 'Size of GhosttyString.*- 8usize' "$BINDINGS"
grep -q 'Alignment of GhosttyString.*- 4usize' "$BINDINGS"
echo "Patched process-daemon target to Zig androideabi softfp and regenerated 32-bit Android Ghostty bindings."
