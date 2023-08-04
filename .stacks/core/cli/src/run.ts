import { type CliOptions, type StacksError, type Subprocess } from '@stacksjs/types'
import { type Result } from '@stacksjs/error-handling'
import { exec } from './exec'

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
export async function runCommand(command: string, options?: string | CliOptions): Promise<Result<Subprocess, StacksError>> {
  const result = await exec(command, options)

  if (result.isErr())
    return reject(result.error)

  return result
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
