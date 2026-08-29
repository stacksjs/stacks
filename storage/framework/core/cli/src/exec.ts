import type { Result } from '@stacksjs/error-handling'
import type { CliOptions, ErrorLike, SpawnOptions, Subprocess } from '@stacksjs/types'
import process from 'node:process'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { italic, log } from './'

/**
 * Execute a command.
 *
 * @param command The command to execute.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 * @example
 * ```ts
 * const result = await exec('ls')
 *
 * if (result.isErr)
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 * @example
 * ```ts
 * const result = await exec('ls', { cwd: '/home' })
 * ```
 */
export async function exec(command: string | string[], options?: CliOptions): Promise<Result<Subprocess, Error>> {
  const cmd = Array.isArray(command) ? command : command.match(/(?:[^\s"]|"[^"]*")+/g)

  if (!cmd)
    return err(handleError(`Failed to parse command: ${cmd}`, options))

  const cwd = options?.cwd ?? process.cwd()
  const timeoutMs = options?.timeoutMs

  const proc = Bun.spawn(cmd, {
    // ...options,
    stdin: options?.stdin ?? 'inherit',
    stdout: (options?.silent || options?.quiet) ? 'ignore' : options?.stdin ? options.stdin : (options?.stdout || 'inherit'),
    stderr: (options?.silent || options?.quiet) ? 'ignore' : (options?.stderr || 'inherit'),

    // detached: options?.background || false,
    cwd,
    env: { ...process.env, ...options?.env },
    onExit(
      subprocess: Subprocess<SpawnOptions.Writable, SpawnOptions.Readable, SpawnOptions.Readable>,
      exitCode: number | null,
      signalCode: number | null,
      error: ErrorLike | undefined,
    ) {
      exitHandler('spawn', subprocess, exitCode, signalCode, error)
    },
  })

  // Check if we need to write to stdin
  // this is currently only used for `buddy aws:configure`
  if (options?.stdin === 'pipe' && options.input) {
    if (proc.stdin) {
      // @ts-expect-error - this works even though there is a type error
      proc.stdin.write(options.input)
      // @ts-expect-error - this works even though there is a type error
      proc.stdin.end()
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const exited = await Promise.race([
    proc.exited,
    new Promise<number>((resolve) => {
      if (!timeoutMs)
        return

      timeoutId = setTimeout(() => {
        try {
          proc.kill()
        }
        catch {
        }

        resolve(ExitCode.FatalError)
      }, timeoutMs)
    }),
  ])

  if (timeoutId)
    clearTimeout(timeoutId)

  if (timeoutMs && exited === ExitCode.FatalError && proc.exitCode === null)
    return err(handleError(`Command timed out after ${timeoutMs}ms: ${italic(cmd.join(' '))} in ${italic(cwd)}`, options))

  if (exited === ExitCode.Success)
    return ok(proc)

  // Signal-induced exits during shutdown (parent receives SIGINT / SIGTERM
  // and propagates to children, or the user backgrounds with `&` and runs
  // `kill %1`) are not actionable failures — they're the expected end of
  // a dev-server lifetime. `handleError` always console.errors the
  // message, so calling it on shutdown floods the terminal with
  // `Failed to execute command: bun --watch …/api.ts`-style noise that
  // looks like a crash. Return a quiet Err instead so callers' catch
  // chains still fire but the user doesn't see false alarms.
  // `proc.signalCode` is e.g. 'SIGTERM'; `proc.exitCode === null` covers
  // the case where the child died without setting an exit code.
  const sig = (proc as unknown as { signalCode?: string | null }).signalCode
  if (sig === 'SIGTERM' || sig === 'SIGINT' || sig === 'SIGKILL' || (proc.exitCode === null && exited !== ExitCode.Success)) {
    return err(new Error(`Command terminated by ${sig ?? 'signal'}: ${cmd.join(' ')}`))
  }

  return err(handleError(`Failed to execute command: ${italic(cmd.join(' '))} in ${italic(cwd)}`, options))
}

/**
 * Execute a command and return result.
 *
 * @param command The command to execute.
 * @returns The result of the command.
 * @example
 * ```ts
 * const output = execSync('ls')
 *
 * console.log(output)
 * ```
 * @example
 * ```ts
 * const output = execSync('ls', { cwd: '/home' })
 * ```
 */
export async function execSync(command: string | string[], options?: CliOptions): Promise<string> {
  const cmd = Array.isArray(command) ? command : command.match(/(?:[^\s"]|"[^"]*")+/g)

  if (!cmd) {
    log.error(`Failed to parse command: ${cmd}`, options)
    throw new Error(`Failed to parse command: ${cmd}`)
  }

  const proc = Bun.spawnSync(cmd, {
    ...options,
    stdin: options?.stdin ?? 'inherit',
    stdout: options?.stdout ?? 'pipe',
    stderr: options?.stderr ?? 'inherit',
    cwd: options?.cwd ?? process.cwd(),
    env: { ...process.env, ...options?.env },
    onExit(
      subprocess: Subprocess<SpawnOptions.Writable, SpawnOptions.Readable, SpawnOptions.Readable>,
      exitCode: number | null,
      signalCode: number | null,
      error: ErrorLike | undefined,
    ) {
      exitHandler('spawnSync', subprocess, exitCode, signalCode, error)
    },
  })

  const stdout = proc.stdout?.toString() ?? ''

  // `onExit` above cannot help here: it only logs at debug, and its own comment
  // notes that an onExit callback cannot propagate an exception. So unless the
  // caller opts in, a command that exited non-zero is indistinguishable from
  // one that succeeded and printed nothing. `bump.ts` ran `git commit`,
  // `git tag` and two `git push` calls through this and would report a
  // successful release even when every one of them was rejected.
  if (options?.throwOnError && proc.exitCode !== 0) {
    const stderr = proc.stderr?.toString() ?? ''
    const detail = (stderr.trim() || stdout.trim() || '(no output)').split('\n').slice(0, 5).join('\n')
    throw new Error(`Command failed with exit code ${proc.exitCode}: ${cmd.join(' ')}\n${detail}`)
  }

  return stdout
}

function exitHandler(
  type: 'spawn' | 'spawnSync',
  _subprocess: Subprocess,
  exitCode: number | null,
  signalCode: number | null,
  error?: Error,
) {
  log.debug(`exitHandler: ${type}, exitCode: ${exitCode}, signalCode: ${signalCode}`)

  if (error) {
    // Log but don't throw — onExit callbacks can't propagate exceptions.
    // The caller checks proc.exited for the exit code instead.
    log.debug('Process error:', error.message)
  }
}
