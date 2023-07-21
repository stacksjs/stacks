import { ExitCode } from '@stacksjs/types'
import type { CliOptions, Subprocess, SyncSubprocess } from '@stacksjs/types'
import type { Result } from '@stacksjs/error-handling'
import { ResultAsync, errAsync } from '@stacksjs/error-handling'
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

  if (await proc.exited === ExitCode.Success)
    return okAsync(proc)

  return errAsync(proc)
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

  return err(proc)
}

/**
 * Run a command.
 *
 * @param command The command to run.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export function runCommand(command: string | string[], options?: CliOptions): ResultAsync<Subprocess, Error> {
  // if (Array.isArray(command)) {
  //   const results = []

  //   for (const c of command)
  //     results.push(ResultAsync.fromPromise(exec(c, options), () => new Error('Failed to run command')))

  //   return results
  // }

  return ResultAsync.fromPromise(exec(command, options), () => new Error('Failed to run command'))
}

type CommandResult = Result<Subprocess, Error>

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
