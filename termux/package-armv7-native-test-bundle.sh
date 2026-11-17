#!/usr/bin/env bash
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
OUT="${1:-$ROOT/dist/armv7-native-test-bundle}"
STAGE="$OUT/stage"
mkdir -p "$STAGE/metadata"
# Keep scripts and their default native-library paths together at the bundle root.
cp -f "$ROOT/libopentui-android-armv7.so" "$STAGE/"
cp -f "$ROOT/libnode-ffi-smoke.so" "$STAGE/"
cp -f "$ROOT/libpty-api-smoke-android-armv7.so" "$STAGE/"
cp -f "$ROOT/pty-forkexec-smoke-android-armv7" "$STAGE/"
cp -f "$ROOT/termux-pty-android-armv7.node" "$STAGE/"
cp -f "$ROOT/libc++_shared-android-armv7.so" "$STAGE/"
cp -f "$ROOT"/termux/test-node-ffi-armv7.sh "$STAGE/"
cp -f "$ROOT"/termux/test-node-runtime-armv7.sh "$STAGE/"
cp -f "$ROOT"/termux/test-opentui-armv7.sh "$STAGE/"
cp -f "$ROOT"/termux/test-pty-api-armv7.sh "$STAGE/"
cp -f "$ROOT"/termux/test-pty-forkexec-armv7.sh "$STAGE/"
cp -f "$ROOT"/termux/test-pty-napi-armv7.sh "$STAGE/"
cp -f "$ROOT"/termux/armv7/node-ffi-smoke.mjs "$STAGE/"
cp -f "$ROOT"/termux/armv7/node-runtime-smoke.mjs "$STAGE/"
cp -f "$ROOT"/termux/armv7/node-opentui-load-smoke.mjs "$STAGE/"
cp -f "$ROOT"/termux/armv7/node-pty-api-smoke.mjs "$STAGE/"
cp -f "$ROOT"/termux/armv7/node-pty-napi-smoke-armv7.mjs "$STAGE/"
cp -f "$ROOT"/*elf*.txt "$STAGE/metadata/" 2>/dev/null || true
cp -f "$ROOT"/*dynamic*.txt "$STAGE/metadata/" 2>/dev/null || true
cp -f "$ROOT"/opentui-exported-ot-symbols.txt "$STAGE/metadata/" 2>/dev/null || true
cp -f "$ROOT"/android-libc.txt "$STAGE/metadata/" 2>/dev/null || true
cp -f "$ROOT"/opentui-vendor-sha256.txt "$STAGE/metadata/" 2>/dev/null || true

cat > "$STAGE/README.txt" <<'EOF'
G.I KO KO OpenCode ARMv7 - Native Test Bundle

Target: Android 10 / Termux / armeabi-v7a / API 29

This is an intermediate native validation bundle, NOT a complete OpenCode
CLI installer. It contains OpenTUI and PTY experiments plus device test
scripts. It does not yet contain the OpenCode JavaScript application bundle,
the upstream node-pty integration, a complete Termux package, or end-to-end feature
validation. Do not install it as OpenCode.

Extract the ZIP into one directory on the Redmi 9A. From Termux, cd into
that directory and run the scripts:
  bash test-node-runtime-armv7.sh
  bash test-node-ffi-armv7.sh
  bash test-opentui-armv7.sh
  bash test-pty-api-armv7.sh
  bash test-pty-forkexec-armv7.sh
  bash test-pty-napi-armv7.sh

The tests use the colocated native libraries by default. Keep metadata/
when reporting failures.
EOF
(
  rm -f "$OUT/GIKOKO-OPENCODE-ARM32-NATIVE-TEST-BUNDLE.zip"
  cd "$STAGE"
  zip -qr "$OUT/GIKOKO-OPENCODE-ARM32-NATIVE-TEST-BUNDLE.zip" .
)
echo "$OUT/GIKOKO-OPENCODE-ARM32-NATIVE-TEST-BUNDLE.zip"
