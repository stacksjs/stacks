import { ExitCode } from '@stacksjs/types'
import { type CliOptions, type StacksError, type Subprocess, type SyncSubprocess } from '@stacksjs/types'
import { err, ok } from '@stacksjs/error-handling'
import { type Result } from '@stacksjs/error-handling'
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
export async function exec(command: string | string[], options?: CliOptions): Promise<Result<Subprocess, StacksError>> {
  return new Promise(async (resolve, reject) => {
    const cmd: string[] = Array.isArray(command) ? command : command.split(' ')
    const proc = Bun.spawn(cmd, {
      ...options,
      stdout: options?.stdout || 'inherit',
      cwd: options?.cwd || import.meta.dir,
      onExit(subprocess, exitCode, signalCode, error) {
        if (exitCode !== ExitCode.Success && exitCode) {
          log.error(error)
          reject(new Error(`Failed to execute command: ${cmd.join(' ')}`))
        }
      },
    })

    const exited = await proc.exited
    if (exited === ExitCode.Success)
      return resolve(ok(proc))

    return reject(err(handleError(new Error(`Failed to execute command: ${cmd.join(' ')}`))))
  })
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
