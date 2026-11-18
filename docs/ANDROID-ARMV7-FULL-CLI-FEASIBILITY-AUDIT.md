# Android ARMv7 Full-CLI Feasibility Audit (OpenCode v2.3.0)

Date: 2026-11-17

This audit tracks the Redmi 9A / Termux ARMv7 port and separates successful cross-compilation, host-side bundle validation, and real-device runtime validation.

## Build architecture

- The standard `packages/cli/script/build.ts` path produces a Bun-compiled executable. Its official target matrix does not include Android ARMv7.
- Upstream also has `packages/cli/script/build-node.ts`, which produces a Node.js ESM bundle. This is the selected Termux route because the phone already supplies Node.js 26.4.0; a Node SEA executable is not required.
- The Android ARMv7 target has now been added in the integration build patcher. The Node ESM bundle was built successfully for `android-arm` and passed host-side `--version` and `--help` smoke tests.
- Core features such as Skills, MCP, Plugins, LSP, Providers, Agents, and Sessions remain in the upstream CLI/server module graph. Their presence in the bundle does not by itself prove their on-device runtime behavior.

## Verified build results

| Component | Result | Evidence / remaining gate |
|---|---|---|
| OpenTUI native | Cross-build success | ARMv7 Bionic .so and native test bundle produced; device FFI/rendering tests remain |
| Node-API PTY adapter | Cross-build success | ARMv7 addon produced; device child I/O/resize/exit tests remain |
| Parcel watcher | Cross-build success | ARMv7 watcher.node produced; recursive event semantics need device tests |
| Persistent PTY | Cross-build success | Protocol-8 ELF32 ARM daemon produced; device protocol tests remain |
| Ghostty lib-vt | Cross-build success | ARMv7 static archive produced; daemon links its own build; device terminal tests remain |
| Node ESM CLI bundle | Success | Android ARMv7 target bundle generated; `--version` and `--help` passed on x64 host |
| Full Termux package assembly | In progress | Workflow downloads native artifacts and assembles a one-directory candidate; must complete and pass device tests |

Node ESM bundle run:
- https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44078993963
- Artifact: `OPENCODE-ANDROID-ARMV7-NODE-CLI-BUNDLE-CANDIDATE`
- Artifact ID: `14326351972`
- Bundle output: approximately 22.58 MB before artifact compression.

Native component run evidence:
- OpenTUI/native test bundle: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075779712
- Persistent PTY candidate: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075790548
- Ghostty ARMv7 probe: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075786786
- Parcel watcher candidate: https://github.com/gikoko611/GIKOKO-OPENCODE-ARM32/actions/runs/44075783172

## Runtime integration details

- The Android Node PTY adapter loads its Node-API addon lazily, so non-terminal commands such as `--version` and `--help` do not fail on the x64 build runner because the Android-only .node file is absent.
- Android recursive watching uses the inotify backend through the ARMv7 Parcel watcher addon.
- OpenTUI's Node runtime resolver is patched to honor an explicit `OPENTUI_LIB_PATH` before trying to resolve an unsupported platform target.
- The Termux launcher sets explicit paths for the OpenTUI library, PTY addon, Parcel watcher, Photon WASM, and persistent PTY daemon.
- Upstream `packages/core/src/filesystem/search.ts` falls back to its ripgrep-backed search layer whenever `Fff.available()` is false. The Android package therefore requires the Termux `ripgrep` executable when FFF native acceleration is unavailable; file search is not intentionally disabled.

## Remaining release gates

1. The combined package workflow must download and verify the latest successful OpenTUI, Parcel, PTY, and Ghostty artifacts.
2. Confirm the packaged OpenTUI, Node-API addon, Parcel watcher, and persistent daemon are all ELF32 ARM / Android Bionic-compatible and load on the phone.
3. Confirm the ripgrep fallback is available on Termux and Photon WASM assets resolve correctly.
4. Run on-device tests for terminal input/output/resize, persistent sessions, recursive file watching, Skills, MCP, Plugins, LSP, Providers, Agents, and Sessions.
5. Fix every device/runtime failure before calling the package a release.

## Release decision

The Node ESM CLI bundle is built, but the combined package and on-device feature parity are not yet verified. Do not call the candidate a final installer until the remaining gates pass.