# ARMv7 / 32-bit Android port status

## Target device

- Android 10 / API 29
- Termux on 32-bit ARM userspace
- ABI: `armeabi-v7a`
- ELF target: ELF32, little-endian ARM (EABI5, `e_machine=40`)
- Do not accept AArch64 binaries (`e_machine=183`) as ARMv7 output.

## Current state: blocked at runtime prerequisites

The current build pipeline is an AArch64/Bionic pipeline copied from the upstream `bd-loser/opencode-bionic` layout. It is not an ARMv7 build yet. In particular:

1. The pinned `bun-termux` runtime package is named for `aarch64` and the current Bun-for-Termux project documents AArch64 support, not ARMv7.
2. The pinned OpenTUI Android native package is `@androidtui/core-android-arm64`; it is not an ARMv7 shared library.
3. The PTY shared library and PTY service assets are AArch64.
4. CI runs an AArch64 Termux Docker image and validates 64-bit ELF machine type.

Changing architecture strings, Debian package metadata, or runner labels alone would produce a broken package. The release workflow must remain AArch64-only until every required runtime/native component has an actual ARMv7 build and passes device tests.

## Alternative runtime investigation

A Node.js-based route is now being evaluated because OpenTUI documents Node.js 26.4.0+ with ESM and `--experimental-ffi`, and Termux publishes a 32-bit `arm` Node.js package. This does not establish OpenCode compatibility: OpenCode's Bun-specific APIs/build pipeline, an Android ARMv7 OpenTUI Zig renderer, and a PTY backend still require implementation and on-device tests. See [ARMv7 Node.js runtime investigation](ARMV7_NODE_RUNTIME_PATH.md).

Do not switch the release pipeline to Node.js or mark the port ready until every proof gate in that investigation passes.

## Feature-preservation policy

The upstream 2.3.0 source includes Node-specific branches for SQLite, PTY, filesystem search, TLS, and TUI helpers. The Node route is now the preferred investigation path; see [Node compatibility audit](ARMV7_NODE_COMPATIBILITY_AUDIT.md). The port must retain upstream OpenCode source and its agent/provider/tool/session behavior. Platform work should be isolated to the runtime, native TUI, PTY, packaging, and launch integration. Do not remove MCP, LSP, provider integrations, tools, permissions, sessions, or web UI just to make a build pass.

If a native dependency has no ARMv7 implementation, report it as blocked or implement a tested fallback. Never silently omit the feature.

## Required implementation gates

- [ ] A supported ARMv7 Android/Bionic JavaScript runtime compatible with OpenCode's Bun APIs, or a validated compatibility layer.
- [ ] ARMv7 OpenTUI native renderer and matching JavaScript bindings.
- [ ] ARMv7 PTY implementation and service, or a tested Termux-native PTY fallback.
- [ ] ARMv7 builds/fallbacks for all required native npm dependencies (including file watching/search paths).
- [ ] Build artifact passes `file` and ELF-header checks: ELF32 ARM, EABI5; no AArch64 objects.
- [ ] Runtime tests on Android 10 ARMv7: version, provider request, TUI input/render, file read/write, shell/PTY, MCP, LSP, session persistence, and web UI where enabled.
- [ ] Feature parity review against the pinned upstream OpenCode version.

## Build policy

GitHub Actions should first run the ARMv7 prerequisite preflight. Only after all gates are satisfied should a separate ARMv7 build/release workflow be enabled. Do not publish a placeholder or AArch64 binary under an ARM32 release name.
