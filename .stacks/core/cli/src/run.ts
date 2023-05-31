import { execSync as childExec } from 'node:child_process'
import type { CliOptions, CommandResult, CommandReturnValue, ResultAsync, SpinnerOptions as Spinner } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'
import { ResultAsync as AsyncResult } from '@stacksjs/error-handling'
import { determineDebugLevel } from '@stacksjs/utils'
import { log } from './console'
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
export function exec(command: string, options?: CliOptions): ResultAsync<CommandReturnValue, Error> {
  const cwd = options?.cwd || projectPath()
  const stdio = determineDebugLevel(options) ? 'inherit' : 'ignore'
  const shell = options?.shell || false

  return AsyncResult.fromPromise(
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
export async function runCommand(command: string, options?: CliOptions): Promise<ResultAsync<CommandReturnValue, Error>> {
  return exec(command, options)
}

/**
 * Run many commands—the Stacks way.
 *
 * @param commands The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommands(commands: string[], options?: CliOptions): Promise<CommandResult | CommandResult[]> {
  const results: CommandResult[] = []
  const numberOfCommands = commands.length

  if (!numberOfCommands) {
    log.error(new Error('No commands were specified'))
    process.exit(ExitCode.FatalError)
  }

  const spinner = determineSpinner(options)

  for (const command of commands) {
    const result = await runCommand(command, options)

    if (result.isOk()) {
      results.push(result)
    }
    else if (result.isErr()) {
      log.error(new Error(`Failed to run command ${italic(command)}`))

      process.exit(ExitCode.FatalError)

      // results.push(result)
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
  if (!determineDebugLevel(options))
    return startSpinner(options?.spinnerText)

  return undefined
}
