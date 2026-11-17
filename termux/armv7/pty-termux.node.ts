import { createReadStream, createWriteStream } from "node:fs"
import { createRequire } from "node:module"
import { constants as osConstants } from "node:os"
import type { Disp, Exit, Opts, Proc } from "./pty.js"

type NativePty = {
  spawn(file: string, args: string[], rows: number, cols: number, cwd: string | null, env: Record<string, string>): {
    pid: number
    fd: number
  }
  resize(fd: number, rows: number, cols: number): void
  signal(pid: number, signal: number): void
  wait(pid: number): { pid: number; status: number; exitCode: number; signal: number } | null
  close(fd: number): void
}

const require = createRequire(import.meta.url)
const native = require(
  process.env.OPENCODE_TERMUX_PTY_PATH ??
    "/data/data/com.termux/files/usr/lib/opencode/termux-pty-android-armv7.node",
) as NativePty

function spawnPty(file: string, args: string[], opts: Opts): Proc {
  const env = Object.fromEntries(
    Object.entries(opts.env ?? process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
  if (!env.TERM) env.TERM = opts.name || "xterm-256color"
  const child = native.spawn(file, args, opts.rows ?? 24, opts.cols ?? 80, opts.cwd ?? process.cwd(), env)
  const output = createReadStream(null, { fd: child.fd, autoClose: false, encoding: "utf8" })
  const input = createWriteStream(null, { fd: child.fd, autoClose: false })
  const dataListeners = new Set<(data: string) => void>()
  const exitListeners = new Set<(event: Exit) => void>()
  let exited = false
  let closed = false
  let exitEvent: Exit | undefined

  const close = () => {
    if (closed) return
    closed = true
    output.destroy()
    input.destroy()
    try {
      native.close(child.fd)
    } catch {
      // The descriptor may already have been closed during stream teardown.
    }
  }

  output.on("data", (chunk: string | Buffer) => {
    const data = typeof chunk === "string" ? chunk : chunk.toString("utf8")
    for (const listener of dataListeners) listener(data)
  })
  input.on("error", () => {
    // The child may exit while a pending write is being flushed.
  })
  output.on("error", () => {
    // PTY masters may report EIO after the child closes the slave side.
  })

  const poll = setInterval(() => {
    if (exited) return
    let result: ReturnType<NativePty["wait"]>
    try {
      result = native.wait(child.pid)
    } catch {
      return
    }
    if (!result) return
    exited = true
    clearInterval(poll)
    close()
    exitEvent = {
      exitCode: result.exitCode,
      ...(result.signal ? { signal: result.signal } : {}),
    }
    for (const listener of exitListeners) listener(exitEvent)
    exitListeners.clear()
  }, 30)
  poll.unref?.()

  return {
    pid: child.pid,
    onData(listener): Disp {
      dataListeners.add(listener)
      return { dispose: () => dataListeners.delete(listener) }
    },
    onExit(listener): Disp {
      if (exited) {
        listener(exitEvent ?? { exitCode: -1 })
        return { dispose() {} }
      }
      exitListeners.add(listener)
      return { dispose: () => exitListeners.delete(listener) }
    },
    write(data) {
      if (exited || closed) throw new Error("PTY process has exited")
      input.write(data)
    },
    resize(cols, rows) {
      if (exited || closed) return
      native.resize(child.fd, rows, cols)
    },
    kill(signal = "SIGTERM") {
      if (exited) return
      const number = osConstants.signals[signal as keyof typeof osConstants.signals]
      if (typeof number !== "number") throw new Error(`Unsupported signal: ${signal}`)
      native.signal(child.pid, number)
    },
  }
}

export { spawnPty as spawn }
