import assert from "node:assert/strict"
import { createReadStream, writeSync } from "node:fs"
import { setTimeout as delay } from "node:timers/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

if (process.platform !== "android" || process.arch !== "arm") {
  throw new Error(`Expected Android ARMv7 Node; got ${process.platform}/${process.arch}`)
}
const here = path.dirname(fileURLToPath(import.meta.url))
const addonPath = path.resolve(process.argv[2] ?? path.join(here, "termux-pty-android-armv7.node"))
const require = createRequire(import.meta.url)
const api = require(addonPath)
for (const name of ["spawn", "resize", "signal", "wait", "close"]) {
  assert.equal(typeof api[name], "function", `missing N-API method: ${name}`)
}
const child = api.spawn("/system/bin/sh", ["-c", "printf 'NAPI_PTY_READY\\n'; IFS= read -r input; printf 'NAPI_INPUT:%s\\n' \"$input\"; stty size; exit 9"], 24, 80)
assert.ok(child.pid > 1 && child.fd >= 0, "spawn must return child pid and PTY master fd")
let output = ""
const stream = createReadStream(null, { fd: child.fd, autoClose: false })
stream.setEncoding("utf8")
stream.on("data", chunk => { output += chunk })
api.resize(child.fd, 40, 100)
writeSync(child.fd, "TERMUX_NAPI_ARMV7\\n")
const deadline = Date.now() + 7000
let exit = null
while (Date.now() < deadline) {
  exit = api.wait(child.pid)
  if (exit) break
  await delay(50)
}
if (!exit) {
  api.signal(child.pid, 9)
  stream.destroy()
  api.close(child.fd)
  throw new Error(`PTY child timed out; output: ${JSON.stringify(output)}`)
}
await delay(100)
stream.destroy()
api.close(child.fd)
assert.equal(exit.exitCode, 9, `unexpected child exit: ${JSON.stringify(exit)}`)
assert.match(output, /NAPI_PTY_READY/)
assert.match(output, /NAPI_INPUT:TERMUX_NAPI_ARMV7/)
assert.match(output, /40 100/)
console.log("PASS: Node-API addon loaded on Android ARMv7")
console.log("PASS: forkpty spawned /system/bin/sh with a controlling terminal")
console.log("PASS: PTY output/input, resize, waitpid exit status and fd cleanup")
console.log(`Node: ${process.versions.node}; arch: ${process.arch}; platform: ${process.platform}`)
