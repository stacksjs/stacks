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
 * if (result.isErr())
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

  log.debug('exec:', Array.isArray(command) ? command.join(' ') : command, options)
  log.debug('cmd:', cmd)

  if (!cmd)
    return err(handleError(`Failed to parse command: ${cmd}`, options))

  const cwd = options?.cwd ?? process.cwd()

  const proc = Bun.spawn(cmd, {
    // ...options,
    stdin: options?.stdin ?? 'inherit',
    stdout: (options?.silent || options?.quiet) ? 'ignore' : options?.stdin ? options.stdin : (options?.stdout || 'inherit'),
    stderr: (options?.silent || options?.quiet) ? 'ignore' : (options?.stderr || 'inherit'),

    // detached: options?.background || false,
    cwd,
    // env: { ...e, ...options?.env },
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

  const exited = await proc.exited
  if (exited === ExitCode.Success)
    return ok(proc)

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
  log.debug('Running execSync:', command)
  log.debug('execSync options:', options)

  const cmd = Array.isArray(command) ? command : command.match(/(?:[^\s"]|"[^"]*")+/g)

  if (!cmd) {
    log.error(`Failed to parse command: ${cmd}`, options)
    process.exit(ExitCode.FatalError)
  }

  const proc = Bun.spawnSync(cmd, {
    ...options,
    stdin: options?.stdin ?? 'inherit',
    stdout: options?.stdout ?? 'pipe',
    stderr: options?.stderr ?? 'inherit',
    cwd: options?.cwd ?? process.cwd(),
    // env: { ...Bun.env, ...options?.env },
    onExit(
      subprocess: Subprocess<SpawnOptions.Writable, SpawnOptions.Readable, SpawnOptions.Readable>,
      exitCode: number | null,
      signalCode: number | null,
      error: ErrorLike | undefined,
    ) {
      exitHandler('spawnSync', subprocess, exitCode, signalCode, error)
    },
  })

  return proc.stdout?.toString() ?? ''
}

function exitHandler(
  type: 'spawn' | 'spawnSync',
  subprocess: Subprocess,
  exitCode: number | null,
  signalCode: number | null,
  error?: Error,
) {
  log.debug(`exitHandler: ${type}`)
  log.debug('subprocess', subprocess)
  log.debug('exitCode', exitCode)
  log.debug('signalCode', signalCode)

  if (error) {
    log.error(error)
    process.exit(ExitCode.FatalError)
  }

  if (exitCode !== ExitCode.Success && exitCode)
    process.exit(exitCode)
}
