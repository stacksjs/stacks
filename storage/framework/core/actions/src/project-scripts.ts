import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ProjectScriptOptions {
  cwd: string
  scripts: string[]
  env?: Record<string, string | undefined>
  signal?: AbortSignal
  timeoutMs?: number
}

export interface ProjectScriptReceipt {
  bunVersion: string
  checks: Array<{ script: string, exitCode: 0, outputSha256: string }>
}

interface PackageManifest { scripts?: Record<string, string>, engines?: { bun?: string } }

function fail(message: string): never {
  throw new Error(message)
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
  for (const script of options.scripts) {
    if (!Object.hasOwn(manifest.scripts ?? {}, script) || typeof manifest.scripts?.[script] !== 'string' || !manifest.scripts[script].trim())
      fail(`Consumer script ${script} is not declared`)
    options.signal?.throwIfAborted()
    const windowsTaskkill = process.platform === 'win32' ? Bun.which('taskkill.exe') : undefined
    if (process.platform === 'win32' && !windowsTaskkill) fail('Windows process-tree cleanup requires taskkill.exe')
    // A separate POSIX group owns the normal descendants of this check. This
    // is cleanup ownership, not a sandbox for a process that deliberately
    // detaches into a different group. Windows uses its native tree operation.
    const child = Bun.spawn([bun, 'run', script], { cwd: options.cwd, env: { ...process.env, ...options.env }, stdout: 'pipe', stderr: 'pipe', detached: process.platform !== 'win32' })
    const pipes = [child.stdout, child.stderr].map(stream => ({ reader: stream.getReader(), done: false }))
    let interrupted = false
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
    const stop = (): void => {
      if (interrupted) return
      interrupted = true
      teardown = (async () => {
        const errors: string[] = []
        if (windowsTaskkill) {
          // Query and terminate the tree before its leader disappears. Killing
          // only the leader first loses taskkill's parent/descendant relation.
          try {
            const result = Bun.spawnSync([windowsTaskkill, '/PID', String(child.pid), '/T', '/F'], {
              stdout: 'ignore', stderr: 'ignore', timeout: 2000,
            })
            if (result.exitCode !== 0) errors.push(`taskkill failed with exit code ${result.exitCode}`)
          }
          catch { errors.push('Windows process-tree cleanup could not execute taskkill') }
          if (errors.length) {
            // Still dispose the direct child and readers while retaining the
            // tree-cleanup error; this must never produce a success receipt.
            try { child.kill('SIGKILL') }
            catch { errors.push('Direct child cleanup also failed') }
          }
        }
        else {
          const signalGroup = (signal: 'SIGTERM' | 'SIGKILL'): void => {
            try { process.kill(-child.pid, signal) }
            catch (error) {
              // The group may already have exited. Permission and other
              // failures are cleanup errors rather than successful disposal.
              if ((error as NodeJS.ErrnoException).code !== 'ESRCH') errors.push(`Process-group ${signal} failed`)
            }
          }
          signalGroup('SIGTERM')
          await new Promise<void>(resolve => setTimeout(resolve, 500))
          signalGroup('SIGKILL')
        }
        // A descendant may hold a pipe even after its leader exits. Close our
        // readers explicitly and bound the wait, including an escaped process
        // outside the owned group, without claiming to have killed that escape.
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
      announceStop()
    }
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
        }
      }
      finally {
        pipe.done = true
        pipe.reader.releaseLock()
      }
    }
    let exitCode: number
    try {
      const completion = Promise.all([Promise.all(pipes.map(drain)), child.exited]).then(result => ({ kind: 'completed' as const, exitCode: result[1] }))
      const result = await Promise.race([completion, stopped.then(() => ({ kind: 'interrupted' as const }))])
      if (result.kind === 'interrupted' || interrupted) {
        await teardown
        fail(`Consumer script ${script} was interrupted or exceeded its execution budget`)
      }
      exitCode = result.exitCode
    }
    catch (error) {
      stop()
      await teardown
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
