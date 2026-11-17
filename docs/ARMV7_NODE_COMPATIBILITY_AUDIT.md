# OpenCode 2.3.0 Node runtime compatibility audit for ARMv7

## Result

The Node.js route is more promising than the earlier audit suggested: upstream OpenCode 2.3.0 already contains explicit Node runtime branches and a Node CLI build path. This is source-level support, not proof of an Android ARMv7 release. The target still needs a native OpenTUI renderer, a working PTY implementation, native dependency builds, and a phone test.

## Confirmed upstream Node branches

The following files exist in upstream OpenCode 2.3.0:

- `packages/cli/script/build-node.ts`: Node SEA bundling/build script. It currently hard-codes Node 26.4.0 and its target matrix contains Linux ARM64/x64, macOS ARM64, and Windows ARM64/x64; it does **not** include Android or 32-bit ARM.
- `packages/core/src/database/sqlite.node.ts`: uses `@effect/sql-sqlite-node` and Node's SQLite driver path.
- `packages/core/src/pty/pty.node.ts`: Node PTY adapter using `@lydell/node-pty`.
- `packages/core/src/filesystem/fff.node.ts`: Node-specific file-finder adapter; it degrades gracefully if `@ff-labs/fff-node` is unavailable.
- `packages/core/src/image/photon-wasm.node.ts`: Node WASM asset resolution.
- `packages/core/src/effect/client-tls/client-tls.node.ts`: Node/undici TLS client.
- Package import maps in `packages/core/package.json` select Node-specific modules for `#sqlite`, `#pty`, `#persistent-pty-binary`, `#fff`, `#photon-wasm`, and `#client-tls`.
- `packages/tui/package.json` also has Node-specific import branches for attention sounds, string width, Zed SQLite, and runtime plugin support.

These existing Node branches mean a Node port should be based on upstream's Node runtime implementation, not by rewriting all Bun APIs blindly.

The v2.3.0 Node build has a second hard target gate in `packages/cli/src/node/target.ts`: it accepts only `darwin`, `linux`, or `win32`, and only `arm64` or `x64`. It constructs platform-specific package names for node-pty, Parcel Watcher, FFF, and FFF FFI. The Node bundle asset collector then resolves those native packages and OpenTUI's Node assets before Vite builds. Therefore adding `arm` to the SEA matrix alone is not sufficient; an Android/Termux target requires a new target descriptor, compatible native packages or explicit tested fallbacks, and an OpenTUI native asset strategy.

## OpenTUI Android ARMv7 cross-build experiment

OpenTUI v0.8.3's `packages/native/build.zig` has a `buildSingleTarget()` fallback that accepts a custom Zig target string even when it is not in the official `SUPPORTED_TARGETS` list. This creates a concrete experiment path without modifying upstream source: run `zig build -Dlibrary-target=arm-linux-android.29` after preparing its vendored Zig dependencies. The experiment is automated in [armv7-opentui-cross-build.yml](../.github/workflows/armv7-opentui-cross-build.yml). It checks for a shared library, verifies ELF32/ARM, and rejects glibc dynamic dependencies. A successful CI build would still require Android/Termux Node FFI and terminal rendering tests on the Redmi 9A before it can be considered usable.

## Confirmed OpenTUI v0.8.3 target gap (checked 2026-11-17)

The pinned OpenTUI version used by this project is 0.8.3. Its upstream `packages/native/build.zig` defines exactly eight `SUPPORTED_TARGETS`: Linux x86_64/aarch64 (glibc and musl), macOS x86_64/aarch64, and Windows x86_64/aarch64. It does **not** define Android, Linux ARMv7, or a 32-bit ARM target. The v0.8.3 native README documents the Zig build flow and `-Dlibrary-target`, but that option only selects a target from the explicit supported-target list. Therefore an ARMv7 Android renderer requires a maintained source patch/port and a verified Bionic toolchain; changing the package name or target metadata is insufficient.

The same-version `@opentui/core` package lists only the eight platform packages above as optional dependencies. No Android ARMv7 native package is published in that manifest. The compatibility audit run also returned HTTP 404 for `@androidtui/core-android-arm` and `@androidtui/core-android-armv7`.

## Confirmed blockers / gaps

1. **CLI build target**: upstream's `build-node.ts` target matrix excludes `arm` and Android. The SEA build target cannot simply be relabeled as ARMv7. A Termux distribution may need to ship the JS bundle plus the Termux Node runtime, rather than a Node SEA executable.
2. **OpenTUI**: OpenCode's TUI still depends on `@opentui/core`, `@opentui/solid`, and `@opentui/keymap`. A Node runtime alone does not supply the Android ARMv7 Zig/native renderer. The existing Android native package pin in this repo is ARM64-only.
3. **PTY**: the Node branch uses `@lydell/node-pty`; its native addon must be built and tested for Android Bionic ARMv7. The current repo's known PTY release assets are AArch64.
4. **npm package probe (Run 44003028456)**: the registry returned latest releases for `@lydell/node-pty` (1.2.0-beta.18), `@parcel/watcher` (2.6.0), `@ff-labs/fff-node` (0.11.0), and `@silvia-odwyer/photon-node` (0.3.4). This confirms package existence only; it does not confirm Android Bionic ARMv7 prebuilds or successful source builds.
5. **Other native dependencies**: `@parcel/watcher`, `@ff-labs/fff-node`, `@silvia-odwyer/photon-node`, and any FFI/native packages must be checked for ARMv7 Android availability or a safe, tested fallback.
6. **Runtime validation**: static ELF inspection of the Termux Node package does not test its dynamic linker dependencies, Node's experimental FFI, child processes, signals, terminal input, or native addons on the actual phone.

## Recommended implementation sequence

1. Keep the current AArch64 release workflow unchanged.
2. Add an ARMv7 Node compatibility workflow that inventories upstream Node import branches and probes npm/native package availability without pretending to build a release.
3. Build OpenTUI's Zig renderer for Android ARMv7/Bionic and publish an ARMv7-specific package.
4. Build/test the Node PTY addon for Android ARMv7; if node-pty cannot work, implement and test a Termux-native PTY adapter against the existing `Proc` interface.
5. Add an ARMv7 bundle-and-runtime package path using the Termux Node binary, with all native assets explicitly included.
6. Run end-to-end tests on Redmi 9A / Android 10 / 32-bit Termux before enabling release.

## Feature-preservation policy

Do not remove OpenCode agents, providers, tools, MCP, LSP, sessions, permissions, plugins, or server/web functionality to make the build pass. Where a platform-specific optional integration is genuinely unavailable, it must be reported explicitly and covered by a parity checklist; core functionality must not silently disappear.

## Upstream source references

- https://github.com/anomalyco/opencode/blob/dev/packages/cli/script/build-node.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/core/package.json
- https://github.com/anomalyco/opencode/blob/dev/packages/core/src/pty/pty.node.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/core/src/database/sqlite.node.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/tui/package.json
