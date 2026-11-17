import assert from "node:assert/strict"
import { dlopen } from "node:ffi"
import path from "node:path"
import { fileURLToPath } from "node:url"

if (process.platform !== "android" || process.arch !== "arm") {
  throw new Error(`Expected Android ARMv7 Node; got ${process.platform}/${process.arch}`)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const libraryPath = path.resolve(process.argv[2] ?? path.join(here, "libpty-api-smoke-android-armv7.so"))
const { lib, functions } = dlopen(libraryPath, {
  armv7_pty_api_version: { arguments: [], return: "i32" },
  armv7_openpty_resize_probe: { arguments: [], return: "i32" },
})

try {
  assert.equal(functions.armv7_pty_api_version(), 1)
  const result = functions.armv7_openpty_resize_probe()
  assert.equal(result, 0, `openpty/ioctl PTY probe failed with code ${result}`)
  console.log("PASS: Android Bionic openpty() created a PTY pair")
  console.log("PASS: TIOCSWINSZ/TIOCGWINSZ verified 24x80 terminal dimensions")
  console.log(`Node: ${process.versions.node}; arch: ${process.arch}; platform: ${process.platform}`)
} finally {
  lib.close()
}
