import assert from "node:assert/strict"
import { dlopen } from "node:ffi"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const libraryPath = path.resolve(process.argv[2] ?? process.env.OPENTUI_LIB_PATH ?? path.join(here, "libopentui-android-armv7.so"))

if (process.arch !== "arm") {
  throw new Error(`Expected 32-bit ARM Node (process.arch=arm), got ${process.arch}`)
}
if (process.platform !== "android") {
  throw new Error(`Expected Android Node runtime, got ${process.platform}`)
}
const [major, minor] = process.versions.node.split(".").map(Number)
if (major < 26 || (major === 26 && minor < 4)) {
  throw new Error(`OpenTUI Node backend requires Node >=26.4.0; found ${process.versions.node}`)
}

const { lib, functions } = dlopen(libraryPath, {
  ot_context_abi_version: { arguments: [], return: "u32" },
})

try {
  const actual = functions.ot_context_abi_version()
  const expected = 2
  assert.equal(actual, expected, `OpenTUI context ABI mismatch: expected ${expected}, got ${actual}`)
  console.log("PASS: Node node:ffi loaded the real OpenTUI Android ARMv7 native library")
  console.log(`PASS: ot_context_abi_version() = ${actual}`)
  console.log(`Node: ${process.versions.node}; arch: ${process.arch}; platform: ${process.platform}`)
  console.log(`Library: ${libraryPath}`)
} finally {
  lib.close()
}
