import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"

if (process.arch !== "arm") throw new Error(`Expected ARM32 Node, got ${process.arch}`)
if (process.platform !== "android") throw new Error(`Expected Android Node, got ${process.platform}`)
const [major, minor] = process.versions.node.split(".").map(Number)
if (major < 26 || (major === 26 && minor < 4)) throw new Error(`Expected Node >=26.4.0, got ${process.versions.node}`)

const directory = await mkdtemp(path.join(tmpdir(), "opencode-armv7-runtime-"))
try {
  const file = path.join(directory, "runtime-check.txt")
  await writeFile(file, "ARMV7_TERMUX_FS_OK", "utf8")
  assert.equal(await readFile(file, "utf8"), "ARMV7_TERMUX_FS_OK")
  console.log("PASS: Node ESM and filesystem read/write")

  const shell = spawnSync("/system/bin/sh", ["-c", "printf TERMUX_CHILD_PROCESS_OK"], { encoding: "utf8" })
  assert.equal(shell.status, 0, shell.stderr)
  assert.equal(shell.stdout, "TERMUX_CHILD_PROCESS_OK")
  console.log("PASS: Android /system/bin/sh child process")

  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" })
  const exited = once(child, "exit")
  await once(child, "spawn")
  assert.equal(child.kill("SIGTERM"), true, "SIGTERM should be delivered to child")
  const [code, signal] = await Promise.race([
    exited,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Child did not exit after SIGTERM")), 5000)),
  ])
  assert.equal(code, null)
  assert.equal(signal, "SIGTERM")
  console.log("PASS: Node child process signal delivery and exit event")
  console.log(`Node: ${process.versions.node}; arch: ${process.arch}; platform: ${process.platform}`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
