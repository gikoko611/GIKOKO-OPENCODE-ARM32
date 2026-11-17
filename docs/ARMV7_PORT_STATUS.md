# ARMv7 / 32-bit Android port status

## Target device
- Android 10 / API 29
- Termux on 32-bit ARM userspace, ABI `armeabi-v7a`
- Required output: ELF32 little-endian ARM EABI5 (`e_machine=40`)
- AArch64 (`e_machine=183`) is not acceptable.

## Current state: native OpenTUI library cross-build proven; full CLI port not yet complete

The AArch64 release pipeline remains unchanged. The ARMv7 OpenTUI experiment now produces a real Android/Bionic ELF32 ARM shared library in GitHub Actions. This is a native-component milestone, not yet an installable OpenCode CLI.

## Confirmed CI evidence (2026-11-17)

- Termux Node.js ARM package preflight succeeded (run `43999676467`): package checksum verified and executable identified as ELF32 ARM EABI5. Static package evidence only; runtime execution on the Redmi 9A is still unverified.
- Node compatibility audit succeeded (run `44004450476`): registry probes found candidate packages, but did not establish Android Bionic ARMv7 prebuilds or runtime compatibility.
- OpenTUI ARMv7 cross-build succeeded (run `44018098285`, commit `22bd6b4d6c5a3dedc85e276db090768992a3121b`): all 13/13 build steps passed using Zig 0.17.0 and Android NDK 27.2.12479018/API 29. The output was verified as ELF32, little-endian, ARM, EABI5, soft-float ABI. Its dynamic section references Android Bionic libraries (`libc.so`, `libdl.so`, `libm.so`); no glibc `libc.so.6` or `ld-linux` dependency was found. The workflow also packages the matching NDK `libc++_shared.so` as evidence/runtime material.
- Artifact: [opentui-android-armv7-experiment](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44018098285). The artifact is retained for 14 days from the run.
- This success proves cross-compilation and ELF metadata only. It does not yet prove that Node FFI can load the library, that the TUI renders correctly on Android, or that the full OpenCode application runs.

Workflow: [ARMv7 OpenTUI native cross-build experiment](../.github/workflows/armv7-opentui-cross-build.yml).

## Remaining implementation gates

1. **Node runtime:** acquire the Termux ARM Node runtime and test it on the actual 32-bit Termux device (version, ESM, `node:ffi` / `--experimental-ffi`, child processes, signals, filesystem).
2. **OpenTUI FFI:** bind the generated `libopentui.so` through OpenTUI's Node FFI path; verify exported symbols, struct layout, callbacks, terminal dimensions, input, and rendering.
3. **PTY:** build or adapt an ARMv7 Android/Bionic PTY backend and test interactive shell lifecycle, resize, signals, and cleanup.
4. **Native npm dependencies:** build or provide tested fallbacks for required ARMv7 Android dependencies (filesystem watcher/search, image processing, SQLite and any other runtime-selected native modules).
5. **OpenCode Node path:** bundle the upstream OpenCode JavaScript/ESM output with Termux Node rather than the unsupported Node SEA target. Audit Bun-only APIs and replace only with tested Node equivalents.
6. **Package:** produce an ARMv7 Termux installable package containing the correct Node runtime, JS bundle, native libraries, and launcher.
7. **Device tests:** Redmi 9A / Android 10 / 32-bit Termux end-to-end tests for version, provider request, TUI, file operations, shell/PTY, MCP, LSP, sessions, permissions, plugins, and web/server functions where enabled.

## Feature preservation

Keep upstream OpenCode agents, providers, tools, sessions, MCP, LSP, permissions, plugins, and server/web functionality. Isolate platform changes to runtime, TUI, PTY, native dependency packaging, and launch integration. Do not silently remove features to make the ARM32 build pass; document any optional integration that genuinely has no Android implementation.

## Important distinction

A successful OpenTUI native library build is not a successful OpenCode port. Do not publish a placeholder or AArch64 binary under an ARM32 release name. Do not claim Redmi 9A compatibility until the package has been installed and tested on the actual device.
