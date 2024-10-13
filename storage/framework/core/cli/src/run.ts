import type { Ok, Result } from '@stacksjs/error-handling'
import type { CliOptions, CommandError, Readable, Subprocess, Writable } from '@stacksjs/types'
import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { log } from './console'
import { exec, execSync } from './exec'

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
  log.debug('runCommand:', command, options)

  return await exec(command, options)
}

export async function runProcess(command: string, options?: CliOptions): Promise<Result<Subprocess, CommandError>> {
  log.debug('runProcess:', command, options)

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
export async function runCommandSync(command: string, options?: CliOptions): Promise<string> {
  log.debug('runCommandSync:', command, options)

  return await execSync(command, options)
}

/**
 * Run many commands.
 *
 * @param commands The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommands(
  commands: string[],
  options?: CliOptions,
): Promise<Ok<Subprocess<Writable, Readable, Readable>, Error>[]> {
  const results = []

  for (const command of commands) {
    const result = await runCommand(command, options)

    if (result.isErr()) {
      handleError('Error during runCommands', result.error)
      process.exit(ExitCode.FatalError)
    }

    results.push(result)
  }

  return results
}
