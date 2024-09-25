import type { Action as ActionType } from '@stacksjs/actions'
import { buddyOptions, runCommand, runCommands } from '@stacksjs/cli'
import type { Err, Ok, Result } from '@stacksjs/error-handling'
import { err } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { globSync } from '@stacksjs/storage'
import type { Readable, Subprocess, Writable } from '@stacksjs/types'
import type { ActionOptions, CommandError } from '@stacksjs/types'

type ActionPath = string // TODO: narrow this by automating its generation
type ActionName = string // TODO: narrow this by automating its generation
type Action = ActionPath | ActionName | string

/**
 * Run an Action the Stacks way.
 *
 * @param action The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runAction(action: Action, options?: ActionOptions): Promise<Result<Subprocess, CommandError>> {
  // check if action is a file anywhere in ./app/Actions/**/*.ts
  // if it is, return and await the action
  const glob = new Bun.Glob('**/*.{ts,js}')
  const scanOptions = { cwd: p.userActionsPath(), onlyFiles: true }

  for await (const file of glob.scan(scanOptions)) {
    if (file === `${action}.ts` || file.endsWith(`${action}.ts`))
      return ((await import(p.userActionsPath(file))).default as ActionType).handle()

    if (file === `${action}.js` || file.endsWith(`${action}.js`))
      return ((await import(p.userActionsPath(file))).default as ActionType).handle()

    // if a custom model name is used, we need to check for it
    try {
      const a = await import(p.userActionsPath(file))
      if (a.name === action) {
        console.log('a.name matches', a.name)
        return await a.handle()
      }
    } catch (error) {
      console.log('error', error)
      process.exit()
    }
  }

  // or else, just run the action normally by assuming the action is core Action,  stored in p.actionsPath
  const opts = buddyOptions()
  const path = p.relativeActionsPath(`src/${action}.ts`)
  const cmd = `bun ${path} ${opts}`.trimEnd()
  const optionsWithCwd = {
    cwd: options?.cwd || p.projectPath(),
    ...options,
  }

  log.debug('runAction:', cmd)
  log.debug('action options:', optionsWithCwd)

  return await runCommand(cmd, optionsWithCwd)
}

/**
 * Run Actions the Stacks way.
 *
 * @param actions The actions to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runActions(
  actions: Action[],
  options?: ActionOptions,
): Promise<Ok<Subprocess<Writable, Readable, Readable>, Error>[] | Err<never, string>> {
  log.debug('runActions:', actions, options)

  if (!actions.length) return err('No actions were specified')

  for (const action of actions) {
    log.debug(`running action "${action}"`)
    if (!hasAction(action)) return err(`The specified action "${action}" does not exist`)
  }

  const opts = buddyOptions()

  const o = {
    cwd: options?.cwd || p.projectPath(),
    ...options,
  }

  const commands = actions.map((action) => `bun ${p.relativeActionsPath(`src/${action}.ts`)} ${opts}`)

  log.debug('commands:', commands)

  return await runCommands(commands, o)
}

// looks in most common locations
export function hasAction(action: Action): boolean {
  // Define patterns specifically for user actions
  const userActionPatterns = [
    `${action}.ts`,
    `${action}`,
    `Dashboard/${action}.ts`,
    `Dashboard/${action}`,
    `Buddy/${action}.ts`,
    `Buddy/${action}`,
  ]

  // Define patterns specifically for core actions
  const actionPatterns = [`src/${action}.ts`, `src/${action}`, `${action}.ts`, `${action}`]

  // Check user actions path with its specific patterns
  const userActionFiles = globSync(userActionPatterns.map((pattern) => p.userActionsPath(pattern)))

  // Check actions path with its specific patterns
  const actionFiles = globSync(actionPatterns.map((pattern) => p.actionsPath(pattern)))

  return userActionFiles.length > 0 || actionFiles.length > 0

  // TODO: need to loop through all user actions and check whether the name is a valid action name match

  // return false
}
