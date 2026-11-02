import process from 'node:process'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'

export interface TestServiceOptions {
  label?: string
  cwd?: string
  env?: Record<string, string | undefined>
  stdout?: 'pipe' | 'inherit' | 'ignore' | number
  stderr?: 'pipe' | 'inherit' | 'ignore' | number
  /** Deadline for the child's explicit readiness notification. Default 60 seconds. */
  startupTimeoutMs?: number
  /** POSIX SIGTERM grace before SIGKILL; Windows terminates the native job. Default 2 seconds. */
  stopGraceMs?: number
}

export interface TestService {
  /** PID of the native lifecycle owner; readiness payloads may identify the command. */
  readonly pid: number
  readonly ready: Promise<unknown>
  readonly signal: AbortSignal
  readonly exited: Promise<number>
  readonly stdout: ReadableStream<Uint8Array> | null
  readonly stderr: ReadableStream<Uint8Array> | null
  stop: () => Promise<void>
}

const READY = 'stacks:test-service:ready'

/** Notify the owning test process after application-specific readiness checks. */
export function notifyTestServiceReady(info?: unknown): boolean {
  if (!process.send) return false
  process.send({ type: READY, pid: process.pid, info })
  return true
}

/** Own a child service; a listening port alone never establishes readiness. */
export function startTestService(command: string[], options: TestServiceOptions = {}): TestService {
  const startupTimeoutMs = options.startupTimeoutMs ?? 60_000
  const stopGraceMs = options.stopGraceMs ?? 2_000
  for (const [name, value] of Object.entries({ startupTimeoutMs, stopGraceMs })) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`)
  }
  const label = options.label ?? 'Test service'
  const controller = new AbortController()
  let resolveReady!: (info: unknown) => void
  let rejectReady!: (error: Error) => void
  let timer: ReturnType<typeof setTimeout> | undefined
  const ready = new Promise<unknown>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // Callers can begin collecting output before awaiting readiness.
  void ready.catch(() => {})
  const child = spawnOwnedProcess(command, {
    cwd: options.cwd,
    env: options.env,
    stdin: 'ignore',
    stopGraceMs,
    stdout: options.stdout ?? 'pipe',
    stderr: options.stderr ?? 'pipe',
    ipc(message, pid) {
      if (!message || typeof message !== 'object' || !('type' in message) || !('pid' in message) || message.type !== READY || message.pid !== pid) return
      clearTimeout(timer)
      resolveReady('info' in message ? message.info : undefined)
    },
  })
  let stopping: Promise<void> | undefined
  const stop = (): Promise<void> => {
    if (stopping) return stopping
    clearTimeout(timer)
    rejectReady(new Error(`${label} stopped before readiness`))
    stopping = child.stop()
    return stopping
  }
  timer = setTimeout(() => {
    const error = new Error(`${label} readiness timed out after ${startupTimeoutMs}ms`)
    rejectReady(error)
    controller.abort(error)
    void stop().catch(() => {})
  }, startupTimeoutMs)
  const exited = child.exited.then(({ code, signal }) => {
    clearTimeout(timer)
    if (!stopping) {
      const error = new Error(`${label} exited ${code}${signal ? ` (${signal})` : ''}`)
      rejectReady(error)
      controller.abort(error)
    }
    return code
  }, (error) => {
    clearTimeout(timer)
    rejectReady(error)
    controller.abort(error)
    throw error
  })
  void exited.catch(() => {})
  return {
    pid: child.pid,
    ready,
    signal: controller.signal,
    exited,
    stdout: child.stdout instanceof ReadableStream ? child.stdout : null,
    stderr: child.stderr instanceof ReadableStream ? child.stderr : null,
    stop,
  }
}
