#!/usr/bin/env python3
"""Prepare the pinned upstream Node ESM bundle for Android ARMv7.

This builds a Node ESM bundle for the Node runtime already present in Termux.
It intentionally does not claim to create a Node SEA binary or package missing
native assets. Those remain explicit release gates.
"""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1]).resolve()
repo = Path.cwd()
target = root / "packages/cli/src/node/target.ts"
build = root / "packages/cli/script/build-node.ts"
assets = root / "packages/cli/script/node-assets.ts"
pty = root / "packages/core/src/pty/pty.node.ts"
watcher = root / "packages/core/src/filesystem/watcher.ts"

def replace_once(path: Path, old: str, new: str):
    data = path.read_text()
    if data.count(old) != 1:
        raise SystemExit(f"{path}: expected one patch anchor, got {data.count(old)}: {old[:90]!r}")
    path.write_text(data.replace(old, new, 1))

replace_once(target,
    'const platforms = ["darwin", "linux", "win32"] as const',
    'const platforms = ["android", "darwin", "linux", "win32"] as const')
replace_once(target,
    '(arch !== "arm64" && arch !== "x64")',
    '(arch !== "arm64" && arch !== "x64" && !(platform === "android" && arch === "arm"))')
replace_once(target,
    '  const targetArch = arch as "arm64" | "x64"',
    '  const targetArch = arch as "arm64" | "x64" | "arm"')
replace_once(build,
    'const allTargets = [\n',
    'const allTargets = [\n  nodeTarget("android", "arm"),\n')

# The Android PTY adapter is loaded directly from the Termux package at runtime.
replace_once(target,
    '  const nodePtyPackage = `@lydell/node-pty-${targetPlatform}-${targetArch}`',
    '  const nodePtyPackage = targetPlatform === "android" ? "@gikoko/termux-node-pty-android-armv7" : `@lydell/node-pty-${targetPlatform}-${targetArch}`')
replace_once(target,
    '  const parcelWatcherPackage = `@parcel/watcher-${targetPlatform}-${targetArch}${targetPlatform === "linux" ? "-glibc" : ""}`',
    '  const parcelWatcherPackage = targetPlatform === "android" ? "@gikoko/parcel-watcher-android-armv7" : `@parcel/watcher-${targetPlatform}-${targetArch}${targetPlatform === "linux" ? "-glibc" : ""}`')
replace_once(target,
    '  const fffPackage = `@ff-labs/fff-bin-${targetPlatform}-${targetArch}${targetPlatform === "linux" ? "-gnu" : ""}`',
    '  const fffPackage = targetPlatform === "android" ? "@gikoko/fff-bin-android-armv7" : `@ff-labs/fff-bin-${targetPlatform}-${targetArch}${targetPlatform === "linux" ? "-gnu" : ""}`')
replace_once(target,
    '  const fffFfiPackage = `@yuuang/ffi-rs-${targetPlatform}-${targetArch}${targetPlatform === "linux" ? "-gnu" : targetPlatform === "win32" ? "-msvc" : ""}`',
    '  const fffFfiPackage = targetPlatform === "android" ? "@gikoko/ffi-rs-android-armv7" : `@yuuang/ffi-rs-${targetPlatform}-${targetArch}${targetPlatform === "linux" ? "-gnu" : targetPlatform === "win32" ? "-msvc" : ""}`')

# Stage portable Photon WASM and sound files only. No unavailable ARMv7 native
# binary is substituted or silently relabeled as a compatible artifact.
data = assets.read_text()
data = data.replace('import { getNodeAssets } from "@opentui/core/node-assets"\n', '')
data = data.replace('import { collectFiles } from "./files"\n', '')
data = data.replace('import { resolveOpencodePty } from "./opencode-pty"\n', '')
old = '''  const opencodePty = await resolveOpencodePty({
    platform: target.platform,
    arch: target.arch,
    ...(target.platform === "linux" ? { libc: "glibc" as const } : {}),
  })
  const ptyEntry = fileURLToPath(import.meta.resolve(target.nodePtyPackage))
  const ptyRoot = path.resolve(path.dirname(ptyEntry), "..")
  const assets: NodeAsset[] = [
    ...getNodeAssets({
      platform: target.platform,
      arch: target.arch,
      ...(target.platform === "linux" ? { libc: "glibc" as const } : {}),
    }),
    { key: target.parcelWatcherAsset, source: fileURLToPath(import.meta.resolve(target.parcelWatcherPackage)) },
    { key: target.fffAsset, source: fileURLToPath(import.meta.resolve(target.fffPackage)) },
    { key: target.fffFfiAsset, source: fileURLToPath(import.meta.resolve(target.fffFfiPackage)) },
'''
if data.count(old) != 1:
    raise SystemExit(f"{assets}: native asset collector anchor count {data.count(old)}")
data = data.replace(old, '''  const assets: NodeAsset[] = [
''', 1)
old_tail = '''    ...(opencodePty && target.opencodePtyAsset ? [{ key: target.opencodePtyAsset, source: opencodePty.source }] : []),
    ...(await collectFiles(ptyRoot))
      .filter((relative) => !relative.endsWith(".map") && !relative.endsWith(".pdb"))
      .map((relative) => ({
        key: `${target.nodePtyPackage}/${relative}`,
        source: path.join(ptyRoot, relative),
      })),
'''
if data.count(old_tail) != 1:
    raise SystemExit(f"{assets}: native asset tail count {data.count(old_tail)}")
data = data.replace(old_tail, "", 1)
assets.write_text(data)

# Bundle in the Android-specific PTY adapter. The .node binary is installed
# separately by the Termux package, not bundled as an unverified artifact.
termux_adapter = repo / "termux/armv7/pty-termux.node.ts"
if not termux_adapter.is_file():
    raise SystemExit(f"Missing adapter source: {termux_adapter}")
shutil.copy2(termux_adapter, root / "packages/core/src/pty/pty.termux.node.ts")
source = pty.read_text()
source = source.replace('import type { Opts, Proc } from "./pty.js"\n',
    'import type { Opts, Proc } from "./pty.js"\nimport { spawn as spawnTermux } from "./pty.termux.node.js"\n', 1)
old = '''const pty = createRequire(import.meta.url)(process.env.OPENCODE_NODE_PTY_PATH ?? "@lydell/node-pty") as {
  spawn: typeof spawn
}

function spawnPty(file: string, args: string[], opts: Opts): Proc {
  const proc = pty.spawn(file, args, process.platform === "win32" && isSea() ? { ...opts, useConptyDll: true } : opts)
'''
new = '''function spawnPty(file: string, args: string[], opts: Opts): Proc {
  if (process.platform === "android" && process.arch === "arm") return spawnTermux(file, args, opts)
  const pty = createRequire(import.meta.url)(process.env.OPENCODE_NODE_PTY_PATH ?? "@lydell/node-pty") as {
    spawn: typeof spawn
  }
  const proc = pty.spawn(file, args, process.platform === "win32" && isSea() ? { ...opts, useConptyDll: true } : opts)
'''
if source.count(old) != 1:
    raise SystemExit("Could not safely make node-pty require lazy for Android")
source = source.replace(old, new, 1)
pty.write_text(source)

replace_once(watcher,
    '  if (process.platform === "linux") return "inotify"',
    '  if (process.platform === "linux" || process.platform === "android") return "inotify"')

print("Android ARMv7 Node ESM target patched.")
print("Native runtime assets still need separate integration: OpenTUI, Parcel, FFF/FFI, PTY and persistent PTY.")
