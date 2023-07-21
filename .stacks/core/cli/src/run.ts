import { ExitCode } from '@stacksjs/types'
import type { CliOptions, Subprocess, SyncSubprocess } from '@stacksjs/types'
import type { Result, ResultAsync } from '@stacksjs/error-handling'
import { errAsync, okAsync } from '@stacksjs/error-handling'
import { log } from '@stacksjs/cli'
import { spawn, spawnSync } from './command'

/**
 * Execute a command.
 *
 * @param command The command to execute.
 * @param options The options to pass to the command.
 * @param errorMsg The name of the error to throw if the command fails.
 * @returns The result of the command.
 */
export async function exec(command: string | string[], options?: CliOptions): Promise<ResultAsync<Subprocess, Error>> {
  const cmd = Array.isArray(command) ? command : command.split(' ')
  const proc = spawn(cmd, {
    ...options,
    stdout: options?.stdout || 'inherit',
    cwd: options?.cwd || import.meta.dir,
    onExit(subprocess, exitCode, signalCode, error) {
      if (exitCode !== ExitCode.Success)
        log.error(error)
    },
  })
  const exited = await proc.exited

  if (exited === ExitCode.Success)
    return okAsync(proc)

  return errAsync(new Error(`Failed to execute command: ${cmd.join(' ')}`))
}

/**
 * Execute a command and return result.
 *
 * @param command The command to execute.
 * @returns The result of the command.
 */
export function execSync(command: string | string[], options?: CliOptions): Result<SyncSubprocess, Error> {
  const cmd = Array.isArray(command) ? command : command.split(' ')
  const proc = spawnSync(cmd, {
    ...options,
    stdout: options?.stdout || 'inherit',
    cwd: options?.cwd || import.meta.dir,
    onExit(subprocess: any, exitCode: any, signalCode: any, error: any) {
      if (exitCode !== ExitCode.Success)
        log.error(error)
    },
  })

  if (proc.success)
    return ok(proc)

  return err(new Error(`Failed to execute command: ${cmd.join(' ')}`))
}

/**
 * Run a command.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runCommand(command: string, options?: CliOptions): Promise<ResultAsync<Subprocess, Error>> {
  return await exec(command, options)
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

// function determineSpinner(options?: CliOptions): Spinner | undefined {
//   if (!determineDebugLevel(options))
//     return startSpinner(options?.spinnerText)

//   return undefined
// }
