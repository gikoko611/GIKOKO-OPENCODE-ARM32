# ARMv7 Node / OpenTUI compatibility audit

## Scope
Evaluate upstream OpenCode v2.3.0 for Termux ARMv7 (Android 10/API 29, 32-bit `armeabi-v7a`). Static package inspection is not runtime validation.

## Node.js path
OpenCode v2.3.0 has Node-specific import branches for SQLite, PTY, filesystem search, image WASM, TLS, and TUI helpers. Its Node SEA build target matrix does not support Android/ARM32. A Termux distribution may need to ship the JS bundle with the Termux Node runtime instead of a SEA binary.

Termux Node package preflight run `43999676467` verified the package checksum and identified its executable as ELF32 ARM EABI5. This does not prove runtime dependencies or OpenCode integration work on the Redmi 9A.

## OpenTUI source and target investigation
Pinned upstream OpenTUI v0.8.3. Its native `build.zig` officially lists Linux x86_64/aarch64 (glibc and musl), macOS x86_64/aarch64, and Windows x86_64/aarch64. Android and ARMv7 are not included, and the matching core package manifest has no Android ARMv7 optional package.

A custom-target experiment ran:
```sh
zig build -Dlibrary-target=arm-linux-android.29 -Doptimize=ReleaseFast --summary all
```
Workflow run `44004450442` reached compilation but failed in three `zig translate-c -lc` steps. The translator resolved Ubuntu host glibc header `/usr/include/x86_64-linux-gnu/gnu/stubs.h`, which attempted to include missing `gnu/stubs-32.h`. No ARMv7 shared library was produced. This is a confirmed cross-sysroot/header configuration failure, not evidence of a working Android target.

The next attempt must configure a real Android NDK/Bionic sysroot for Zig C translation and linking. Merely changing the target triple or package name is insufficient. A successful ELF build would still require Node FFI and on-device terminal-rendering tests.

## Native package probes
Node compatibility audit run `44004450476` completed as a registry/metadata audit. Candidate releases were found for `@lydell/node-pty`, `@parcel/watcher`, `@ff-labs/fff-node`, and `@silvia-odwyer/photon-node`; package existence does not prove Android Bionic ARMv7 prebuilds or source-build compatibility. No `@androidtui/core-android-arm` or `@androidtui/core-android-armv7` package was found.

## Confirmed blockers
1. Node SEA target matrix excludes Android and 32-bit ARM.
2. OpenTUI has no official Android ARMv7 target/package; the custom-target experiment failed on host glibc headers.
3. PTY's Node adapter needs an Android Bionic ARMv7 addon or a tested Termux-native adapter.
4. File watching/search and other native npm dependencies need ARMv7 Android builds or tested fallbacks.
5. Static ELF inspection does not test dynamic linking, FFI, child processes, signals, terminal I/O, or native addons on-device.

## Implementation sequence
1. Keep the current AArch64 release workflow unchanged.
2. Configure and validate Zig's Android NDK/Bionic sysroot before retrying OpenTUI.
3. Build/test the OpenTUI ARMv7 shared library and Node FFI.
4. Build/test PTY and remaining native dependencies.
5. Bundle upstream OpenCode JS with a compatible Termux Node runtime.
6. Run end-to-end tests on Redmi 9A / Android 10 / 32-bit Termux before enabling release.

## Feature preservation
Do not remove agents, providers, tools, MCP, LSP, sessions, permissions, plugins, or server/web functionality to make the build pass. Report unavailable optional integrations explicitly.

## Upstream references
- https://github.com/anomalyco/opencode/blob/dev/packages/cli/script/build-node.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/core/package.json
- https://github.com/anomalyco/opencode/blob/dev/packages/core/src/pty/pty.node.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/tui/package.json
- https://github.com/anomalyco/opentui/blob/v0.8.3/packages/native/build.zig
