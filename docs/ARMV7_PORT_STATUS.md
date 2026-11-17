# ARMv7 / 32-bit Android port status

## Target device
- Android 10 / API 29
- Termux on 32-bit ARM userspace, ABI `armeabi-v7a`
- Required output: ELF32 little-endian ARM EABI5 (`e_machine=40`)
- AArch64 (`e_machine=183`) is not acceptable.

## Current state: ARMv7 Node FFI proven on the Redmi 9A; full CLI port not yet complete

The AArch64 release pipeline remains unchanged. The ARMv7 OpenTUI experiment now produces a real Android/Bionic ELF32 ARM shared library in GitHub Actions. This is a native-component milestone, not yet an installable OpenCode CLI.

## Confirmed CI evidence (2026-11-17)

- Termux Node.js ARM package preflight succeeded (run `43999676467`): package checksum verified and executable identified as ELF32 ARM EABI5. Static package evidence only; runtime execution on the Redmi 9A is still unverified.
- Node compatibility audit succeeded (run `44004450476`): registry probes found candidate packages, but did not establish Android Bionic ARMv7 prebuilds or runtime compatibility.
- OpenTUI ARMv7 cross-build succeeded (run `44018098285`, commit `22bd6b4d6c5a3dedc85e276db090768992a3121b`): all 13/13 build steps passed using Zig 0.17.0 and Android NDK 27.2.12479018/API 29. The output was verified as ELF32, little-endian, ARM, EABI5, soft-float ABI. Its dynamic section references Android Bionic libraries (`libc.so`, `libdl.so`, `libm.so`); no glibc `libc.so.6` or `ld-linux` dependency was found. The workflow also packages the matching NDK `libc++_shared.so` as evidence/runtime material.
- Artifact: [opentui-android-armv7-experiment](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44018098285). The artifact is retained for 14 days from the run.
- The later on-device FFI smoke test is recorded below. It proves Node FFI loading and scalar/pointer marshalling against the dedicated smoke library; it does not yet prove that the OpenTUI library itself loads, that the TUI renders, or that the full OpenCode application runs.

Workflow: [ARMv7 OpenTUI native cross-build experiment](../.github/workflows/armv7-opentui-cross-build.yml).

## Remaining implementation gates

1. **Node runtime:** Node.js 26.4.0, `process.arch === "arm"`, Android platform, ESM, `node:ffi`, and i32/u64/f64/pointer calls have passed on the Redmi 9A. Child-process, signal, filesystem, and full Node runtime checks remain.
2. **OpenTUI FFI:** next, load the actual generated `libopentui.so` through Node FFI and call its ABI-version export; then verify generated bindings, struct layout, callbacks, terminal dimensions, input, and rendering.
3. **PTY:** build or adapt an ARMv7 Android/Bionic PTY backend and test interactive shell lifecycle, resize, signals, and cleanup.
4. **Native npm dependencies:** build or provide tested fallbacks for required ARMv7 Android dependencies (filesystem watcher/search, image processing, SQLite and any other runtime-selected native modules).
5. **OpenCode Node path:** bundle the upstream OpenCode JavaScript/ESM output with Termux Node rather than the unsupported Node SEA target. Audit Bun-only APIs and replace only with tested Node equivalents.
6. **Package:** produce an ARMv7 Termux installable package containing the correct Node runtime, JS bundle, native libraries, and launcher.
7. **Device tests:** Redmi 9A / Android 10 / 32-bit Termux end-to-end tests for version, provider request, TUI, file operations, shell/PTY, MCP, LSP, sessions, permissions, plugins, and web/server functions where enabled.

## Feature preservation

Keep upstream OpenCode agents, providers, tools, sessions, MCP, LSP, permissions, plugins, and server/web functionality. Isolate platform changes to runtime, TUI, PTY, native dependency packaging, and launch integration. Do not silently remove features to make the ARM32 build pass; document any optional integration that genuinely has no Android implementation.

## Important distinction

A successful OpenTUI native library build is not a successful OpenCode port. Do not publish a placeholder or AArch64 binary under an ARM32 release name. Do not claim Redmi 9A compatibility until the package has been installed and tested on the actual device.


## Latest FFI handoff evidence (2026-11-17)

- Latest cross-build run: [44029335974](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44029335974), commit `8ffacf0307fc64b06df12d9de117481d6f5592ef`, **success**.
- The run compiled both the OpenTUI Android ARMv7 native library and a separate Node FFI smoke-test library; all build, ELF verification, and artifact upload steps passed.
- Artifact: [opentui-android-armv7-experiment](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44029335974/artifacts/14304174110), artifact ID `14304174110`, 7,945,611 bytes, retained until 2026-12-01.
- The artifact contains `libopentui-android-armv7.so`, `libnode-ffi-smoke.so`, `node-ffi-smoke.mjs`, and `test-node-ffi-armv7.sh`, plus ELF/dynamic-symbol evidence.
- Direct artifact inspection confirmed both native libraries are ELF32 little-endian ARM EABI5 with soft-float ABI. The OpenTUI library is Android API 29 and its dynamic dependencies are `libm.so`, `libc.so`, and `libdl.so`; the smoke library is Android API 29 and depends on `libdl.so` and `libc.so`.
- **Device verified:** Node `node:ffi` execution and i32/u64/f64/pointer marshalling passed on the Redmi 9A using Node v26.4.0 (`process.arch=arm`, `process.platform=android`). OpenTUI library loading and terminal rendering remain unverified.

The next gate is the OpenTUI-specific library load/ABI test in the same artifact (`bash test-opentui-armv7.sh`), followed by terminal rendering and the separate PTY/native-dependency work. The full OpenCode CLI remains incomplete.


## Redmi 9A device-side Node FFI result (2026-11-17)

The user ran the packaged `test-node-ffi-armv7.sh` on the target Redmi 9A / Termux and reported:

```text
Node: v26.4.0
Arch: arm
PASS: Node node:ffi loaded Android ARMv7 .so
PASS: i32, u64, f64 and pointer argument/return calls
Node: 26.4.0; arch: arm; platform: android
```

This is direct device evidence that the Termux Node v26.4.0 runtime is 32-bit ARM, the experimental `node:ffi` module loads, an Android ARMv7 shared library loads, and the tested integer/floating-point/pointer calls pass. The FFI API remains experimental, as Node warns.

**Status upgrade:** Node runtime + basic ARMv7 Node FFI smoke test are now proven on the target device. This does not yet prove that OpenTUI's full generated FFI table, renderer initialization, terminal input/output, or OpenCode itself works. Continue with an OpenTUI-specific FFI integration test, then PTY and the remaining native dependencies.


## Redmi 9A on-device Node FFI result (2026-11-17)

The user ran the artifact's `test-node-ffi-armv7.sh` on the target Redmi 9A / Termux and returned this output:

```text
Node: v26.4.0
Arch: arm
PASS: Node node:ffi loaded Android ARMv7 .so
PASS: i32, u64, f64 and pointer argument/return calls
Node: 26.4.0; arch: arm; platform: android
```

This is the first direct device-side runtime proof for the Node FFI path: Node v26.4.0 on Android reports 32-bit ARM, loads an Android ARMv7 shared object through `node:ffi`, and successfully calls native functions with i32, u64, f64, and pointer arguments/returns. The experimental FFI warning is expected because Node marks this API experimental.

**This does not yet prove OpenTUI's 20.5 MB native library can be loaded through OpenTUI's generated 366-symbol binding, nor that terminal rendering works.** The current artifact already includes `node-opentui-load-smoke.mjs` and `test-opentui-armv7.sh` for the next device test. Full OpenCode CLI, PTY, and other native dependencies remain outstanding.


## Redmi 9A on-device Node FFI proof (2026-11-17)

The user ran the shipped `test-node-ffi-armv7.sh` on the target Redmi 9A in Termux. The exact terminal output reported:

- `Node: v26.4.0`
- `Arch: arm`
- `platform: android`
- `PASS: Node node:ffi loaded Android ARMv7 .so`
- `PASS: i32, u64, f64 and pointer argument/return calls`

This is direct device-side proof that the installed 32-bit Termux Node 26.4.0 runtime can load an Android ARMv7 shared library through experimental `node:ffi` and correctly marshal the tested scalar and pointer values. The ExperimentalWarning is expected and is not a test failure.

The result does **not** yet prove that `libopentui-android-armv7.so` itself loads, that the TUI renders, or that OpenCode runs. The next validation is to load the actual OpenTUI library and call its no-argument `ot_context_abi_version()` export, then run Node child-process/signal/filesystem checks. PTY and remaining native modules are still blocking integration items.


## Custom provider compatibility target (2026-11-17)

The V2 custom-provider contract is documented in [ARMV7_CUSTOM_PROVIDER_COMPAT.md](ARMV7_CUSTOM_PROVIDER_COMPAT.md). The target preserves OpenCode's native `providers` configuration, OpenAI-compatible runtime package, credentials, model map, and multiple-provider behavior. Arbitrary custom endpoints do not automatically support dynamic model discovery; only providers/runtimes or plugins that implement discovery can offer it. No ARMv7 end-to-end provider request has been claimed yet.
