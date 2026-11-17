# OpenCode v2.3.0 Android ARMv7 Runtime Dependency Matrix

This is an engineering gate list for the Termux Node ESM bundle path. It prevents an Android ARMv7 build from being called feature-complete merely because Vite emitted opencode.mjs.

| Subsystem | Upstream Node path | Android ARMv7 status | Required acceptance test |
|---|---|---|---|
| CLI entrypoint | `packages/cli/src/node/index.ts` | Node ESM bundle path identified; not integrated | `--version`, `--help`, interactive startup |
| Node target | `packages/cli/src/node/target.ts` | Rejects Android and ARMv7 | Explicit `android-arm` target; no Linux ARM64 alias |
| Node PTY | `packages/core/src/pty/pty.node.ts` | Experimental Node-API addon + adapter in this repo | Real shell, UTF-8 output, stdin, resize, signals, exit, cwd/env |
| Persistent PTY | `packages/core/src/persistent-pty/*`, `packages/process-daemon` | Not ported | Protocol-8 lifecycle, reconnect, handoff, snapshots/read_rows, process cleanup |
| Recursive watcher | `packages/core/src/filesystem/watcher.ts` | Parcel native package unavailable for Android ARMv7 | Recursive create/update/delete, ignores, cancellation, missing-root recovery |
| File finder | `packages/core/src/filesystem/fff.node.ts` | Node FFF package/FFI assets not verified on Android | Search and file listing; graceful fallback must not disable file tools |
| OpenTUI | `@opentui/core` Node native asset | ARMv7 native build exists; Android runtime load/render not yet proven | Load library on device, render/resize, input and exit |
| Photon | `@silvia-odwyer/photon-node` + WASM | WASM asset path not yet wired/tested | Image transforms used by CLI work |
| SQLite | Node conditional export | Android Node ABI compatibility not yet audited | Create DB, migrations, read/write, restart persistence |
| Node FFI | Node `--experimental-ffi` | Simple scalar/pointer smoke succeeded on Redmi 9A | Actual OpenCode FFF FFI bindings and memory lifecycle |
| MCP / plugins / skills | Node CLI/core runtime | No Android end-to-end evidence | Launch stdio MCP server, load plugin and skill, invoke tool |
| LSP | Node CLI/core runtime + child processes | No Android end-to-end evidence | Start language server, exchange protocol, stop/restart |
| Server/Web UI | Node CLI/core runtime | No Android end-to-end evidence | Start server, open local UI, API requests |

## Why the bundle-only mode is not a shortcut around native dependencies

Upstream `build-node.ts --bundle-only` still calls `collectNodeAssets(target)` before building the Vite ESM bundle. That collector resolves platform-specific node-pty, Parcel watcher, FFF/ffi-rs, Photon WASM, OpenTUI assets and the persistent PTY binary. Thus, the current bundle-only path still fails for Android ARMv7 before Vite unless the asset collector and runtime prelude gain a deliberate Termux target.

The Node prelude also hardcodes asset paths and environment variables for those packages. An Android target must define every asset intentionally; it must not relabel Linux ARM64 packages as Android ARMv7.

## Required sequencing

1. Make the Android target explicit in Node target resolution.
2. Make asset collection explicit and fail-fast for missing assets.
3. Implement/port each native subsystem or a behaviorally compatible backend.
4. Build the ESM bundle with `--bundle-only` in CI.
5. Run the ESM bundle on a real Android ARMv7 Node 26 runtime.
6. Execute feature acceptance tests from the matrix above.
7. Only then package the final Termux installer and claim parity.

A backend fallback must state its semantics and performance characteristics. In particular, a polling filesystem watcher may preserve event delivery but can cost CPU and battery on a low-memory phone; it must be measured and cancellable before adoption.
