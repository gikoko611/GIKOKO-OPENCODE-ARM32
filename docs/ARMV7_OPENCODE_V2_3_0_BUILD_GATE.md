# OpenCode V2.3.0 ARMv7 full-CLI build gate

## Finding

The native OpenTUI cross-build and Bionic PTY API probe are independent native-component experiments. They do not yet constitute an OpenCode executable or a complete CLI bundle.

A source audit of the pinned upstream tag `anomalyco/opencode:v2.3.0` found that the supported target tables are explicitly 64-bit:

- `packages/cli/script/build.ts`: `allTargets` declares Linux/macOS/Windows with only `arm64` and `x64`. Its Bun compile target is derived from that table.
- `packages/cli/src/node/target.ts`: `nodeTarget()` rejects every architecture other than `arm64` and `x64`.
- `packages/cli/script/build-node.ts`: `allTargets` contains Linux ARM64/x64, macOS ARM64, and Windows ARM64/x64. There is no Android platform or ARMv7 target.
- `packages/cli/script/opencode-pty.ts`: the upstream persistent PTY asset resolver accepts only Linux/macOS/Windows and ARM64/x64.
- `packages/cli/script/node-assets.ts`: Node bundle asset collection resolves platform-specific node-pty, parcel watcher, fff, ffi-rs, Photon WASM, and persistent PTY assets. ARMv7 Android variants are not declared by the current target model.

The pinned OpenCode release also depends on Bun 1.4.4 for workspace installation and build orchestration. The current Termux packaging path invokes Bun's compile flow and hardcodes AArch64 in its container image, native PTY assets, output path, and Debian package metadata. It must not be reused as an ARMv7 build recipe.

## What is actually proven

- Redmi 9A: Termux Node v26.4.0 reports `process.arch === "arm"` and `process.platform === "android"`.
- Redmi 9A: experimental `node:ffi` loaded a dedicated Android ARMv7 smoke library and passed i32/u64/f64/pointer calls.
- GitHub Actions run [44041115869](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44041115869): OpenTUI native library and PTY primitive probe cross-compiled successfully as ELF32 ARM EABI5 against Android NDK API 29/Bionic.
- The PTY primitive probe only tests `openpty()`, terminal window-size ioctls, and descriptor cleanup. It is not a node-pty implementation or the persistent `@opencode/pty` service.

## Required work before a full ARMv7 CLI can be built

1. Add a genuine Android/ARMv7 target descriptor to the Node build path without weakening existing x64/ARM64 targets.
2. Provide tested ARMv7/Bionic native dependencies or upstream-compatible implementations for every runtime-selected native asset. At minimum, audit OpenTUI, node-pty, persistent PTY, parcel watcher, fff, ffi-rs, Photon, SQLite, and any dynamically loaded addons.
3. Implement and test the two separate PTY contracts: interactive node-pty semantics and the persistent OpenCode PTY daemon protocol. Pipe-based child processes are not an acceptable silent substitute.
4. Adapt the build pipeline to produce a Node 26.4-compatible ESM/SEA artifact for the actual Android ARMv7 runtime. Do not embed a Linux/glibc or AArch64 Node executable.
5. Verify the complete bundle on the Redmi 9A: `--version`, `--help`, TUI render/input, provider request, tools, agents, sessions, permissions, Skills, MCP, LSP, plugins, shell/PTY, and server/web paths.
6. Package only after the ELF architecture, Bionic dependencies, and on-device acceptance tests pass.

## Release safety rules

- Never label an AArch64 binary as ARMv7.
- Never use a Linux ARMv7 glibc binary as if it were Android/Bionic.
- Never silently drop PTY, watcher, or other features to get a green build.
- Keep the existing AArch64 workflow and package metadata unchanged.
- Mark each feature as cross-compiled, device-tested, or end-to-end verified separately.

## Upstream source references

- https://github.com/anomalyco/opencode/blob/v2.3.0/packages/cli/script/build.ts
- https://github.com/anomalyco/opencode/blob/v2.3.0/packages/cli/script/build-node.ts
- https://github.com/anomalyco/opencode/blob/v2.3.0/packages/cli/src/node/target.ts
- https://github.com/anomalyco/opencode/blob/v2.3.0/packages/cli/script/node-assets.ts
- https://github.com/anomalyco/opencode/blob/v2.3.0/packages/cli/script/opencode-pty.ts


## Additional feature-preservation audit

The existing Termux 2.x patch in this repository (`termux/patches/0001-termux-2x-port.patch`) is an AArch64-oriented adaptation, not a valid ARMv7 implementation template. It explicitly allows the persistent PTY asset resolver to fail on Termux, documents a child-process fallback for PTY, and changes the Parcel watcher loader to throw so the upstream watcher can poll instead. Those choices may be acceptable trade-offs in that separate port, but they do not meet this project's stated requirement to preserve full PTY and filesystem-watcher functionality.

Therefore the ARMv7 port must not simply reuse that patch or copy its feature fallbacks. The acceptance gates now explicitly require:

- A real PTY implementation compatible with the upstream persistent PTY protocol and the interactive node-pty contract; no silent pipe-only replacement.
- A working Android ARMv7 filesystem watcher backend, or an explicit upstream-supported equivalent with tests; do not silently replace native events with polling.
- Runtime tests for PTY resize, signals, exit status, Unicode input/output, terminal modes, repeated spawn/cleanup, and long-running sessions.
- Runtime tests for file create/change/rename/delete events, recursive watching, descriptor cleanup, and behavior under Android scoped-storage boundaries.

## Latest native CI evidence

Workflow run [44041115869](https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44041115869) completed successfully. Its job built the OpenTUI Android ARMv7 shared library and compiled the Bionic `openpty()`/window-size API probe as ELF32 ARM EABI5. This validates cross-compilation of those isolated native experiments only. It does not prove that the library loads and renders on the Redmi 9A, nor does the PTY probe implement either full PTY contract above.
