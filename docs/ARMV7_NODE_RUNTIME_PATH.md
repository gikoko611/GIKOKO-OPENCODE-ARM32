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
