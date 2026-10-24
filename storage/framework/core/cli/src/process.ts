export interface BoundedProcessOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  timeoutMs: number
  stdoutBytes: number
  stderrBytes: number
  label: string
  /** Reject malformed UTF-8 on either stream. Valid text keeps its BOM. */
  strictUtf8?: boolean
}

export interface BoundedProcessResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Owns a finite command, its output readers and, on POSIX, its process group. */
export async function runBoundedProcess(command: string[], options: BoundedProcessOptions): Promise<BoundedProcessResult> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 120000) throw new Error('Invalid bounded process timeout')
  for (const limit of [options.stdoutBytes, options.stderrBytes]) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2_000_000) throw new Error('Invalid bounded process output limit')
  }
  const ownsGroup = process.platform !== 'win32'
  const child = Bun.spawn(command, { cwd: options.cwd, env: options.env ?? process.env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', detached: ownsGroup })
  const readers = [child.stdout.getReader(), child.stderr.getReader()]
  const cancellations: Promise<unknown>[] = []
  let failure: unknown, failed = false, stopped = false
  let failureReason = 'failed'
  const cleanupFailures: unknown[] = []
  function retainCleanup(error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ESRCH') cleanupFailures.push(error)
  }
  function terminate() {
    if (ownsGroup) { try { process.kill(-child.pid, 'SIGKILL') } catch (error) { retainCleanup(error) } }
    if (child.exitCode === null) { try { child.kill('SIGKILL') } catch (error) { retainCleanup(error) } }
  }
  function stop(error: unknown, reason = 'failed') {
    if (!failed) { failure = error; failed = true; failureReason = reason }
    if (stopped) return
    stopped = true
    terminate()
    for (const reader of readers) cancellations.push(reader.cancel().catch(error => { cleanupFailures.push(error) }))
  }
  async function consume(reader: ReadableStreamDefaultReader<Uint8Array>, limit: number, label: string) {
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          const output = Buffer.concat(chunks, bytes)
          return options.strictUtf8 === true
            ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(output)
            : output.toString('utf8')
        }
        if (value.byteLength > limit - bytes) {
          const error = new Error(`${options.label} ${label} exceeds byte limit`)
          stop(error, `${label} exceeds byte limit`)
          throw error
        }
        bytes += value.byteLength
        chunks.push(value)
      }
    }
    catch (error) { stop(error, `${label} read failed`); throw error }
  }
  const timer = setTimeout(() => stop(new Error(`${options.label} timed out`), 'timed out'), options.timeoutMs)
  const stdout = consume(readers[0]!, options.stdoutBytes, 'stdout'), stderr = consume(readers[1]!, options.stderrBytes, 'stderr')
  try {
    const [exitCode, output, diagnostic] = await Promise.all([child.exited, stdout, stderr])
    if (failed) throw failure
    return { exitCode, stdout: output, stderr: diagnostic }
  }
  catch (error) { stop(error); throw error }
  finally {
    clearTimeout(timer)
    // A failure already terminated this owned group. Killing again can race
    // Bun's exit notification and report EPERM for the reaped child.
    if (!stopped) terminate()
    if (child.exitCode === null) stop(new Error(`${options.label} interrupted`))
    await Promise.allSettled([child.exited, stdout, stderr, ...cancellations])
    for (const reader of readers) {
      try { reader.releaseLock() }
      catch (error) { cleanupFailures.push(error) }
    }
    if (cleanupFailures.length) throw new AggregateError(failed ? [failure, ...cleanupFailures] : cleanupFailures, `${options.label} ${failed ? `${failureReason}; ` : ''}process cleanup failed`)
  }
}
