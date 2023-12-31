import type { CliOptions, CommandError, Subprocess, SyncSubprocess } from 'src/types/src'
import { type Result, err, ok } from 'src/error-handling/src'
import { exec, execSync } from './exec'
import { italic, underline } from './utilities'
import { log } from './console'

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
export async function runCommand(command: string, options?: CliOptions): Promise<Result<Subprocess, CommandError>> {
  if (options?.verbose)
    log.debug('Running command:', underline(italic(command)), 'with options:', options)

  return await exec(command, options)
}

export async function runProcess(command: string, options?: CliOptions): Promise<Result<Subprocess, CommandError>> {
  if (options?.verbose)
    log.debug('Running command:', underline(italic(command)), 'with options:', options)

  return await exec(command, options)
}

/**
 * Run a command.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 * @example
 * ```ts
 * const result = runCommandSync('ls')
 *
 * if (result.isErr())
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 * @example
 * ```ts
 * const result = runCommandSync('ls', { cwd: '/home' })
 *
 * if (result.isErr())
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 */
export function runCommandSync(command: string, options?: CliOptions): Result<SyncSubprocess, CommandError> {
  if (options?.verbose)
    log.debug('Running command:', underline(italic(command)), 'with options:', options)

  const result = execSync(command, options)

  if (result.isErr())
    return err(result.error)

  return ok(result.value)
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
