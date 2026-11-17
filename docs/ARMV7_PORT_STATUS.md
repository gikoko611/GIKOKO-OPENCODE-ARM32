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
- OpenTUI cross-build run `44011061039` passed the Android NDK/Bionic header and translate-C setup, and passed the previous missing `dl`/`pthread`/`m` link stage. It then failed with decisive 32-bit source/ABI blockers: `src/context-abi.zig` emits `The OpenTUI C ABI requires a 64-bit target`; `src/scene-record.zig` asserts `@sizeOf(usize) >= 8`; and multiple `u64` atomic operations in OpenTUI and Zig std fail on this ARMv7 target. The C++ sub-build also rejects the injected `-mfloat-abi=hard` flag for `armv7-unknown-linux...-android29`. No ARMv7 `.so` was produced; the uploaded artifact contains diagnostics only.
- The attempted command was `zig build --libc android-libc.txt -Dlibrary-target=arm-linux-android.29 -Doptimize=ReleaseFast`. This proves the remaining failure is no longer just a missing sysroot or separate Bionic library link: OpenTUI v0.8.3's native ABI and implementation assume 64-bit. It needs a deliberate ARM32 source/ABI port (including pointer/handle layout, scene record sizing, 64-bit atomic fallbacks, and Android compiler flags) before another full build attempt.

Workflow: [ARMv7 OpenTUI native cross-build experiment](../.github/workflows/armv7-opentui-cross-build.yml).

## OpenTUI target gap

OpenTUI v0.8.3 officially lists 64-bit Linux, macOS, and Windows targets; Android and ARMv7 are excluded. The NDK/Bionic sysroot experiment removed the earlier host-header and Bionic library-link blockers, but compilation then reached explicit 64-bit-only source assertions and unsupported 64-bit atomic operations. This is a source/ABI compatibility gap, not a simple linker configuration issue. Do not repeat the same cross-build until the native ABI and implementation have been ported to 32-bit.

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

The experiment workflow now reaches OpenTUI compilation using Android NDK 27.2.12479018 and the API 29 Bionic sysroot. Run `44011061039` confirms that the next blockers are OpenTUI's 64-bit-only C ABI, `usize` assumptions, `u64` atomics, and an incompatible hard-float flag. No ARMv7 library was produced. A genuine ARM32 source port is required before the build can pass.
