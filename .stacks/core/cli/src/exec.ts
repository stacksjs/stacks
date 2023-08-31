/* eslint-disable unused-imports/no-unused-vars */
import { ExitCode } from '@stacksjs/types'
import type { CliOptions, StacksError, Subprocess, SyncSubprocess } from '@stacksjs/types'
import { type Result, err, handleError, ok } from '@stacksjs/error-handling'

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
export async function exec(command: string | string[], options?: CliOptions): Promise<Result<Subprocess, StacksError>> {
  const cmd: string[] = Array.isArray(command) ? command : command.split(' ')
  const proc = Bun.spawn(cmd, {
    ...options,
    stdout: options?.stdout || 'pipe',
    stderr: options?.stderr || 'inherit',
    cwd: options?.cwd || import.meta.dir,
    // onExit(subprocess, exitCode, signalCode, error) {
    //   console.log('onExit', { subprocess, exitCode, signalCode, error })
    //   // if (exitCode !== ExitCode.Success && exitCode)
    //   //   handleError(`Failed to execute command: ${cmd.join(' ')}`)
    // },
  })

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
  const proc = Bun.spawnSync(cmd, {
    ...options,
    stdout: options?.stdout ?? 'inherit',
    cwd: options?.cwd ?? import.meta.dir,
    env:  { ...process.env, ...options?.env },
    // onExit(subprocess: any, exitCode: any, signalCode: any, error: any) {
    //   if (exitCode !== ExitCode.Success)
    //     log.error(error)
    // },
  })

  if (proc.success)
    return ok(proc)

  return err(handleError(`Failed to execute command: ${cmd.join(' ')}`))
}
