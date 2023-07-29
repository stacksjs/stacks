import { ExitCode } from '@stacksjs/types'
import type { CliOptions, StacksError, Subprocess, SyncSubprocess } from '@stacksjs/types'
import type { Result, ResultAsync } from '@stacksjs/error-handling'
import { errAsync, handleError, okAsync } from '@stacksjs/error-handling'
import { spawn, spawnSync } from './command'
import { log } from './console'

/**
 * Execute a command.
 *
 * @param command The command to execute.
 * @param options The options to pass to the command.
 * @param errorMsg The name of the error to throw if the command fails.
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
export async function exec(command: string | string[], options?: CliOptions): Promise<ResultAsync<Subprocess, StacksError>> {
  const cmd: string[] = Array.isArray(command) ? command : command.split(' ')
  const proc = spawn(cmd, {
    ...options,
    stdout: options?.stdout || 'inherit',
    cwd: options?.cwd || import.meta.dir,
    onExit(subprocess, exitCode, signalCode, error) {
      console.log('here')
      if (exitCode !== 0 && exitCode) {
        log.error(error)
        process.exit(exitCode)
      }
    },
  })

  const exited = await proc.exited
  if (exited === 0)
    return okAsync(proc)

  return errAsync(handleError(new Error(`Failed to execute command: ${cmd.join(' ')}`)))
}

/**
 * Execute a command and return result.
 *
 * @param command The command to execute.
 * @returns The result of the command.
 * @example
 * ```ts
 * const result = execSync('ls')
 *
 * if (result.isErr())
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 * @example
 * ```ts
 * const result = execSync('ls', { cwd: '/home' })
 * ```
 */
export function execSync(command: string | string[], options?: CliOptions): Result<SyncSubprocess, Error> {
  const cmd = Array.isArray(command) ? command : command.split(' ')
  const proc = spawnSync(cmd, {
    ...options,
    stdout: options?.stdout || 'inherit',
    cwd: options?.cwd || import.meta.dir,
    onExit(subprocess: any, exitCode: any, signalCode: any, error: any) {
      if (exitCode !== ExitCode.Success)
        log.error(error)
    },
  })

  if (proc.success)
    return ok(proc)

  return err(new Error(`Failed to execute command: ${cmd.join(' ')}`))
}

/**
 * Run a command.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 * @example
 * ```ts
 * const result = await runCommand('ls')
 *
 * if (result.isErr())
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 * @example
 * ```ts
 * const result = await runCommand('ls', { cwd: '/home' })
 *
 * if (result.isErr())
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 */
export async function runCommand(command: string, options?: string | CliOptions): Promise<ResultAsync<Subprocess, StacksError>> {
  if (typeof options === 'string')
    return await exec(command, { cwd: options })

  return await exec(command, options)
}

/**
 * Run many commands.
 *
 * @param commands The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommands(commands: string[], options?: CliOptions) {
  const results = []

  for (const command of commands)
    results.push(await runCommand(command, options))

  return results
}
