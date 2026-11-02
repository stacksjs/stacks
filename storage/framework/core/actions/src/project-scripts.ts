import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
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
    const command = [bun, 'run', script]
    let reportExit: (code: number) => void = () => {}
    let reportFailure: (error: Error) => void = () => {}
    const reported = new Promise<number>((resolve, reject) => {
      reportExit = resolve
      reportFailure = reject
    })
    let interrupted = false
    const child = spawnOwnedProcess(command, {
      ownerRuntime: bun, cwd: options.cwd, env: { ...process.env, ...options.env },
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', stopGraceMs: 500,
    })
    void child.exited.then(exit => reportExit(exit.code), reportFailure)
    const pipes = [child.stdout, child.stderr].map((stream, index) => ({ reader: stream!.getReader(), done: false, source: index === 0 ? 'stdout' as const : 'stderr' as const }))
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
        try { await child.stop() }
        catch (error) { errors.push(`Native process cleanup failed: ${String(error)}`) }
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
