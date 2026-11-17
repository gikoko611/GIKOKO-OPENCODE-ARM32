# Android ARMv7 Full-CLI Feasibility Audit (OpenCode v2.3.0)

Date: 2026-11-17

This audit records upstream runtime constraints discovered while continuing the Redmi 9A / Termux ARMv7 port. It intentionally distinguishes cross-compiled probes from a runnable OpenCode CLI.

## Confirmed upstream build architecture

- OpenCode v2.3.0's `packages/cli/script/build.ts` produces a Bun-compiled executable, not a Node.js application bundle.
- Its target table contains Linux/macOS/Windows ARM64 and x64 variants only. The target type is restricted to `arm64 | x64`.
- The build resolves platform-specific `@opencode/pty` daemon packages and `@parcel/watcher` packages for the listed targets. Android ARMv7 has no declared target.
- Core also depends on `@ff-labs/fff-bun` / `@ff-labs/fff-node`, `@silvia-odwyer/photon-node`, `bun-pty`, and `@lydell/node-pty`. Each must be audited for the selected runtime and ABI; compiling the CLI alone is insufficient.

## Persistent PTY daemon is a separate native program

The core persistent-PTY binding imports `binaryPath` from `@opencode/pty`. The CLI build embeds a separate `opencode-pty` executable resolved by `packages/cli/script/opencode-pty.ts`.

In v2.3.0 its source is `packages/process-daemon`, a Rust crate using `portable-pty`, Unix `libc` / `nix`, and a directly linked Ghostty VT implementation. The crate's README documents generated FFI layout assertions for supported 64-bit platforms. Therefore, simply adding an Android ARMv7 target to the npm package resolver or compiling the Rust crate is not a valid port. The 32-bit ABI, Ghostty C layout/bindings, Zig build, PTY transport, and runtime behavior all need explicit engineering and tests.

The Node-API forkpty addon in this repository is the ordinary PTY adapter groundwork. It is not a replacement for the protocol-8 persistent daemon and must not be represented as one.

## Filesystem watcher behavior

Upstream `packages/core/src/filesystem/watcher.ts` uses Node's `fs.watch` for individual files and immediate directory entries, but delegates recursive directory subscriptions to `@parcel/watcher`. The package resolver in the CLI build expects a platform-specific Parcel native package. No Android ARMv7 package is declared.

A valid Android backend must preserve recursive create/update/delete delivery, ignore rules, subscription cancellation, and behavior when directories disappear. Disabling the watcher or silently returning an empty stream would regress file watching and project refresh behavior.

## Build/runtime gate

The native test bundle workflow currently proves Android Bionic/ARMv7 compilation and source-level adapter integration. It does not prove that the OpenCode v2.3.0 CLI can execute on Android, because the upstream CLI is compiled by Bun and the official target matrix does not include Android ARMv7.

Before a full installer can be called complete, the project needs:
1. A supported ARMv7 Android execution runtime for the Bun APIs used by the CLI, or a genuine Node-compatible port of all Bun-specific build/runtime behavior.
2. A tested protocol-8 persistent PTY daemon strategy (including Ghostty/32-bit feasibility).
3. A recursive Android filesystem watcher preserving upstream semantics.
4. ARMv7 Android builds or safe compatible replacements for every remaining native dependency.
5. End-to-end Redmi 9A tests for CLI startup, sessions, tools, MCP, LSP, plugins, skills, terminal operations, and file watching.

## Status

The existing native probes and Node-API PTY adapter are useful prerequisites, not a complete OpenCode CLI. Do not label the current native test bundle as the final installer and do not claim upstream feature parity until the gates above pass.
