import { dlopen, FFIType, ptr } from 'bun:ffi'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface OwnedProcessOptions {
  /** Bun executable for the trusted host, required when called from a compiled CLI. */
  ownerRuntime?: string
  cwd?: string
  env?: Record<string, string | undefined>
  stdin?: 'ignore' | Blob
  stdout?: 'pipe' | 'inherit' | 'ignore' | number
  stderr?: 'pipe' | 'inherit' | 'ignore' | number
  stopGraceMs?: number
  /** Messages from the actual command, forwarded by its controlled owner. */
  ipc?: (message: unknown, pid: number) => void
}
export interface OwnedProcessExit { code: number, signal: string | null }
export interface OwnedProcess {
  /** Stable PID of the lifecycle owner, not an identifier discovered by scanning. */
  readonly pid: number
  /** Actual command PID, once native ownership has been established. */
  readonly started: Promise<number>
  /** Command exit, after all normally inherited descendants are disposed. */
  readonly exited: Promise<OwnedProcessExit>
  readonly stdout: ReadableStream<Uint8Array> | null
  readonly stderr: ReadableStream<Uint8Array> | null
  stop: () => Promise<void>
}

function windowsOwnership() {
  const library = dlopen('kernel32.dll', {
    GetLastError: { args: [], returns: FFIType.u32 },
    CreateJobObjectW: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.u64 },
    SetInformationJobObject: { args: [FFIType.u64, FFIType.i32, FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
    AssignProcessToJobObject: { args: [FFIType.u64, FFIType.u64], returns: FFIType.i32 },
    QueryInformationJobObject: { args: [FFIType.u64, FFIType.i32, FFIType.ptr, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
    TerminateJobObject: { args: [FFIType.u64, FFIType.u32], returns: FFIType.i32 },
    OpenProcess: { args: [FFIType.u32, FFIType.i32, FFIType.u32], returns: FFIType.u64 },
    CloseHandle: { args: [FFIType.u64], returns: FFIType.i32 },
  })
  const api = library.symbols
  const must = (success: unknown, operation: string): void => {
    if (!success) throw new Error(`Native Windows process ${operation} failed (Win32 ${api.GetLastError()})`)
  }
  const job = api.CreateJobObjectW(null, null)
  try {
    must(job !== 0n, 'ownership creation')
    const limits = new Uint8Array(144) // JOBOBJECT_EXTENDED_LIMIT_INFORMATION, Win64.
    new DataView(limits.buffer).setUint32(16, 0x2000, true) // KILL_ON_JOB_CLOSE.
    must(api.SetInformationJobObject(job, 9, ptr(limits), limits.byteLength), 'ownership limits')
  }
  catch (error) {
    if (job !== 0n) api.CloseHandle(job)
    library.close()
    throw error
  }
  return {
    assign(pid: number) {
      const child = api.OpenProcess(0x0101, 0, pid) // PROCESS_SET_QUOTA | PROCESS_TERMINATE.
      must(child !== 0n, 'owner handle')
      try { must(api.AssignProcessToJobObject(job, child), 'ownership admission') }
      finally { must(api.CloseHandle(child), 'owner handle disposal') }
    },
    terminate() { must(api.TerminateJobObject(job, 1), 'tree termination') },
    empty() {
      const accounting = new Uint8Array(48) // JOBOBJECT_BASIC_ACCOUNTING_INFORMATION.
      must(api.QueryInformationJobObject(job, 1, ptr(accounting), accounting.byteLength, null), 'ownership accounting')
      return new DataView(accounting.buffer).getUint32(40, true) === 0
    },
    close() {
      try { must(api.CloseHandle(job), 'ownership disposal') }
      finally { library.close() }
    },
  }
}

/**
 * Spawn a command inside native ownership before any command instruction runs.
 * POSIX owns an anchored process group; Windows owns an inherited Job Object.
 * Deliberate POSIX setsid/breakaway is outside this lifecycle contract, not a sandbox.
 */
export function spawnOwnedProcess(command: string[], options: OwnedProcessOptions = {}): OwnedProcess {
  if (!command.length || command.some(part => typeof part !== 'string' || part.includes('\0'))) throw new TypeError('Owned process needs a valid command')
  const grace = options.stopGraceMs ?? 2000
  if (!Number.isFinite(grace) || grace < 0) throw new RangeError('Process stop grace must be finite and nonnegative')
  const environment = { ...(options.env ?? process.env) }
  const ownerEnvironment = { ...environment }
  delete ownerEnvironment.BUN_OPTIONS
  delete ownerEnvironment.NODE_OPTIONS
  let windows: ReturnType<typeof windowsOwnership> | null = null
  const directory = mkdtempSync(join(tmpdir(), 'stacks-process-owner-'))
  const config = join(directory, 'bunfig.toml')
  const noop = join(directory, 'noop.ts')
  try {
    writeFileSync(noop, 'export {}\n')
    writeFileSync(config, `preload = [${JSON.stringify(noop)}]\n`)
    windows = process.platform === 'win32' ? windowsOwnership() : null
  }
  catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
  let startedResolve!: (pid: number) => void
  let startedReject!: (error: unknown) => void
  const started = new Promise<number>((resolve, reject) => { startedResolve = resolve; startedReject = reject })
  let exitResolve!: (exit: OwnedProcessExit) => void
  let exitReject!: (error: unknown) => void
  const completion = new Promise<OwnedProcessExit>((resolve, reject) => { exitResolve = resolve; exitReject = reject })
  void started.catch(() => {})
  void completion.catch(() => {})
  let completed = false
  let stopping: Promise<void> | undefined
  let consumerPid = 0
  let admitted = false
  let ownerReady = false
  // This host is trusted and stays alive until disposal, anchoring the POSIX
  // group ID. It cannot start the command before native admission succeeds.
  const host = `
let stopRequested = false
process.on('SIGTERM', () => {
  if (stopRequested) return
  stopRequested = true
  process.send({ type: 'stop-request' })
})
setInterval(() => {}, 60000)
let launched = false
process.on('disconnect', () => {
  if (process.platform !== 'win32') process.kill(-process.pid, 'SIGKILL')
  else process.exit(1)
})
process.on('message', message => {
  if (message?.start !== true || launched) return
  launched = true
  try {
    const child = Bun.spawn(${JSON.stringify(command)}, {
      env: message.environment,
      stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
      ipc(message, source) { process.send({ type: 'message', pid: source.pid, message }) },
    })
    process.send({ type: 'started', pid: child.pid })
    child.exited.then(code => process.send({ type: 'exit', code, signal: child.signalCode }))
  } catch (error) { process.send({ type: 'failure', message: String(error) }) }
})
process.send({ type: 'ready' })
`
  let child: ReturnType<typeof Bun.spawn>
  let disposeUnstarted: (() => void) | undefined
  try {
    child = Bun.spawn([options.ownerRuntime ?? process.execPath, '--no-env-file', `--config=${config}`, '--eval', host], {
      cwd: options.cwd, env: ownerEnvironment,
      stdin: options.stdin ?? 'ignore', stdout: options.stdout ?? 'pipe', stderr: options.stderr ?? 'pipe',
      detached: !windows,
      ipc(message) {
        try {
          if (!message || typeof message !== 'object') return
          if (message.type === 'ready') {
            ownerReady = true
            if (admitted && !stopping) child.send({ start: true, environment })
          }
          else if (!admitted) return
          else if (message.type === 'stop-request') {
            void stop()
          }
          else if (message.type === 'started' && Number.isSafeInteger(message.pid) && message.pid > 0) {
            consumerPid = message.pid
            startedResolve(consumerPid)
          }
          else if (message.type === 'message' && message.pid === consumerPid) options.ipc?.(message.message, consumerPid)
          else if (message.type === 'exit' && Number.isInteger(message.code)) {
            completed = true
            exitResolve({ code: message.code, signal: message.signal == null ? null : String(message.signal) })
          }
          else if (message.type === 'failure') exitReject(new Error(`Owned command failed to start: ${message.message}`))
        }
        catch (error) { exitReject(error) }
      },
    })
    disposeUnstarted = () => {
      if (windows) child.kill('SIGKILL')
      else {
        try { process.kill(-child.pid, 'SIGKILL') }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
      }
    }
    windows?.assign(child.pid)
    admitted = true
    if (ownerReady) child.send({ start: true, environment })
  }
  catch (error) {
    // Admission fails closed: the controlled host has not received start.
    const failures: unknown[] = [error]
    try { disposeUnstarted?.() } catch (cleanup) { failures.push(cleanup) }
    try { windows?.close() } catch (cleanup) { failures.push(cleanup) }
    try { rmSync(directory, { recursive: true, force: true }) } catch (cleanup) { failures.push(cleanup) }
    if (failures.length > 1) throw new AggregateError(failures, 'Owned process admission and cleanup failed')
    throw error
  }
  const signalGroup = (signal: 'SIGTERM' | 'SIGKILL' | 0): boolean => {
    try { process.kill(-child.pid, signal); return true }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
      if (signal === 0 && (error as NodeJS.ErrnoException).code === 'EPERM') return true
      throw error
    }
  }
  const stop = (): Promise<void> => {
    if (stopping) return stopping
    startedReject(new Error('Owned process stopped before command startup'))
    stopping = (async () => {
      const errors: unknown[] = []
      try {
        if (windows) windows.terminate()
        else {
          if (!completed && grace) {
            signalGroup('SIGTERM')
            await Bun.sleep(grace)
          }
          signalGroup('SIGKILL')
        }
        await child.exited
        const deadline = performance.now() + 2000
        while (windows ? !windows.empty() : signalGroup(0)) {
          if (performance.now() >= deadline) throw new Error('Native owned process disposal could not be confirmed')
          await Bun.sleep(10)
        }
      }
      catch (error) { errors.push(error) }
      finally {
        try { windows?.close() } catch (error) { errors.push(error) }
        try { rmSync(directory, { recursive: true, force: true }) } catch (error) { errors.push(error) }
      }
      if (errors.length) throw new AggregateError(errors, 'Owned process cleanup failed')
    })()
    void stopping.catch(() => {})
    return stopping
  }
  void child.exited.then(code => {
    if (!stopping && !completed) exitReject(new Error(`Owned process host exited before command completion (${code})`))
    if (!completed) exitResolve({ code, signal: child.signalCode == null ? null : String(child.signalCode) })
  })
  const exited = completion.then(async (exit) => { await stop(); return exit }, async (error) => {
    startedReject(error)
    try { await stop() }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'Owned process failed and cleanup failed') }
    throw error
  })
  void exited.catch(() => {})
  return {
    pid: child.pid, started, exited,
    stdout: child.stdout instanceof ReadableStream ? child.stdout : null,
    stderr: child.stderr instanceof ReadableStream ? child.stderr : null,
    stop,
  }
}
