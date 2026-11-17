#!/usr/bin/env bash
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT="${1:-$ROOT/dist/armv7-native-test-bundle}"
STAGE="$OUT/stage"
mkdir -p "$STAGE"/{native,tests,metadata}
cp -f "$ROOT"/libopentui-android-armv7.so "$STAGE/native/"
cp -f "$ROOT"/libnode-ffi-smoke.so "$STAGE/native/"
cp -f "$ROOT"/libpty-api-smoke-android-armv7.so "$STAGE/native/"
cp -f "$ROOT"/pty-forkexec-smoke-android-armv7 "$STAGE/native/"
cp -f "$ROOT"/libc++_shared-android-armv7.so "$STAGE/native/"
cp -f "$ROOT"/test-node-ffi-armv7.sh "$STAGE/tests/"
cp -f "$ROOT"/test-node-runtime-armv7.sh "$STAGE/tests/"
cp -f "$ROOT"/test-opentui-armv7.sh "$STAGE/tests/"
cp -f "$ROOT"/test-pty-api-armv7.sh "$STAGE/tests/"
cp -f "$ROOT"/test-pty-forkexec-armv7.sh "$STAGE/tests/"
cp -f "$ROOT"/node-ffi-smoke.mjs "$STAGE/tests/"
cp -f "$ROOT"/node-runtime-smoke.mjs "$STAGE/tests/"
cp -f "$ROOT"/node-opentui-load-smoke.mjs "$STAGE/tests/"
cp -f "$ROOT"/node-pty-api-smoke.mjs "$STAGE/tests/"
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
a complete node-pty addon, a complete Termux package, or end-to-end feature
validation. Do not install it as OpenCode.

On a Redmi 9A with the compatible Node.js ARMv7 runtime, extract this ZIP
and run the test scripts individually from the extracted directory.
The scripts report which tests require additional runtime files or user-side
execution. Preserve the metadata directory when reporting failures.
EOF
(
  cd "$OUT"
  rm -f GIKOKO-OPENCODE-ARM32-NATIVE-TEST-BUNDLE.zip
  zip -qr GIKOKO-OPENCODE-ARM32-NATIVE-TEST-BUNDLE.zip stage
)
echo "$OUT/GIKOKO-OPENCODE-ARM32-NATIVE-TEST-BUNDLE.zip"
