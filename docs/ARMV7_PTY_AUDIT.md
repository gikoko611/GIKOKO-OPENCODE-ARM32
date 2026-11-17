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
