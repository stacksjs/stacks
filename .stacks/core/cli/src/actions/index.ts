import type { CliOptions } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'
import { spinner } from '@stacksjs/cli'
import { ResultAsync } from '@stacksjs/errors'
import { projectPath } from '@stacksjs/path'
import { spawn } from '../command'
import { animatedLoading } from '../helpers'

/**
 * Install an npm package.
 *
 * @param pkg - The package name to install.
 * @returns The result of the install.
 */
export async function installPackage(pkg: string) {
  return ResultAsync.fromPromise(
    runCommand(`pnpm install ${pkg}`),
    () => new Error('Package install error'),
  )
}

/**
 * Install a Stack into your project.
 *
 * @param pkg - The Stack name to install.
 * @returns The result of the install.
 */
export async function installStack(name: string) {
  return ResultAsync.fromPromise(
    runCommand(`pnpm install @stacksjs/${name}`),
    () => new Error('Stack install error'),
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
  const isFastCommand = options?.shortLived ?? false
  let spin = options?.loadingAnimation ?? true

  if (isFastCommand) {
    if (spin)
      spin = spinner('Running...').start()

    return exec(command, options, 'Short-lived command error')
  }

  await animatedLoading(options)
  const result = exec(command, options, 'Command error')

  if (typeof spin === 'object' && spin.isSpinning)
    spin.stop()

  return result
}

/**
 * Execute a command.
 *
 * @param command The command to execute.
 * @param options The options to pass to the command.
 * @param errorName The name of the error to throw if the command fails.
 * @returns The result of the command.
 */
export function exec(command: string, options?: CliOptions, errorName?: string) {
  const debug = debugLevel(options)

  return ResultAsync.fromPromise(
    spawn(command, { stdio: debug, cwd: options?.cwd || projectPath() }),
    () => new Error(errorName),
  )
}

/**
 * Run a command in a child process. The only difference
 * from a long-running command is that a short-lived
 * command will not show a loading animation.
 *
 * @param command Command to run
 * @param options Options to pass to the command
 * @returns The result of the command
 */
export async function runShortLivedCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: true, ...options })
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
