import storage from '@stacksjs/storage'
import { runCommand, runCommands } from '@stacksjs/cli'
import { actionsPath, functionsPath } from '@stacksjs/path'
import type { CliOptions, CommandResult } from '@stacksjs/types'
import type { Err, Result } from '@stacksjs/error-handling'
import { err } from '@stacksjs/error-handling'

const parseOptions = (options?: CliOptions) => {
  if (!options)
    return ''

  const parsedOptions = Object.entries(options).map(([key, value]) => {
    if (typeof value === 'boolean')
      return `--${key}`
    else
      return `--${key}=${value}`
  })

  // ----= only happens when no flags are passed
  return parsedOptions.join(' ').replace('----=', '')
}

/**
 * Run an Action the Stacks way.
 *
 * @param command The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runAction(action: string, options?: CliOptions): Promise<Result<CommandResult<string>, Error> | Err<CommandResult<string>, string>> {
  if (!hasAction(action))
    return err(`The specified action "${action}" does not exist.`)

  // we need to parse options here because we need to pass them to the action command
  const opts = parseOptions(options)
  const cmd = `npx esno ${actionsPath(`${action}.ts ${opts}`)}`

  // eslint-disable-next-line no-console
  console.log('Running command:', cmd, options)

  return options?.shouldShowSpinner
    ? await runCommands([cmd], options)
    : await runCommand(cmd, options)
}

/**
 * Run Actions the Stacks way.
 *
 * @param command The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runActions(actions: string[], options?: CliOptions): Promise<Result<CommandResult<string>, Error>[] | Result<CommandResult<string>, Error> | Err<CommandResult<string>, string>> {
  if (!actions.length)
    return err('No actions were specified')

  for (const action of actions) {
    if (!hasAction(action))
      return err(`The specified action "${action}" does not exist`)
  }

  const commands = actions.map(action => `npx esno ${actionsPath(`${action}.ts`)}`)

  return await runCommands(commands, options)
}

export function hasAction(action: string) {
  if (storage.isFile(functionsPath(`actions/${action}.ts`)))
    return true

  if (storage.isFile(actionsPath(`${action}.ts`)))
    return true

  return false
}
