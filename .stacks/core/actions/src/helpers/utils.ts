import * as storage from '@stacksjs/storage'
import { italic, runCommand, runCommands } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { actionsPath, functionsPath } from '@stacksjs/path'
import { type ActionOptions, type StacksError, type SyncSubprocess } from '@stacksjs/types'
import { type Result, err, handleError } from '@stacksjs/error-handling'

function parseOptions(options?: ActionOptions) {
  if (!options)
    return ''

  const parsedOptions = Object.entries(options).map(([key, value]) => {
    if (key.length === 1)
      return `-${key}=${value}`

    if (typeof value === 'boolean' && value) // if the value is `true`, just return the key
      return `--${key}`

    return `--${key}=${value}`
  })

  // filter out undefined values and join the array
  return parsedOptions.filter(Boolean).join(' ').replace('----=', '')
}

// export type ActionResult = CommandResult

/**
 * Run an Action the Stacks way.
 *
 * @param action The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export function runAction(action: string, options?: ActionOptions): Result<SyncSubprocess, StacksError> {
  if (!hasAction(action))
    return err(handleError(`The specified action "${action}" does not exist`))

  // we need to parse options here because they need to bw passed to the action
  const opts = parseOptions(options)
  const cmd = `bun --bun ${actionsPath(`${action}.ts ${opts}`)}`

  if (options?.verbose)
    log.debug('Running action:', italic(action))

  return runCommand(cmd, options)
}

/**
 * Run Actions the Stacks way.
 *
 * @param actions The actions to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
// export async function runActions(actions: string[], options?: ActionOptions): Promise<CommandResult | CommandResult[]> {
export function runActions(actions: string[], options?: ActionOptions) {
  if (!actions.length)
    return err('No actions were specified')

  for (const action of actions) {
    if (!hasAction(action))
      return err(`The specified action "${action}" does not exist`)
  }

  const commands = actions.map(action => `bun ${actionsPath(`${action}.ts`)}`)

  return runCommands(commands, options)
}

export function hasAction(action: string) {
  if (storage.isFile(functionsPath(`actions/${action}.ts`)))
    return true

  return storage.isFile(actionsPath(`${action}.ts`))
}
