# ARMv7 Node / OpenTUI compatibility audit

## Scope
Evaluate upstream OpenCode v2.3.0 for Termux ARMv7 (Android 10/API 29, 32-bit `armeabi-v7a`). Static package inspection is not runtime validation.

## Node.js path
OpenCode v2.3.0 has Node-specific import branches for SQLite, PTY, filesystem search, image WASM, TLS, and TUI helpers. Its Node SEA build target matrix does not support Android/ARM32. A Termux distribution may need to ship the JS bundle with the Termux Node runtime instead of a SEA binary.

Termux Node package preflight run `43999676467` verified the package checksum and identified its executable as ELF32 ARM EABI5. This does not prove runtime dependencies or OpenCode integration work on the Redmi 9A.

## OpenTUI source and target investigation
Pinned upstream OpenTUI v0.8.3. Its native `build.zig` officially lists Linux x86_64/aarch64 (glibc and musl), macOS x86_64/aarch64, and Windows x86_64/aarch64. Android and ARMv7 are not included, and the matching core package manifest has no Android ARMv7 optional package.

A custom-target experiment first exposed a host-glibc header leak. The subsequent NDK/Bionic sysroot attempt (workflow run `44011061039`) got past translate-C and the separate `dl`/`pthread`/`m` link stage, but failed inside OpenTUI v0.8.3 itself:
- `src/context-abi.zig` explicitly rejects non-64-bit targets (`The OpenTUI C ABI requires a 64-bit target`).
- `src/scene-record.zig` asserts `@sizeOf(usize) >= 8`.
- Multiple `u64` atomics in OpenTUI and Zig std are unsupported for this ARMv7 target.
- The C++ sub-build rejects `-mfloat-abi=hard` for the selected Android target.

No ARMv7 shared library was produced. The remaining work is a genuine ARM32 port of the native ABI and implementation, not another sysroot or library-name tweak. A successful native build would still require Node FFI and on-device terminal-rendering tests.

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
