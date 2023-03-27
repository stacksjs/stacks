import { execSync as childExec } from 'node:child_process'
import type { Err } from '@stacksjs/error-handling'
import type { CliOptions, CommandResult, Result, SpinnerOptions as Spinner } from '@stacksjs/types'
import { ResultAsync, err } from '@stacksjs/error-handling'
import { projectPath } from '@stacksjs/path'
import { determineDebugMode } from '@stacksjs/config'
import { spawn } from './command'
import { startSpinner } from './helpers'
import { italic } from '.'

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
  const shell = options?.shell || false

  return ResultAsync.fromPromise(
    spawn(command, { stdio, cwd, shell }),
    () => new Error(`Failed to run command: ${italic(command)}`),
  )
}

/**
 * Execute a command and return result.
 *
 * @param command The command to execute.
 * @returns The result of the command.
 */
export function execSync(command: string) {
  return childExec(command, { encoding: 'utf-8' })
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
export async function runCommands(commands: string[], options?: CliOptions): Promise<Result<CommandResult<string>, Error>[] | Result<CommandResult<string>, Error> | Err<CommandResult<string>, string>> {
  const results: Result<CommandResult<string>, Error>[] = []
  const numberOfCommands = commands.length

  if (!numberOfCommands)
    return err('No commands were specified')

  const spinner = determineSpinner(options)

  for (const command of commands) {
    const result = await runCommand(command, options)

    if (result?.isOk())
      results.push(result)

    if (result?.isErr()) {
      if (spinner) {
        spinner.fail('Failed to run command.')
        err(result.error)
        process.exit()
      }

      results.push(result)
      break
    }
  }

  if (spinner)
    spinner.stop()

  if (numberOfCommands === 1)
    return results[0]

  return results
}

function determineSpinner(options?: CliOptions): Spinner | undefined {
  if (!determineDebugMode(options))
    return startSpinner(options?.spinnerText)

  return undefined
}
