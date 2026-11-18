# Termux ARMv7 Runtime Strategy: Node Bundle-Only Path

Date: 2026-11-17
Upstream baseline: OpenCode v2.3.0

## New finding

OpenCode v2.3.0 ships a distinct Node runtime build pipeline:
- `packages/cli/script/build-node.ts`
- `packages/cli/vite.node.config.ts`
- `packages/cli/src/node/index.ts`
- `packages/cli/src/node/target.ts`

The Node entrypoint imports the Node plugin runtime and then the regular CLI entrypoint. The CLI entrypoint uses `@effect/platform-node` and `NodeRuntime.runMain`. Core package conditional exports select Node implementations for SQLite, PTY, persistent-PTY binary resolution, filesystem search, Photon WASM and TLS.

This provides a more promising route for Termux than attempting to run a Bun-compiled executable on Android.

## Important distinction: bundle-only vs SEA

The upstream `build-node.ts` has a `--bundle-only` mode. In that mode it:
1. Collects platform assets.
2. Copies assets to `dist-node/assets`.
3. Builds `dist-node/opencode.mjs` with Vite.
4. Verifies the bundle.
5. Skips Node SEA executable creation.

A Termux package could potentially run the resulting ESM bundle with the Node binary already installed in Termux, instead of shipping a standalone SEA executable. This would avoid the need for upstream to publish an Android ARMv7 Node executable.

## Remaining target work

The current upstream Node target validator only accepts Darwin/Linux/Windows and ARM64/x64. Its asset collector assumes platform-specific packages exist for:
- node-pty
- Parcel watcher
- FFF binary and ffi-rs
- OpenTUI Node assets
- Photon WASM
- persistent PTY daemon

Therefore, merely adding `android-arm` to the target list is not enough. A proper Termux target needs explicit asset resolution and platform adapters:
- Existing Android ARMv7 Node-API PTY addon and adapter in this repository.
- Android recursive watcher implementation preserving Parcel event semantics and ignore rules.
- A documented FFF fallback or Android implementation, without disabling unrelated core features.
- A decision and implementation for the protocol-8 persistent PTY daemon; the ordinary forkpty addon does not replace it.
- OpenTUI ARMv7 native assets and runtime load test.
- Photon WASM asset and all other runtime assets.

## Build-mode caveat

The Node bundle-only pipeline still uses Bun as its build orchestrator and Vite toolchain on the CI runner. That is acceptable for cross-building: the resulting runtime bundle is intended to execute under Node. The bundle itself and its native assets must still be tested on Android ARMv7.

## Proposed next implementation

Create a dedicated Termux build target and CI job that:
1. Clones the exact upstream v2.3.0 source.
2. Applies the existing Android ARMv7 PTY adapter patch.
3. Resolves Termux-specific asset paths instead of pretending Android ARMv7 is Linux ARM64.
4. Builds the Node ESM bundle in bundle-only mode.
5. Packages the bundle and verified assets with a Termux launcher.
6. Runs static checks and host-side bundle validation.
7. Publishes an artifact clearly labelled as an experimental runtime package until device-side tests pass.

## Claims not made

This discovery does not yet prove the bundle runs on Android. The Node CLI still uses native/runtime features which need explicit Android ARMv7 handling. No full feature parity or final installer is claimed until those paths and the persistent PTY daemon are resolved and tested.
