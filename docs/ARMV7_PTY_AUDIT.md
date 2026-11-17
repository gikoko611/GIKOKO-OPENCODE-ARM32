# ARMv7 Termux PTY compatibility audit

## Target

- Android 10 / API 29
- Termux 32-bit ARM userspace (`process.arch === "arm"`)
- Bionic libc, ARM EABI5
- OpenCode v2.3.0 Node runtime path

## Upstream OpenCode PTY integration

At OpenCode v2.3.0, `packages/core/src/pty/pty.node.ts` loads `@lydell/node-pty` (or the path in `OPENCODE_NODE_PTY_PATH`) and wraps its `spawn`, `onData`, `onExit`, `write`, `resize`, and `kill` methods. The public PTY interface requires PID, data/exit events, input writes, terminal resize, and signal-aware termination.

The Node-specific persistent-PTY binary resolver in `packages/core/src/persistent-pty/binary.node.ts` simply returns `OPENCODE_PTY_BIN` or the command name `opencode-pty`. It does not install or download a platform binary itself. The normal Bun implementation has a separate asset installation path, so the Node/ARMv7 port must explicitly package and locate a compatible `opencode-pty` executable if persistent PTY is enabled.

## Native dependency finding

OpenCode v2.3.0 declares `@lydell/node-pty` as its Node PTY dependency. The package's published platform list contains macOS ARM64/x64, Linux ARM64/x64, and Windows ARM64/x64, but no Android or 32-bit ARM. Its README says it only works where a matching prebuilt exists and does not invoke node-gyp to compile unsupported targets. Therefore it cannot be assumed to work on Termux ARMv7.

An Android Termux fork, `@mmmbuto/node-pty-android-arm64`, exists for **ARM64 only**. It is not compatible with the Redmi 9A's 32-bit ARM userspace and must not be installed as an ARMv7 solution. The published `@mmmbuto/pty-termux-utils` package also lists only Android ARM64 and Linux ARM64 native providers, with a child-process fallback; it is not a full PTY substitute for interactive terminal semantics.

## Required ARMv7 implementation

A supported ARMv7 Node PTY path needs one of these approaches:

1. Build a dedicated Android/Bionic ARMv7 Node-API addon from the Microsoft node-pty source, adapting its build scripts and native sources to the NDK/API 29 and Termux Node ABI; or
2. Implement a small, audited ARMv7 Node-API addon over Android/Bionic PTY primitives, preserving the upstream `Proc` interface and correct child lifecycle; or
3. Use a compatible ARMv7 `opencode-pty` executable for persistent sessions, while separately satisfying the interactive PTY API required by `pty.node.ts`.

Do not replace PTY with plain `child_process.spawn` and claim equivalent functionality. A pipe-based fallback loses terminal semantics such as TTY detection, terminal modes, resize propagation, and interactive shell behavior. Preserve full PTY behavior for tools that require an interactive terminal.

## Validation matrix

- [ ] Native module is ELF32 ARM EABI5 and links only against Android/Termux-compatible libraries.
- [ ] Node can load the addon on-device without ABI mismatch.
- [ ] Spawn an interactive shell and receive output through `onData`.
- [ ] Send input through `write` and verify shell response.
- [ ] Resize the PTY and verify the child sees the new terminal dimensions.
- [ ] Verify exit code and signal reporting through `onExit`.
- [ ] Verify `kill` terminates the process and closes descriptors.
- [ ] Verify repeated spawn/exit cycles do not leak file descriptors or child processes.
- [ ] Verify persistent `opencode-pty` startup, reconnect, cleanup, and process ownership.
- [ ] Run the full tests on Redmi 9A / Android 10 / 32-bit Termux.

## References

- OpenCode v2.3.0 Node PTY adapter: https://github.com/anomalyco/opencode/blob/v2.3.0/packages/core/src/pty/pty.node.ts
- OpenCode v2.3.0 PTY interface: https://github.com/anomalyco/opencode/blob/v2.3.0/packages/core/src/pty/pty.ts
- OpenCode v2.3.0 Node persistent-PTY resolver: https://github.com/anomalyco/opencode/blob/v2.3.0/packages/core/src/persistent-pty/binary.node.ts
- `@lydell/node-pty` platform/prebuild constraints: https://www.npmjs.com/package/@lydell/node-pty
- Android Termux node-pty fork (ARM64 only): https://github.com/DioNanos/node-pty-android-arm64

## Decision

PTY is a blocking integration item for a full ARMv7 OpenCode port. Do not silently disable terminal tools, persistent sessions, or shell features. Continue with a dedicated ARMv7 Android/Bionic PTY build and validate it on the target device.


## Android API feasibility check

Android Bionic documents `forkpty` and `openpty` as available starting at API level 23. The target device is Android 10 / API 29, so these PTY primitives are part of the target platform baseline. This removes the concern that the underlying libc simply lacks the required PTY entry points; it does **not** make the upstream Node addon compatible automatically.

A practical implementation candidate is a small Android/Bionic ARMv7 Node-API addon or a carefully scoped native helper using `openpty`/`forkpty`, `ioctl(TIOCSWINSZ)`, `read`/`write`, `waitpid`, and signal delivery. It must keep fork/exec handling safe in a multithreaded Node process, avoid blocking the JS event loop, and implement descriptor/child cleanup. Validate all of this on-device before replacing `@lydell/node-pty`.

Bionic API reference: https://android.googlesource.com/platform/bionic/+/HEAD/docs/status.md (the PTY entry points are listed under API level 23).


## Additional upstream persistent-PTY audit (OpenCode v2.3.0)

OpenCode has two separate PTY integration layers that must both be handled:

1. Interactive shell PTY: `packages/core/src/pty/pty.node.ts` loads `@lydell/node-pty` and exposes the `Proc` API.
2. Persistent PTY service: `@opencode/pty` (workspace source at `packages/process-daemon`) ships the `opencode-pty` daemon executable and uses `portable-pty` plus Ghostty VT.

The persistent daemon's npm package optional dependencies are only:
- macOS ARM64/x64
- Linux ARM64/x64 (glibc and musl)
- Windows ARM64/x64

The pinned CLI resolver in `packages/cli/script/opencode-pty.ts` explicitly returns no asset unless the platform is macOS/Linux/Windows and the architecture is ARM64/x64. Android ARMv7 is therefore excluded before any binary lookup. The package build script also maps only those listed target triples; its Ghostty Zig build target mapping does not include `armv7-linux-androideabi`.

The daemon source is Rust (edition 2024, Rust 1.90) and depends on `portable-pty`, `nix`, and a pinned Ghostty VT static library built through Zig. A dedicated Android ARMv7 port is more than a simple Rust target flag: the build script's Ghostty target mapping, Bionic linkage, process/signal semantics, filesystem ownership/locking, and Unix socket behavior all need explicit validation. Do not assume a generic `cargo build --target armv7-linux-androideabi` is sufficient.

### Updated PTY decision

The Node FFI smoke test has passed on the Redmi 9A, but this does not change the PTY blocker. The next PTY implementation must support both:
- `@lydell/node-pty`-compatible interactive process semantics; and
- the separate `opencode-pty` persistent daemon protocol and lifecycle.

Keep the two implementations independently testable. Do not replace either with pipe-based `child_process.spawn` and silently lose terminal semantics or persistent-session ownership/handoff.


## ARMv7 Bionic PTY primitive probe

A separate compile-and-device-test probe is being added before attempting a Node-API
PTY implementation. The probe calls Android/Bionic `openpty()`, applies terminal
dimensions with `TIOCSWINSZ`, reads them back with `TIOCGWINSZ`, and closes
both descriptors. It is intentionally not presented as a complete PTY backend:
it does not fork/exec a child, stream data, implement resize events in Node, or
manage process exit and signals.

The CI artifact will include:
- `libpty-api-smoke-android-armv7.so`
- `node-pty-api-smoke.mjs`
- `test-pty-api-armv7.sh`
- ELF header and dynamic dependency reports

After extracting the artifact into `~/pty-armv7-test`, run:

```sh
cd ~/pty-armv7-test
bash test-pty-api-armv7.sh ./libpty-api-smoke-android-armv7.so
```

A successful on-device result proves only that Bionic PTY allocation and terminal
window-size ioctls work through the installed ARMv7 Node FFI. The next implementation
must still cover child creation, controlling-terminal/session setup, nonblocking
I/O, resize propagation, signal/exit handling, and descriptor cleanup.


## Node-API PTY implementation progress (2026-11-17)

The Android NDK/API 29 workflow has now successfully compiled an ELF32 ARM EABI5 soft-float Node-API v8 addon against Node 26.4.0 headers. The addon currently exposes:

- `spawn(file, args, rows, cols[, cwd, env])`: `forkpty` + `execvp`, with optional working-directory and environment overrides.
- `resize(fd, rows, cols)`: `TIOCSWINSZ`.
- `signal(pid, signal)`: child signal delivery.
- `wait(pid)`: nonblocking `waitpid(WNOHANG)` status polling.
- `close(fd)`: PTY master descriptor cleanup.

The device smoke script now checks child output/input, terminal resizing, exit status, working-directory propagation, and environment propagation. These are still device-side checks: successful cross-compilation alone does not prove the addon loads or behaves correctly on the Redmi 9A.

A first Node adapter for OpenCode's `Proc` interface has also been added at `termux/armv7/pty-termux.node.ts`. The build-tree integration script `termux/ci/apply-armv7-pty-adapter.sh` copies it into the pinned v2.3.0 source and routes Android/ARM Node PTY calls through it while leaving other platforms unchanged. CI now applies this adapter to a clean upstream v2.3.0 checkout and bundles the resulting Node entrypoint as a validation step.

**Still not complete:** the adapter has not yet passed the new upstream bundle check or Redmi 9A runtime testing; the separate `opencode-pty` persistent daemon remains unported; the Android ARMv7 filesystem watcher and remaining native assets remain blockers. Do not label this a complete OpenCode CLI port or final installer until those items and end-to-end device tests pass.
