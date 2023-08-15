import { type CliOptions, type CommandError, type SyncSubprocess } from '@stacksjs/types'
import { type Result, err, ok } from '@stacksjs/error-handling'
import { execSync } from './exec'
import { italic } from './utilities'
import { log } from './console'

/**
 * Run a command.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 * @example
 * ```ts
 * const result = runCommand('ls')
 *
 * if (result.isErr())
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 * @example
 * ```ts
 * const result = runCommand('ls', { cwd: '/home' })
 *
 * if (result.isErr())
 *   console.error(result.error)
 * else
 *   console.log(result)
 * ```
 */
export function runCommand(command: string, options?: CliOptions): Result<SyncSubprocess, CommandError> {
  if (options?.verbose)
    log.debug('Running command:', italic(command))

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
export function runCommands(commands: string[], options?: CliOptions) {
  const results = []

  for (const command of commands)
    results.push(runCommand(command, options))

  return results
}
