#!/usr/bin/env python3
"""Patch Android native library override into the installed OpenTUI Node resolver."""
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
specifiers = [
    root / "node_modules/@opentui/core",
    root / "node_modules/@androidtui/core",
    root / "packages/cli/node_modules/@opentui/core",
    root / "packages/cli/node_modules/@androidtui/core",
]
roots = []
for item in specifiers:
    if item.exists():
        resolved = item.resolve()
        if resolved.is_dir() and resolved not in roots:
            roots.append(resolved)
if not roots:
    raise SystemExit("Could not resolve installed @opentui/core or @androidtui/core package.")

patched = []
already_safe = []
for package_root in roots:
    for path in package_root.rglob("*"):
        if not path.is_file() or path.suffix not in {".ts", ".js", ".mjs", ".cjs"}:
            continue
        try:
            source = path.read_text()
        except (UnicodeDecodeError, OSError):
            continue
        index = source.find("resolveNativeLibraryPath")
        if index < 0:
            continue
        brace = source.find("{", index)
        if brace < 0:
            continue
        end = source.find("\n}", brace)
        if end < 0:
            end = min(len(source), brace + 5000)
        body = source[brace:end]
        override = body.find("OPENTUI_LIB_PATH")
        descriptor = body.find("getNativeAssetDescriptor")
        if override >= 0 and (descriptor < 0 or override < descriptor):
            already_safe.append(str(path))
            continue
        injection = '\n  if (process.env.OPENTUI_LIB_PATH) return process.env.OPENTUI_LIB_PATH\n'
        source = source[:brace + 1] + injection + source[brace + 1:]
        path.write_text(source)
        patched.append(str(path))

if not patched and not already_safe:
    listing = "\n".join(str(p) for p in roots)
    raise SystemExit("OpenTUI package found, but resolveNativeLibraryPath was not located under:\n" + listing)
print("OpenTUI Node native resolver:")
for item in patched:
    print("PATCHED " + item)
for item in already_safe:
    print("ALREADY COMPATIBLE " + item)
