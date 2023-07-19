import type { CliOptions, SpinnerOptions as Spinner } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'
import { determineDebugLevel } from '@stacksjs/utils'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { spawn, spawnSync } from './command'
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
export async function exec(command: string | string[], options?: CliOptions) {
  const cwd = options?.cwd || projectPath()
  const shell = options?.shell || false

  console.log('command', command)

  if (!Array.isArray(command))
    command = [command]

  const proc = spawn(command, {
    cwd,
    env: process.env,
    shell,
  })

  console.log('proc', proc)

  await proc.exited

  if (proc.exitCode === ExitCode.Success)
    return ok(proc)
}

/**
 * Execute a command and return result.
 *
 * @param command The command to execute.
 * @returns The result of the command.
 */
export function execSync(command: string) {
  const cwd = options?.cwd || projectPath()
  const shell = options?.shell || false

  return spawnSync([command], { cwd, shell })
}

/**
 * Run a command the Stacks way.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommand(command: string | string[], options?: CliOptions) {
  return exec(command, options)
}

/**
 * Run many commands—the Stacks way.
 *
 * @param commands The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommands(commands: string[], options?: CliOptions) {
  const results = []
  const numberOfCommands = commands.length

  if (!numberOfCommands) {
    log.error(new Error('No commands were specified'))
    process.exit(ExitCode.FatalError)
  }

  const spinner = determineSpinner(options)

  for (const command of commands) {
    const result = await runCommand(command, options)

    if (result?.isOk()) {
      results.push(result)
    }
    else if (result?.isErr()) {
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
