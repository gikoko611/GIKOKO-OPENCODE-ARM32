# ARMv7 Node.js runtime investigation

## Why this path is being investigated

The current ARM64 build depends on Bun-specific build/runtime behavior and AArch64-only native assets. The existing ARMv7 Bun preflight found no 32-bit ARM Bun release asset, no ARMv7 OpenTUI package, and no ARMv7 PTY asset.

A potentially viable alternative is a **Node.js 26.4+ ARMv7 runtime path**:

- OpenTUI documents Node.js 26.4.0+ with ESM and `--experimental-ffi` as a supported runtime path. Its published native package matrix does not currently include Android ARMv7, so an Android/Bionic native renderer still has to be built and tested.
- Termux packages Node.js for the `arm` architecture (32-bit ARM) as well as `aarch64`. The package must be checked for the exact Android/Termux release and device ABI before use.
- OpenCode itself must be audited for Bun-only APIs and packages. A Node runtime being available does **not** prove that OpenCode can run under Node without source changes.

References:
- OpenTUI runtime matrix: https://opentui.com/docs/getting-started/runtime-support/
- Termux Node.js package build: https://github.com/termux/termux-packages/tree/master/packages/nodejs
- Termux Node.js LTS package build: https://github.com/termux/termux-packages/tree/master/packages/nodejs-lts

## Source-level integration finding (OpenTUI v0.8.3)

The pinned OpenTUI source already contains a Node FFI backend in `packages/core/src/platform/ffi.ts`. It loads `node:ffi` through `createRequire` when the runtime is Node, and its package metadata requires Node >=26.4.0. The Node backend uses bigint pointers and supports the standard integer, float, bool, pointer, string-argument, and callback registration paths, with explicit limitations (notably no `usize`, N-API FFI types, pointer overrides, or threadsafe callbacks).

The generated OpenTUI native ABI file contains 366 native symbol declarations and currently has **zero `usize` entries**, so the known `usize` rejection does not block that generated symbol table. This is a static source audit, not an ARM32 execution result.

A concrete integration bug was also identified: `resolveNativeLibraryPath()` called `getNativeAssetDescriptor()` before checking `OPENTUI_LIB_PATH`. The asset target type accepts only `x64` and `arm64`, so a 32-bit Node process (`process.arch === "arm"`) throws before the custom Android library path can be used. The ARMv7 cross-build workflow now patches the resolver to honor `OPENTUI_LIB_PATH` first. This keeps the upstream default asset selection unchanged for supported platforms.

## Artifact-level ELF audit (run 44020997587)

The downloaded cross-build artifact was inspected directly after CI completed:

- `libopentui-android-armv7.so` is an ELF32 little-endian ARM shared object, EABI5, soft-float ABI; size 20,524,828 bytes (about 19.6 MiB).
- Its `DT_NEEDED` list is exactly `libm.so`, `libc.so`, and `libdl.so`; there is no `libc.so.6`, `ld-linux`, or `libstdc++.so` dependency.
- The dynamic symbol table has 2,114 entries and exposes OpenTUI C symbols such as `otYogaNodeCreate`, `otYogaNodeCalculateLayout`, and `otYogaNodeStyleSetDimension`.
- The separate `libc++_shared-android-armv7.so` file is present in the CI artifact, but it is **not** listed as a dynamic dependency of `libopentui.so`; it must not be treated as a required runtime library based on this build.

This materially improves confidence in the Android/Bionic binary format and exported ABI, but it does not execute the library. Node `node:ffi` loading, pointer marshalling, FFI calls, TUI rendering, and Redmi 9A runtime behavior remain open gates.

The workflow's ELF verification step has now been strengthened to enforce EABI5/soft-float, check the expected Bionic dependencies, reject glibc references, and archive dynamic symbols plus exported OpenTUI symbols for review.

## Node FFI smoke-test handoff

The cross-build workflow now also compiles a tiny ARMv7/Bionic shared library specifically for testing Node's experimental `node:ffi` API on the phone. The artifact includes:

- `libnode-ffi-smoke.so` (ELF32 ARM EABI5, soft-float ABI)
- `node-ffi-smoke.mjs`
- `test-node-ffi-armv7.sh`

The test checks Node `process.arch === "arm"`, Node >=26.4.0, and actual native calls for `i32`, `u64`, `f64`, and pointer arguments/returns. This is intentionally a **device-side test**: hosted x86_64 CI can compile and inspect the library but cannot claim the ARM Node FFI calls passed.

On the Redmi 9A after downloading and extracting the Actions artifact into one folder, run:

```sh
bash test-node-ffi-armv7.sh
```

The Node FFI API is experimental and requires `--experimental-ffi`; official Node v26.4.0 documentation describes the `dlopen()` API and supported scalar/pointer types: https://nodejs.org/download/release/v26.4.0/docs/api/ffi.html

## Required proof before switching the build

1. Obtain a Termux `arm` Node.js package at version 26.4.0 or newer.
2. Verify the executable is ELF32, little-endian ARM, EABI5 (`e_machine=40`); inspect its dynamic dependencies and Android API compatibility.
3. Run the exact Node binary inside a 32-bit Termux/Android environment and verify `node --version`, ESM, `node:ffi`, `--experimental-ffi`, child processes, signals, and filesystem behavior.
4. Build OpenTUI's Zig native core for Android ARMv7/Bionic; verify FFI calls and terminal rendering on the target device. The official prebuilt package list does not supply this target.
5. Audit OpenCode's runtime imports and build scripts. Replace Bun-only functionality only with tested Node equivalents, without removing MCP, LSP, providers, tools, sessions, permissions, or other upstream features.
6. Implement an ARMv7 PTY backend and test interactive shell lifecycle, resize, signals, and cleanup.
7. Run an end-to-end Android 10 ARMv7 test matrix before publishing.

## Current decision

This is an **investigation path, not a supported build yet**. The upstream OpenCode 2.3.0 source does contain a Node runtime implementation and a Node CLI build script, but the supported build target matrix omits Android and 32-bit ARM. See [OpenCode Node compatibility audit](ARMV7_NODE_COMPATIBILITY_AUDIT.md). Do not change the existing AArch64 release pipeline or label any artifact ARMv7 until the runtime and native renderer pass on a real 32-bit Android/Termux target.


## Latest artifact inspected (2026-11-17)

The newest CI run is [44029335974](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44029335974) (commit `8ffacf0307fc64b06df12d9de117481d6f5592ef`, success). Its artifact is [opentui-android-armv7-experiment](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44029335974/artifacts/14304174110).

Artifact ID: `14304174110`; size: 7,945,611 bytes; expiry: 2026-12-01. Direct ZIP inspection confirmed these handoff files exist:
- `libopentui-android-armv7.so`
- `libnode-ffi-smoke.so`
- `node-ffi-smoke.mjs`
- `test-node-ffi-armv7.sh`
- `node-ffi-smoke-elf.txt` and `node-ffi-smoke-dynamic.txt`

Both `.so` files are ELF32 ARM EABI5 soft-float Android API 29 libraries. The OpenTUI library depends on Bionic `libc.so`, `libm.so`, and `libdl.so`; the smaller smoke library depends on `libc.so` and `libdl.so`. This is build and binary-inspection evidence only, not a successful FFI runtime test.

Run `bash test-node-ffi-armv7.sh` inside the Redmi 9A's 32-bit Termux environment after extracting the artifact. The script requires Node >=26.4.0, `process.arch === "arm"`, and the `--experimental-ffi` feature. Keep the exact terminal output for the next compatibility decision.
