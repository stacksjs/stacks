import type { CliOptions, CommandResult, Result, SpinnerOptions as Spinner } from '@stacksjs/types'
import { determineDebugMode } from '@stacksjs/config'
import { ResultAsync } from '@stacksjs/error-handling'
import { projectPath } from '@stacksjs/path'
import { italic } from '@stacksjs/cli'
import { spawn } from '../command'
import { startAnimation } from '../helpers'

/**
 * Execute a command.
 *
 * @param command The command to execute.
 * @param options The options to pass to the command.
 * @param errorMsg The name of the error to throw if the command fails.
 * @returns The result of the command.
 */
export function exec(command: string, options?: CliOptions) {
  const cwd = options?.cwd || projectPath()
  const stdio = determineDebugMode(options) ? 'inherit' : 'ignore'

  return ResultAsync.fromPromise(
    spawn(command, { stdio, cwd }),
    () => new Error(`Failed to run command: ${italic(command)}`),
  )
}

/**
 * Run a command the Stacks way.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommand(command: string, options?: CliOptions) {
  return await exec(command, options)
}

/**
 * Run many commands—the Stacks way.
 *
 * @param commands The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommands(commands: string[], options?: CliOptions): Promise<Result<CommandResult<string>, Error>[]> {
  let spinner: Spinner | undefined

  if (!determineDebugMode(options))
    spinner = startAnimation()

  const results: Result<CommandResult<string>, Error>[] = []

  for (const command of commands) {
    const result = await runCommand(command, options)

    if (result.isOk())
      results.push(result)

    if (result.isErr()) {
      if (spinner)
        spinner.fail('Failed to run command.')

      results.push(result)
      break
    }
  }

  if (spinner)
    spinner.stop()

  return results
}
