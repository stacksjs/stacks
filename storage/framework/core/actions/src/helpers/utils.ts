import * as storage from '@stacksjs/storage'
import { buddyOptions, italic, parseOptions, runCommand, runCommands, underline } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import type { ActionOptions, StacksError, Subprocess } from '@stacksjs/types'
import type { Result } from '@stacksjs/error-handling'
import { err, handleError } from '@stacksjs/error-handling'

/**
 * Run an Action the Stacks way.
 *
 * @param action The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runAction(action: string, options?: ActionOptions): Promise<Result<Subprocess, StacksError>> {
  if (!hasAction(action))
    return err(handleError(`The specified action "${action}" does not exist`))

  const opts = parseOptions()
  const path = p.relativeActionsPath(`${action}.ts`)
  const cmd = `bun --bun ${path} ${opts}`.trimEnd()
  const optionsWithCwd = {
    cwd: options?.cwd || p.projectPath(),
    ...options,
  }

  if (options?.verbose) {
    log.debug('Action command:', cmd)
    log.debug('Running cmd:', underline(italic(cmd)))
    log.debug('Running action:', underline(italic(`./actions/${action}.ts`)))
    log.debug('With action options of:', optionsWithCwd)
  }

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
  if (!actions.length)
    return err('No actions were specified')

  for (const action of actions) {
    if (!hasAction(action))
      return err(`The specified action "${action}" does not exist`)
  }

  const opts = buddyOptions()

  const o = {
    cwd: options?.cwd || p.projectPath(),
    ...parseOptions(),
  }

  const commands = actions.map(action => `bun --bun ${p.relativeActionsPath(`${action}.ts`)} ${opts}`)

  return await runCommands(commands, o)
}

export function hasAction(action: string) {
  if (storage.isFile(p.functionsPath(`actions/${action}.ts`)))
    return true

  return storage.isFile(p.actionsPath(`${action}.ts`))
}
