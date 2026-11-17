#!/usr/bin/env python3
"""Make the Android OpenTUI native library override work before platform detection."""
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
base = root / "node_modules/.bun"
if not base.is_dir():
    raise SystemExit(f"Expected Bun dependency store: {base}")
matches = list(base.rglob("runtime-assets.node.ts"))
patched = []
for path in matches:
    source = path.read_text()
    old = '''export async function resolveNativeLibraryPath(): Promise<string> {
  const asset = getNativeAssetDescriptor(getCurrentNodeAssetTarget())
  if (process.env.OPENTUI_LIB_PATH) {
    return resolve(process.env.OPENTUI_LIB_PATH)
  }
'''
    new = '''export async function resolveNativeLibraryPath(): Promise<string> {
  // Android ARMv7 supplies the Bionic library explicitly from the Termux package.
  if (process.env.OPENTUI_LIB_PATH) {
    return resolve(process.env.OPENTUI_LIB_PATH)
  }
  const asset = getNativeAssetDescriptor(getCurrentNodeAssetTarget())
'''
    if old in source:
        path.write_text(source.replace(old, new, 1))
        patched.append(str(path))
if not patched:
    raise SystemExit("Could not find the OpenTUI Node runtime asset resolver; refusing to ship an unsupported target.")
print("Patched OpenTUI native path resolver:")
for item in patched:
    print(item)
