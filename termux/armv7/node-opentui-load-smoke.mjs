import assert from "node:assert/strict"
import { dlopen } from "node:ffi"
import path from "node:path"
import { fileURLToPath } from "node:url"

if (process.arch !== "arm" || process.platform !== "android") {
  throw new Error(`Expected Android ARMv7 Node; got ${process.platform}/${process.arch}`)
}
const here = path.dirname(fileURLToPath(import.meta.url))
const libraryPath = path.resolve(process.argv[2] ?? path.join(here, "libopentui-android-armv7.so"))
const { lib, functions } = dlopen(libraryPath, {
  ot_context_abi_version: { arguments: [], return: "u32" },
})
try {
  const version = functions.ot_context_abi_version()
  assert.ok(Number.isInteger(version) && version > 0, `Unexpected OpenTUI ABI version: ${version}`)
  console.log("PASS: Node node:ffi loaded the actual OpenTUI Android ARMv7 library")
  console.log(`PASS: ot_context_abi_version() = ${version}`)
  console.log(`Node: ${process.versions.node}; arch: ${process.arch}; platform: ${process.platform}`)
} finally {
  lib.close()
}
