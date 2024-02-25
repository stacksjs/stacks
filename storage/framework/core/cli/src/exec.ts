import process from 'node:process'
import { type Result, err, handleError, ok } from '@stacksjs/error-handling'
import type { CliOptions, Subprocess } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { log } from './'

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
  const cmd = Array.isArray(command)
    ? command
    : command.match(/(?:[^\s"]+|"[^"]*")+/g)

  if (!cmd)
    return err(handleError(`Failed to parse command: ${cmd}`, options))

  log.debug('exec:', Array.isArray(command) ? command.join(' ') : command)
  log.debug('cmd:', cmd)
  log.debug('exec options:', options)

  const proc = Bun.spawn(cmd, {
    ...options,
    stdout: (options?.silent || options?.quiet) ? 'ignore' : (options?.stdin ? options.stdin : (options?.stdout || 'inherit')),
    stderr: (options?.silent || options?.quiet) ? 'ignore' : (options?.stderr || 'inherit'),
    detached: options?.background || false,
    cwd: options?.cwd || import.meta.dir,
    // env: { ...e, ...options?.env },
    onExit(_subprocess, exitCode, _signalCode, _error) {
      if (exitCode && exitCode !== ExitCode.Success)
        process.exit(exitCode)
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

  return err(handleError(`Failed to execute command: ${cmd.join(' ')}`))
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
  log.debug('Running ExecSync:', command)
  log.debug('ExecSync Options:', options)

  const cmd = Array.isArray(command)
    ? command
    : command.match(/(?:[^\s"]+|"[^"]*")+/g)

  if (!cmd) {
    log.error(`Failed to parse command: ${cmd}`, options)
    process.exit(ExitCode.FatalError)
  }

  const proc = Bun.spawnSync(cmd, {
    ...options,
    stdin: options?.stdin ?? 'inherit',
    stdout: options?.stdout ?? 'pipe',
    stderr: options?.stderr ?? 'inherit',
    cwd: options?.cwd ?? import.meta.dir,
    // env: { ...Bun.env, ...options?.env },
    onExit(_subprocess, exitCode, _signalCode, _error) {
      // console.log('onExit', { subprocess, exitCode, signalCode, error })
      if (exitCode !== ExitCode.Success && exitCode)
        process.exit(exitCode)
    },
  })

  return proc.stdout.toString()
}
