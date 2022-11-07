import { ResultAsync } from '@stacksjs/types'
import type { CliOptions } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'
import { spinner } from '@stacksjs/cli'
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
export async function runCommand(command: string, options?: CliOptions) {
  const isShortLived = options?.shortLived ?? false
  let spin = options?.loadingAnimation ?? true

  if (isShortLived && spin) {
    spin = spinner('Running...').start()
    const errorMsg = 'Unknown short-lived command execution error. If this issue persists, please create an issue on GitHub.'
    return await exec(command, options, errorMsg)
  }

  animatedLoading(options)
  const errorMsg = 'Unknown longer-running command execution error. If this issue persists, please create an issue on GitHub.'
  const result = await exec(command, options, errorMsg)

  if (typeof spin === 'object' && spin.isSpinning)
    spin.stop()

  return result
}

/**
 * Run a command in a child process. The only difference from
 * a long-running command is that a short-lived command will
 * not show a loading animation in the command line.
 *
 * @param command Command to run
 * @param options Options to pass to the command
 * @returns The result of the command or an instance of a running Spinner instance(used for chaining with long-running commands).
 */
export function runShortLivedCommand(command: string, options?: CliOptions, returnSpinner = false) {
  const result = runCommand(command, { shortLived: true, ...options })

  if (returnSpinner === true)
    return spinner('Running...').start()

  return result
}

/**
 * Run a command in a child process. The only difference
 * from a short-lived command is that a long-running
 * command will show a loading animation.
 *
 * @param command Command to run
 * @param options Options to pass to the command
 * @returns ResultAsync
 */
export async function runLongRunningCommand(command: string, options?: CliOptions) {
  return await runCommand(command, options)
}
