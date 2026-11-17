# ARMv7 / 32-bit Android port status

## Target device
- Android 10 / API 29
- Termux on 32-bit ARM userspace, ABI `armeabi-v7a`
- Required output: ELF32 little-endian ARM EABI5 (`e_machine=40`)
- AArch64 (`e_machine=183`) is not acceptable.

## Current state: not yet a working ARM32 port

The current release pipeline remains AArch64-oriented. Keep it unchanged until all runtime/native components are built for ARMv7 and pass device tests.

## Confirmed CI evidence (2026-11-17)

- Termux Node.js ARM package preflight succeeded (run `43999676467`): package checksum verified and executable identified as ELF32 ARM EABI5. Static package evidence only; not a runtime test on the phone.
- Node compatibility audit succeeded (run `44004450476`): registry probes found candidate packages, but did not establish Android Bionic ARMv7 prebuilds or runtime compatibility.
- OpenTUI custom-target experiment failed (run `44004450442`). Zig 0.17.0 and OpenTUI v0.8.3 source/dependencies were fetched. Compilation failed in three `zig translate-c -lc` steps because the cross-build resolved Ubuntu host glibc header `/usr/include/x86_64-linux-gnu/gnu/stubs.h`, which tried to include missing `gnu/stubs-32.h`. No OpenTUI ARMv7 shared library was produced; the uploaded artifact is diagnostic only.
- The attempted command was `zig build -Dlibrary-target=arm-linux-android.29 -Doptimize=ReleaseFast`. The custom target was accepted far enough to start compilation, but Android/Bionic headers and linking were not validated.

Workflow: [ARMv7 OpenTUI native cross-build experiment](../.github/workflows/armv7-opentui-cross-build.yml).

## OpenTUI target gap

OpenTUI v0.8.3 officially lists Linux x86_64/aarch64 (glibc/musl), macOS x86_64/aarch64, and Windows x86_64/aarch64. Android and ARMv7 are excluded. The custom-target experiment exposed a host-glibc header leak. The next attempt must configure an Android NDK/Bionic sysroot correctly; changing package metadata or renaming output is not a port.

## Runtime investigation

A Node.js-based route remains under evaluation because Termux publishes a 32-bit ARM Node package and OpenCode has Node-specific import branches. This does not establish compatibility: CLI target support, OpenTUI renderer/FFI, PTY, and native npm dependencies still need implementation and device tests.

## Feature preservation

Keep upstream OpenCode agents, providers, tools, sessions, MCP, LSP, permissions, plugins, and server/web functionality. Isolate platform changes to runtime, TUI, PTY, packaging, and launch integration. Report unsupported optional integrations explicitly.

## Required gates
- [ ] ARMv7 Android/Bionic JavaScript runtime compatible with OpenCode APIs.
- [ ] ARMv7 OpenTUI renderer and matching Node FFI.
- [ ] ARMv7 PTY implementation or tested Termux-native fallback.
- [ ] ARMv7 builds or tested fallbacks for required native npm dependencies.
- [ ] Final package passes ELF32 ARM/EABI5 checks with no AArch64 objects.
- [ ] Android 10 device tests: version, provider request, TUI, files, shell/PTY, MCP, LSP, sessions, and web UI where enabled.
- [ ] Feature-parity review against pinned upstream OpenCode.

Do not publish a placeholder or AArch64 binary under an ARM32 release name.


## Second OpenTUI cross-build attempt

The experiment workflow now installs Android NDK 27.2.12479018 and passes a Zig `--libc` configuration targeting the Android API 29 Bionic sysroot. This directly addresses the host-glibc header leak seen in run `44004450442`. The next CI result is pending; no ARMv7 library is claimed until ELF and linkage checks pass.
