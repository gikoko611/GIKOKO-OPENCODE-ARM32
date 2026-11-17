# Android ARMv7 Full-CLI Feasibility Audit (OpenCode v2.3.0)

Date: 2026-11-17

This audit tracks the Redmi 9A / Termux ARMv7 port and separates successful cross-compilation from a runnable, feature-complete CLI.

## Build architecture

- The standard `packages/cli/script/build.ts` path produces a Bun-compiled executable. Its official target matrix does not include Android ARMv7.
- Upstream also has `packages/cli/script/build-node.ts`, which produces a Node.js ESM bundle and optionally a Node SEA executable. This is the more promising route for Termux because the device already supplies Node.js.
- However, `packages/cli/src/node/target.ts` still restricts targets to `darwin | linux | win32` and `arm64 | x64`. The Node asset collector requires platform-specific node-pty, Parcel watcher, FFF binary, FFF FFI, Photon WASM, app assets, and optional persistent-PTY assets. Android ARMv7 must be added as a real target and each required asset must be supplied or safely adapted; merely running the x64 `--bundle-only` baseline is not an ARMv7 build.
- Core features such as Skills, MCP, Plugins, LSP, Providers, Agents, and Sessions are largely in the CLI/server module graph. They should remain in the Node bundle, but feature parity also depends on the runtime and native adapters below.

## Native component CI results (2026-11-17)

The following GitHub Actions jobs completed successfully on the current ARMv7 branch:

| Component | Result | What is proven | What is not yet proven |
|---|---|---|---|
| OpenTUI | Success | Android ARMv7 native build/test artifact produced | Full CLI renderer startup on the Redmi 9A |
| Ghostty lib-vt | Success | ARMv7 library probe artifact produced | Integration with the Rust daemon and terminal rendering on-device |
| Parcel watcher | Success | Android ARMv7 Node-API addon cross-compiled | Recursive watcher event semantics on-device |
| Persistent PTY | Success | Protocol-8 daemon ELF32/ARM candidate cross-compiled | Protocol-8 runtime, process lifecycle, and terminal behavior on-device |
| Node ESM baseline | Success (x64 host only) | Upstream Node bundle build path and CLI smoke test on x64 | Android ARMv7 bundle or execution |

Run evidence:
- OpenTUI/native test bundle: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075779712
- Persistent PTY candidate: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075790548
- Ghostty ARMv7 probe: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075786786
- Parcel watcher candidate: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075783172

These are candidate artifacts, not an installable OpenCode release.

## Persistent PTY daemon

The persistent-PTY binding imports `binaryPath` from `@opencode/pty`. Its daemon is a separate Rust program in `packages/process-daemon`, using `portable-pty`, Unix `libc` / `nix`, and Ghostty VT. The ARMv7 cross-build now succeeds, but ABI correctness and runtime behavior still require device tests.

The Node-API forkpty adapter is a separate ordinary-PTY experiment. It must not be presented as a replacement for the protocol-8 persistent daemon.

## Filesystem watcher

Upstream uses Node's `fs.watch` for individual files and immediate directory entries, but delegates recursive directory subscriptions to `@parcel/watcher`. The Android ARMv7 addon now cross-compiles. Device tests must still verify recursive create/update/delete events, ignore rules, cancellation, and deleted-directory behavior.

## Remaining integration gates

1. Extend the upstream Node target descriptor and Node asset collector for Android ARMv7 / Bionic.
2. Supply and verify the ARMv7 OpenTUI library, Parcel watcher addon, PTY daemon, and Node-PTY adapter/launcher integration.
3. Resolve FFF binary and FFF FFI behavior without silently removing file-search functionality; verify Photon WASM and all runtime assets.
4. Build the complete Node ESM CLI bundle and run `--version`, `--help`, startup, and feature smoke tests under Android ARMv7 Node.
5. Test on the actual Redmi 9A: terminal input/output/resize, persistent sessions, recursive watching, Skills, MCP, Plugins, LSP, Providers, Agents, and Sessions.

## Release decision

Do not call the current native test bundle a final installer. Do not claim full feature parity or publish a release until the Android ARMv7 Node bundle and the on-device runtime gates above pass.