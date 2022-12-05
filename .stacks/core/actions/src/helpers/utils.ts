import storage from '@stacksjs/storage'
import { runCommand } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { actionsPath, functionsPath } from '@stacksjs/path'
import type { CliOptions } from '@stacksjs/types'

/**
 * Run a command the Stacks way.
 *
 * @param command The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runAction(action: string, options?: CliOptions) {
  let path

  if (!hasAction(action))
    log.error(`The specified action "${action}" does not exist`)

  return await runCommand(`esno ${path}`, { ...options, debug: true, cwd: actionsPath() })
}

export function hasAction(action: string) {
  if (storage.isFile(functionsPath(`actions/${action}.ts`)))
    return true

  if (actionsPath(`src/${action}.ts`))
    return true

  return false
}
