import type { CliOptions } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'
import { spinner } from '@stacksjs/cli'
import { ResultAsync, ok } from '@stacksjs/errors'
import { projectPath } from '@stacksjs/path'
import { spawn } from '../command'
import { animatedLoading } from '../helpers'

/**
 * Execute a command.
 *
 * @param command The command to execute.
 * @param options The options to pass to the command.
 * @param errorMsg The name of the error to throw if the command fails.
 * @returns The result of the command.
 */
export function exec(command: string, options?: CliOptions, errorMsg?: string) {
  const stdio = debugLevel(options)
  const cwd = options?.cwd || projectPath()

  return ResultAsync.fromPromise(
    spawn(command, { stdio, cwd }),
    () => new Error(errorMsg),
  )
}

/**
 * Run a command the Stacks way.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommand(command: string, options?: CliOptions, returnSpinner = false) {
  if (options?.shouldBeAnimated) {
    const spin = spinner('Running...').start()
    const errorMsg = 'Unknown short-lived command execution error. If this issue persists, please create an issue on GitHub.'
    const result = await exec(command, options, errorMsg)

    if (returnSpinner)
      return ok({ spinner: spin })

    return result
  }

  if (options?.shouldBeAnimated)
    animatedLoading(options)

  const errorMsg = 'Unknown longer-running command execution error. If this issue persists, please create an issue on GitHub.'
  const result = await exec(command, options, errorMsg)

  if (typeof spin === 'object' && spin.isSpinning)
    spin.stop()

  return result
}
