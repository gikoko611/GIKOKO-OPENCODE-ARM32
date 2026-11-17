#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?usage: audit-armv7-persistent-pty.sh /path/to/opencode-v2.3.0}"
test -s "$ROOT/packages/process-daemon/Cargo.toml"
test -s "$ROOT/packages/process-daemon/build.rs"
test -s "$ROOT/packages/process-daemon/src/ghostty/ffi.rs"
test -s "$ROOT/packages/process-daemon/npm/package.json"
test -s "$ROOT/packages/cli/script/opencode-pty.ts"

CARGO="$ROOT/packages/process-daemon/Cargo.toml"
BUILD="$ROOT/packages/process-daemon/build.rs"
FFI="$ROOT/packages/process-daemon/src/ghostty/ffi.rs"
NPM="$ROOT/packages/process-daemon/npm/package.json"
RESOLVER="$ROOT/packages/cli/script/opencode-pty.ts"

grep -q 'version = "0.5.2"' "$CARGO"
grep -q 'unsupported Ghostty target' "$BUILD"
grep -q 'GhosttyString' "$FFI"
grep -q 'size_of::<GhosttyString>() - 16usize' "$FFI"
grep -q 'align_of::<GhosttyString>() - 8usize' "$FFI"
grep -q '@opencode/pty-linux-arm64-gnu' "$NPM"
grep -q '@opencode/pty-win32-arm64' "$NPM"
grep -q 'target.arch !== "arm64" && target.arch !== "x64"' "$RESOLVER"

if grep -q 'arm-linux-android' "$BUILD"; then
  echo "NOTICE: upstream build.rs now mentions Android ARM; review the target mapping before updating this audit."
fi

cat <<'EOF'
Persistent PTY ARMv7 audit: BLOCKED (expected for pinned v2.3.0)
- Rust daemon build.rs has no Android ARMv7 target mapping.
- Ghostty FFI declarations contain 64-bit-only layout assertions.
- @opencode/pty optional binary packages have no Android ARMv7 artifact.
- CLI resolver rejects Android and 32-bit ARM.
- Do not substitute the standalone forkpty addon: it does not implement protocol 8.
EOF
