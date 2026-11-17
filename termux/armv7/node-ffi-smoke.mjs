import assert from "node:assert/strict"
import { dlopen } from "node:ffi"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const libraryPath = path.resolve(process.argv[2] ?? path.join(here, "libnode-ffi-smoke.so"))

if (process.arch !== "arm") {
  throw new Error(`Expected 32-bit ARM Node (process.arch=arm), got ${process.arch}`)
}
const [major, minor] = process.versions.node.split(".").map(Number)
if (major < 26 || (major === 26 && minor < 4)) {
  throw new Error(`OpenTUI Node backend requires Node >=26.4.0; found ${process.versions.node}`)
}

const { lib, functions } = dlopen(libraryPath, {
  armv7_ffi_add_i32: { arguments: ["i32", "i32"], return: "i32" },
  armv7_ffi_xor_u64: { arguments: ["u64", "u64"], return: "u64" },
  armv7_ffi_add_f64: { arguments: ["f64", "f64"], return: "f64" },
  armv7_ffi_echo_pointer: { arguments: ["pointer"], return: "pointer" },
})

try {
  assert.equal(functions.armv7_ffi_add_i32(20, 22), 42)
  assert.equal(functions.armv7_ffi_xor_u64(0x123456789abcdef0n, 0x0f0f0f0f0f0f0f0fn), 0x1d3b597795b3d1ffn)
  assert.equal(functions.armv7_ffi_add_f64(1.25, 2.5), 3.75)
  assert.equal(functions.armv7_ffi_echo_pointer(0x12345678n), 0x12345678n)
  console.log("PASS: Node node:ffi loaded Android ARMv7 .so")
  console.log("PASS: i32, u64, f64 and pointer argument/return calls")
  console.log(`Node: ${process.versions.node}; arch: ${process.arch}; platform: ${process.platform}`)
} finally {
  lib.close()
}
