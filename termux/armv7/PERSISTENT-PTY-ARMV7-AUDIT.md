# Persistent PTY ARMv7 port audit

Pinned upstream: OpenCode v2.3.0, `packages/process-daemon`, package version 0.5.2.

## Findings

The regular Node PTY adapter and OpenCode's persistent PTY are different layers. The latter is a Rust daemon implementing protocol 8 and is loaded through `@opencode/pty`. Replacing it with the small Node-API `forkpty` addon would silently remove persistent sessions, owner handoff, subscriptions, replay buffers, process metadata, pipe processes, and Ghostty-backed terminal snapshots. This port must not do that.

The pinned source has three concrete ARMv7 blockers:

1. `packages/process-daemon/build.rs` maps cross targets only for x86_64 and aarch64 Linux, macOS, and Windows. It has no Android ARMv7 target mapping.
2. `packages/process-daemon/src/ghostty/ffi.rs` contains generated ABI assertions for 64-bit layouts. For example, `GhosttyString` is asserted to be 16 bytes with 8-byte alignment and its `len` field at offset 8. Those assertions cannot be used unchanged on 32-bit ARM.
3. `packages/process-daemon/npm/package.json` publishes optional binaries only for macOS, Linux arm64/x64, and Windows arm64/x64. The CLI resolver in `packages/cli/script/opencode-pty.ts` also rejects Android and every architecture except arm64/x64.

## Required implementation sequence

- Confirm the pinned Ghostty revision can build its VT library for Android `arm-linux-androideabi` with the NDK API 29 sysroot and the supported Zig toolchain. Do not assume the OpenTUI Zig patches apply to Ghostty.
- Generate and review a separate 32-bit ARM C ABI binding set from the exact pinned Ghostty headers. Keep the existing 64-bit bindings unchanged; add compile-time layout assertions for both ABIs.
- Add an Android Unix transport/daemon build path and verify `portable-pty`, socket permissions, process lifecycle, and signal handling on Bionic.
- Publish and resolve a dedicated Android ARMv7 binary package only after native build and device runtime tests pass.
- Run protocol-8 compatibility tests for daemon ownership/handoff, multiple terminals, input/output, resize, subscriptions, replay, snapshots, exit cleanup, and pipe processes.

## Current decision

The Node-API PTY probe remains a separate non-persistent fallback experiment. It is not wired as a substitute for the protocol-8 daemon. Until the Ghostty 32-bit ABI and daemon path are proven, the persistent PTY feature is explicitly marked **not ported** rather than silently disabled or falsely advertised as complete.
