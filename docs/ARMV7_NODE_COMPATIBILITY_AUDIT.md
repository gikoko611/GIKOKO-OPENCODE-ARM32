# ARMv7 Node / OpenTUI compatibility audit

## Scope
Evaluate upstream OpenCode v2.3.0 for Termux ARMv7 (Android 10/API 29, 32-bit `armeabi-v7a`). Static package inspection is not runtime validation.

## Node.js path
OpenCode v2.3.0 has Node-specific import branches for SQLite, PTY, filesystem search, image WASM, TLS, and TUI helpers. Its Node SEA build target matrix does not support Android/ARM32. A Termux distribution may need to ship the JS bundle with the Termux Node runtime instead of a SEA binary.

Termux Node package preflight run `43999676467` verified the package checksum and identified its executable as ELF32 ARM EABI5. This does not prove runtime dependencies or OpenCode integration work on the Redmi 9A.

## OpenTUI source and target investigation
Pinned upstream OpenTUI v0.8.3. Its native `build.zig` officially lists Linux x86_64/aarch64 (glibc and musl), macOS x86_64/aarch64, and Windows x86_64/aarch64. Android and ARMv7 are not included, and the matching core package manifest has no Android ARMv7 optional package.

The first custom-target attempts exposed host-header, 64-bit ABI, atomic, C++ flag, and NDK startup-object path issues. These were addressed in the isolated ARMv7 experiment workflow. **Run `44018098285` succeeded (13/13 steps)** and produced `libopentui.so`, verified as ELF32 little-endian ARM EABI5. Its dynamic section references Android Bionic `libc.so`, `libdl.so`, and `libm.so`; no glibc `libc.so.6` or `ld-linux` dependency was found. The experiment applies a 32-bit ABI sizing/overflow-safe record-size patch and C-backed 64-bit atomic operations for ARMv7.

This proves the native library can be cross-compiled, but does not yet prove Node FFI can load it or that terminal rendering works on-device. See [successful build artifact](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44018098285).

## OpenTUI Node FFI source audit

Pinned OpenTUI v0.8.3 already implements a Node backend using `node:ffi`; the package declares Node >=26.4.0. Its generated native ABI currently has 366 symbol declarations and no `usize` types, avoiding one explicit Node-backend limitation in that table. However, OpenTUI's Node asset-target resolver only accepts `arm64` and `x64`, and it previously evaluated that target before honoring `OPENTUI_LIB_PATH`. The ARMv7 experiment workflow now patches the resolver to check the explicit path first. This is a source-level integration patch only; Node FFI loading and native calls still require runtime/device validation.

## Native package probes
Node compatibility audit run `44004450476` completed as a registry/metadata audit. Candidate releases were found for `@lydell/node-pty`, `@parcel/watcher`, `@ff-labs/fff-node`, and `@silvia-odwyer/photon-node`; package existence does not prove Android Bionic ARMv7 prebuilds or source-build compatibility. No `@androidtui/core-android-arm` or `@androidtui/core-android-armv7` package was found.

## Confirmed blockers
1. Node SEA target matrix excludes Android and 32-bit ARM.
2. OpenTUI v0.8.3's native ABI is explicitly 64-bit-only; ARMv7 needs a source/ABI port, 32-bit-safe atomic fallbacks, and corrected Android float-ABI flags.
3. PTY's Node adapter needs an Android Bionic ARMv7 addon or a tested Termux-native adapter.
4. File watching/search and other native npm dependencies need ARMv7 Android builds or tested fallbacks.
5. Static ELF inspection does not test dynamic linking, FFI, child processes, signals, terminal I/O, or native addons on-device.

## Implementation sequence
1. Keep the current AArch64 release workflow unchanged.
2. Port OpenTUI's C ABI and native implementation to 32-bit (pointer/handle layout, scene record sizing, and `u64` atomic fallbacks); fix the Android ARMv7 C/C++ float-ABI flags.
3. Build/test the OpenTUI ARMv7 shared library and Node FFI against the Bionic sysroot.
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
