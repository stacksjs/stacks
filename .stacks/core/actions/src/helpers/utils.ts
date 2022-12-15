import storage from '@stacksjs/storage'
import { runCommand } from '@stacksjs/cli'
import { actionsPath, functionsPath } from '@stacksjs/path'
import type { CliOptions } from '@stacksjs/types'
import { err } from '@stacksjs/error-handling'

/**
 * Run a command the Stacks way.
 *
 * @param command The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runAction(action: string, options?: CliOptions) {
  if (!hasAction(action))
    return err(`The specified action "${action}" does not exist`)

  const cmd = `esno ${actionsPath(`${action}.ts`)}`
  return await runCommand(cmd, options)
}

export function hasAction(action: string) {
  if (storage.isFile(functionsPath(`actions/${action}.ts`)))
    return true

  if (storage.isFile(actionsPath(`${action}.ts`)))
    return true

  return false
}
