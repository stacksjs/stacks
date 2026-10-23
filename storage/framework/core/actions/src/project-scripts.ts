import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface ProjectScriptOptions {
  cwd: string
  scripts: string[]
  env?: Record<string, string | undefined>
  signal?: AbortSignal
  timeoutMs?: number
  /** Optional synchronous live output observer. Receipts still retain only hashes. */
  onOutput?: (chunk: Uint8Array, stream: 'stdout' | 'stderr') => void
}

export interface ProjectScriptReceipt {
  bunVersion: string
  checks: Array<{ script: string, exitCode: 0, outputSha256: string }>
}

interface PackageManifest { scripts?: Record<string, string>, engines?: { bun?: string } }

function fail(message: string): never {
  throw new Error(message)
}

/** Inline so a standalone compiled Buddy needs no adjacent helper files. */
function windowsCheckHost(bun: string, script: string): string {
  // HANDLE is an integer token, not a pointer into process memory. Bun's FFI
  // requires u64 here: https://bun.sh/docs/runtime/ffi#pointers
  return `
import { dlopen, FFIType as f, ptr } from 'bun:ffi'
setInterval(() => {}, 60_000)
let stopRequested = false
let permit
const permitted = new Promise(resolve => { permit = resolve })
process.on('message', message => {
  if (message?.stop) { stopRequested = true; permit() }
  else if (message?.start) permit()
})
let api
let lifetime = 0n
let job = 0n
let childProcess = 0n
let childThread = 0n
let failure = ''
let exitCode = 1
const wide = value => Uint16Array.from({ length: value.length + 1 }, (_, i) => i === value.length ? 0 : value.charCodeAt(i))
const must = (condition, operation) => {
  if (!condition) throw new Error('Native Windows ' + operation + ' failed (Win32 ' + api.GetLastError() + ')')
}
const makeJob = () => {
  const handle = api.CreateJobObjectW(null, null)
  must(handle !== 0n, 'job creation')
  const limits = new BigUint64Array(18) // JOBOBJECT_EXTENDED_LIMIT_INFORMATION, Win64.
  new DataView(limits.buffer).setUint32(16, 0x2000, true) // KILL_ON_JOB_CLOSE.
  if (!api.SetInformationJobObject(handle, 9, ptr(limits), limits.byteLength)) {
    api.CloseHandle(handle)
    must(false, 'job limits')
  }
  return handle
}
const inherited = source => {
  const result = new BigUint64Array(1)
  const current = api.GetCurrentProcess()
  must(api.DuplicateHandle(current, source, current, ptr(result), 0, 1, 2), 'standard handle inheritance')
  return result[0]
}
try {
  api = dlopen('kernel32.dll', {
    GetLastError: { args: [], returns: f.u32 },
    GetCurrentProcess: { args: [], returns: f.u64 },
    GetStdHandle: { args: [f.u32], returns: f.u64 },
    CreateJobObjectW: { args: [f.ptr, f.ptr], returns: f.u64 },
    SetInformationJobObject: { args: [f.u64, f.i32, f.ptr, f.u32], returns: f.i32 },
    QueryInformationJobObject: { args: [f.u64, f.i32, f.ptr, f.u32, f.ptr], returns: f.i32 },
    AssignProcessToJobObject: { args: [f.u64, f.u64], returns: f.i32 },
    TerminateJobObject: { args: [f.u64, f.u32], returns: f.i32 },
    DuplicateHandle: { args: [f.u64, f.u64, f.u64, f.ptr, f.u32, f.i32, f.u32], returns: f.i32 },
    CreateFileW: { args: [f.ptr, f.u32, f.u32, f.ptr, f.u32, f.u32, f.u64], returns: f.u64 },
    CreateProcessW: { args: [f.ptr, f.ptr, f.ptr, f.ptr, f.i32, f.u32, f.ptr, f.ptr, f.ptr, f.ptr], returns: f.i32 },
    ResumeThread: { args: [f.u64], returns: f.u32 },
    WaitForSingleObject: { args: [f.u64, f.u32], returns: f.u32 },
    GetExitCodeProcess: { args: [f.u64, f.ptr], returns: f.i32 },
    TerminateProcess: { args: [f.u64, f.u32], returns: f.i32 },
    CloseHandle: { args: [f.u64], returns: f.i32 },
  }).symbols
  // Own the host before it can create a consumer. Parent death closes this
  // non-inheritable lifetime handle and terminates all remaining descendants.
  lifetime = makeJob()
  must(api.AssignProcessToJobObject(lifetime, api.GetCurrentProcess()), 'host ownership')
  job = makeJob()
  process.send({ ready: true })
  await permitted
  if (!stopRequested) {
    const startup = new BigUint64Array(13) // STARTUPINFOW, Win64: 104 bytes.
    const fields = new DataView(startup.buffer)
    fields.setUint32(0, startup.byteLength, true)
    fields.setUint32(60, 0x100, true) // STARTF_USESTDHANDLES.
    const inputName = wide('NUL')
    const sourceInput = api.CreateFileW(ptr(inputName), 0x80000000, 3, null, 3, 0, 0n)
    must(sourceInput !== 0xffffffffffffffffn, 'consumer stdin')
    const handles = []
    try {
      handles.push(inherited(sourceInput))
      handles.push(inherited(api.GetStdHandle(0xfffffff5))) // STD_OUTPUT_HANDLE.
      handles.push(inherited(api.GetStdHandle(0xfffffff4))) // STD_ERROR_HANDLE.
      for (let i = 0; i < handles.length; i++) fields.setBigUint64(80 + i * 8, handles[i], true)
      const processInfo = new BigUint64Array(3) // PROCESS_INFORMATION, Win64.
      const executable = wide(${JSON.stringify(bun)})
      const commandLine = wide(${JSON.stringify(`"${bun}" run ${script}`)})
      const created = api.CreateProcessW(ptr(executable), ptr(commandLine), null, null, 1, 0x08000004, null, null, ptr(startup), ptr(processInfo))
      childProcess = processInfo[0]
      childThread = processInfo[1]
      must(created, 'suspended consumer creation')
    }
    finally {
      api.CloseHandle(sourceInput)
      for (const handle of handles) api.CloseHandle(handle)
    }
    // No user instruction runs until both native ownership jobs contain it.
    must(api.AssignProcessToJobObject(job, childProcess), 'consumer ownership')
    must(api.ResumeThread(childThread) !== 0xffffffff, 'consumer startup')
    while (!stopRequested) {
      const state = api.WaitForSingleObject(childProcess, 0)
      if (state === 0) {
        const code = new Uint32Array(1)
        must(api.GetExitCodeProcess(childProcess, ptr(code)), 'consumer exit status')
        exitCode = code[0] | 0
        break
      }
      must(state === 258, 'consumer wait') // WAIT_TIMEOUT.
      await Bun.sleep(10)
    }
  }
}
catch (error) { failure = String(error) }
try {
  if (api && job !== 0n) {
    try {
      if (childProcess !== 0n) {
        const state = api.WaitForSingleObject(childProcess, 0)
        must(state === 0 || state === 258, 'final consumer wait')
        if (state === 258) must(api.TerminateProcess(childProcess, 1), 'suspended consumer disposal')
      }
      must(api.TerminateJobObject(job, 1), 'owned process termination')
      const accounting = new BigUint64Array(6)
      const fields = new DataView(accounting.buffer)
      const deadline = performance.now() + 1000
      while (true) {
        must(api.QueryInformationJobObject(job, 1, ptr(accounting), accounting.byteLength, null), 'owned process accounting')
        if (fields.getUint32(40, true) === 0 && (childProcess === 0n || api.WaitForSingleObject(childProcess, 0) === 0)) break
        if (performance.now() >= deadline) throw new Error('Owned Windows processes did not finish cleanup')
        await Bun.sleep(10)
      }
    }
    finally {
      if (childThread !== 0n) api.CloseHandle(childThread)
      if (childProcess !== 0n) api.CloseHandle(childProcess)
      must(api.CloseHandle(job), 'owned job handle disposal')
    }
  }
}
catch (error) { failure += (failure ? '; ' : '') + String(error) }
// Keep the lifetime job open until the parent disposes this owned Bun process.
// Closing it here would kill this host before its completion report is sent.
if (failure) process.send({ error: failure })
else process.send({ exitCode })
`
}

/** Execute declared project checks with the installed Bun and owned cleanup. */
export async function runProjectScripts(options: ProjectScriptOptions): Promise<ProjectScriptReceipt> {
  const timeoutMs = options.timeoutMs ?? 300_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0
    || !options.scripts.length || options.scripts.some(name => !/^[a-z0-9][\w:.-]*$/i.test(name))
    || new Set(options.scripts).size !== options.scripts.length)
    fail('Project checks need unique script names and a positive execution budget')
  const receipt: ProjectScriptReceipt = { bunVersion: '', checks: [] }
  const manifestPath = join(options.cwd, 'package.json')
  const originalManifest = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(originalManifest) as PackageManifest
  // In a compiled Buddy, process.execPath is Buddy itself. Use the consumer's
  // installed Bun toolchain rather than recursively launching this executable.
  const bun = Bun.which('bun', { cwd: options.cwd })
  if (!bun) fail('Consumer Bun executable is unavailable')
  const probe = Bun.spawnSync([bun, '--version'], { cwd: options.cwd, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
  const bunVersion = probe.stdout.toString().trim()
  if (probe.exitCode !== 0 || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(bunVersion)
    || !Bun.semver.satisfies(bunVersion, manifest.engines?.bun ?? '>=1.3.0'))
    fail('Consumer Bun executable does not satisfy the declared toolchain')
  receipt.bunVersion = bunVersion
  const hostDirectory = mkdtempSync(join(tmpdir(), 'stacks-project-host-'))
  try {
    // The internal owner must initialize before application code can run.
    // Keep its configuration private; the checked command still runs from
    // the application directory with its own normal Bun configuration.
    const hostConfig = join(hostDirectory, 'bunfig.toml')
    writeFileSync(hostConfig, 'preload = []\n')
    for (const script of options.scripts) {
      if (!Object.hasOwn(manifest.scripts ?? {}, script) || typeof manifest.scripts?.[script] !== 'string' || !manifest.scripts[script].trim())
        fail(`Consumer script ${script} is not declared`)
      options.signal?.throwIfAborted()
      const windows = process.platform === 'win32'
      const command = [bun, 'run', script]
      // Keep an owned Bun host alive after the command exits. Its IPC reports
      // command completion while its native ownership handles remain alive.
      // POSIX additionally owns the host's process group. Deliberately detached
      // processes remain outside this cleanup contract, which is not a sandbox.
      let reportExit: (code: number) => void = () => {}
      let reportFailure: (error: Error) => void = () => {}
      const reported = new Promise<number>((resolve, reject) => {
        reportExit = resolve
        reportFailure = reject
      })
      let interrupted = false
      const host = windows ? windowsCheckHost(bun, script) : `setInterval(() => {}, 60_000)
  try {
    const command = Bun.spawn(${JSON.stringify(command)}, { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' })
    process.send({ exitCode: await command.exited })
  } catch (error) {
    process.send({ error: String(error) })
  }
  `
      const child = Bun.spawn([bun, `--config=${hostConfig}`, '--eval', host], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
        detached: process.platform !== 'win32',
        ipc(message) {
          if (windows && message?.ready === true) {
            try { child.send(interrupted ? { stop: true } : { start: true }) }
            catch (error) { reportFailure(new Error(`Consumer script ${script} control channel failed: ${String(error)}`)) }
          }
          else if (Number.isInteger(message?.exitCode)) reportExit(message.exitCode)
          else reportFailure(new Error(`Consumer script ${script} host failed: ${message?.error ?? 'invalid completion report'}`))
        },
      })
      const pipes = [child.stdout, child.stderr].map((stream, index) => ({ reader: stream.getReader(), done: false, source: index === 0 ? 'stdout' as const : 'stderr' as const }))
      let teardown: Promise<void> | undefined
      let announceStop: () => void = () => {}
      const stopped = new Promise<void>(resolve => { announceStop = resolve })
      const waitWithin = async <T>(promise: Promise<T>, milliseconds: number): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          return await Promise.race([promise, new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Process or output cleanup did not finish within its grace period')), milliseconds)
          })])
        }
        finally {
          if (timer) clearTimeout(timer)
        }
      }
      let draining: Promise<void>
      const dispose = (preserveOutput: boolean): Promise<void> => {
        if (teardown) return teardown
        teardown = (async () => {
          const errors: string[] = []
          if (windows) {
            if (!preserveOutput) {
              // Keep the native Job Object owner alive until it has terminated
              // the check and confirmed zero active members, including children
              // whose intermediate parent has already exited.
              try {
                child.send({ stop: true })
                await waitWithin(reported, 1000)
              }
              catch (error) { errors.push(`Native Windows cleanup completion was not confirmed: ${error instanceof Error ? error.message : String(error)}`) }
            }
            // The native host confirms zero owned members before completion.
            // Killing this direct Bun child then closes its lifetime Job Object;
            // no external compiler, PowerShell process or PID-tree scan is needed.
            try { child.kill('SIGKILL') }
            catch { errors.push('Native Windows owner disposal failed') }
          }
          else {
            const signalGroup = (signal: 'SIGTERM' | 'SIGKILL'): void => {
              try { process.kill(-child.pid, signal) }
              catch (error) {
                // The group may already have exited. Permission and other
                // failures are cleanup errors rather than successful disposal.
                if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
                  const cause = error as NodeJS.ErrnoException
                  errors.push(`Process-group ${signal} failed (code=${cause.code}, errno=${cause.errno}, message=${cause.message})`)
                }
              }
            }
            signalGroup('SIGTERM')
            await new Promise<void>(resolve => setTimeout(resolve, 500))
            signalGroup('SIGKILL')
            // Signal delivery alone does not prove disposal. Wait for the owned
            // group to disappear before a completed check can receive a receipt.
            const until = performance.now() + 1000
            let pendingError = ''
            while (true) {
              try { process.kill(-child.pid, 0) }
              catch (error) {
                const cause = error as NodeJS.ErrnoException
                if (cause.code === 'ESRCH') break
                pendingError = `signal=0, code=${cause.code}, errno=${cause.errno}, message=${cause.message}`
                // macOS reports EPERM for a killed group while its final process
                // is awaiting reaping. This still means disposal is unconfirmed:
                // yield for reaping, require ESRCH, and fail if the grace expires.
                if (cause.code !== 'EPERM') {
                  errors.push(`Process-group disposal could not be confirmed (${pendingError})`)
                  break
                }
              }
              if (performance.now() >= until) {
                errors.push(`Owned process group remained after cleanup${pendingError ? ` (${pendingError})` : ''}`)
                break
              }
              await new Promise<void>(resolve => setTimeout(resolve, 10))
            }
          }
          // On ordinary completion, retain all output before issuing a hash.
          // A descendant outside our group may hold the pipe indefinitely, so
          // even the drain has a bounded cleanup grace period.
          if (preserveOutput) {
            try { await waitWithin(draining, 1000) }
            catch { errors.push('Output draining exceeded its cleanup grace period') }
          }
          // On interruption or a failed drain, release held readers explicitly.
          const close = Promise.all([
            ...pipes.filter(pipe => !pipe.done).map(async (pipe) => {
              try { await pipe.reader.cancel() }
              catch { errors.push('Output reader cancellation failed') }
            }),
            child.exited,
          ])
          try { await waitWithin(close, 1000) }
          catch { errors.push('Process or output cleanup exceeded its grace period') }
          if (errors.length) fail(`Consumer script ${script} cleanup failed: ${errors.join('; ')}`)
        })()
        // The interruption race awaits this exact promise below. Attach its
        // rejection handler now so a quick cleanup failure is never unhandled.
        void teardown.catch(() => {})
        return teardown
      }
      const stop = (): void => {
        if (interrupted) return
        interrupted = true
        void dispose(false)
        announceStop()
      }
      void child.exited.then(code => {
        if (!teardown) reportFailure(new Error(`Consumer script ${script} host exited before reporting completion (exit code ${code})`))
      })
      const deadline = setTimeout(stop, timeoutMs)
      options.signal?.addEventListener('abort', stop, { once: true })
      if (options.signal?.aborted) stop()
      const output = createHash('sha256')
      async function drain(pipe: typeof pipes[number]): Promise<void> {
        try {
          while (true) {
            const next = await pipe.reader.read()
            if (next.done) break
            output.update(next.value)
            options.onOutput?.(next.value.slice(), pipe.source)
          }
        }
        finally {
          pipe.done = true
          pipe.reader.releaseLock()
        }
      }
      let exitCode: number
      try {
        draining = Promise.all(pipes.map(drain)).then(() => {})
        // Install the drain's handler immediately while command completion is
        // pending so reader failures cannot become unhandled rejections.
        void draining.catch(reportFailure)
        const completion = reported.then(exitCode => ({ kind: 'completed' as const, exitCode }))
        const result = await Promise.race([completion, stopped.then(() => ({ kind: 'interrupted' as const }))])
        if (result.kind === 'interrupted' || interrupted) {
          await teardown
          fail(`Consumer script ${script} was interrupted or exceeded its execution budget`)
        }
        exitCode = result.exitCode
        await dispose(true)
      }
      catch (error) {
        const wasInterrupted = interrupted
        stop()
        try { await teardown }
        catch (cleanupError) {
          // A deadline remains a failed deadline even when Windows also reports
          // a process-tree cleanup race. Retain both causes for the operator.
          if (wasInterrupted)
            fail(`Consumer script ${script} was interrupted or exceeded its execution budget; ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`)
          throw cleanupError
        }
        throw error
      }
      finally {
        clearTimeout(deadline)
        options.signal?.removeEventListener('abort', stop)
      }
      if (interrupted || options.signal?.aborted)
        fail(`Consumer script ${script} was interrupted or exceeded its execution budget`)
      if (exitCode !== 0) fail(`Consumer script ${script} failed with exit code ${exitCode}`)
      if (readFileSync(manifestPath, 'utf8') !== originalManifest)
        fail(`Consumer script ${script} changed the project manifest`)
      receipt.checks.push({ script, exitCode: 0, outputSha256: output.digest('hex') })
    }
    return receipt
  }
  finally { rmSync(hostDirectory, { recursive: true, force: true }) }
}

