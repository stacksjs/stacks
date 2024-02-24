import * as storage from '@stacksjs/storage'
import { buddyOptions, runCommand, runCommands } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import type { ActionOptions, Subprocess } from '@stacksjs/types'
import type { Result } from '@stacksjs/error-handling'
import { err, handleError } from '@stacksjs/error-handling'

/**
 * Run an Action the Stacks way.
 *
 * @param action The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runAction(action: string, options?: ActionOptions): Promise<Result<Subprocess, Error>> {
  const opts = buddyOptions()
  const path = p.relativeActionsPath(`src/${action}.ts`)
  const cmd = `bun --bun ${path} ${opts}`.trimEnd()
  const optionsWithCwd = {
    cwd: options?.cwd || p.projectPath(),
    ...options,
  }

  log.debug('runAction:', cmd)
  log.debug('action options:', optionsWithCwd)

  if (!hasAction(action))
    return err(handleError(`The specified action "${action}" does not exist`))

  return await runCommand(cmd, optionsWithCwd)
}

/**
 * Run Actions the Stacks way.
 *
 * @param actions The actions to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runActions(actions: string[], options?: ActionOptions) {
  log.debug('runActions:', actions)
  log.debug('actions options:', options)

  if (!actions.length)
    return err('No actions were specified')

  for (const action of actions) {
    if (!hasAction(action))
      return err(`The specified action "${action}" does not exist`)
  }

  const opts = buddyOptions()

  const o = {
    cwd: options?.cwd || p.projectPath(),
    ...options,
  }

  const commands = actions.map(action => `bun --bun ${p.relativeActionsPath(`${action}.ts`)} ${opts}`)

  return await runCommands(commands, o)
}

export function hasAction(action: string) {
  if (storage.isFile(p.functionsPath(`actions/${action}.ts`)))
    return true

  return storage.isFile(p.actionsPath(`${action}.ts`))
}
