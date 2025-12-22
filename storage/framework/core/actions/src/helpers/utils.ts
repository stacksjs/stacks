import type { Action as ActionType } from '@stacksjs/actions'
import type { Err, Ok, Result } from '@stacksjs/error-handling'
import type { ActionOptions, CliOptions, CommandError, Readable, Subprocess, Writable } from '@stacksjs/types'
import { buddyOptions, runCommand, runCommands } from '@stacksjs/cli'
import { err } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { globSync } from '@stacksjs/storage'

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

  // Special case: handle dev/views directly for maximum performance
  if (action === 'dev/views') {
    try {
      log.success('🚀 Starting STX development server on http://localhost:3456\n')

      // Import and call serve function directly - no subprocess!
      const { serve } = await import('bun-plugin-stx/serve')
      await serve({
        patterns: ['resources/views'],
        port: 3456,
      })

      // This will never return since serve runs forever
      // eslint-disable-next-line no-unreachable
      return { ok: true, value: {} as Subprocess }
    }
    catch (error) {
      return err(`Failed to start dev server: ${error}`)
    }
  }

  // Quick check: does this look like a core action? (contains a slash or is a common core action name)
  // Most core actions are like "dev/views", "build/app", etc.
  const isLikelyCoreAction = action.includes('/') || ['dev', 'build', 'install', 'upgrade', 'migrate'].some(prefix => action.startsWith(prefix))

  if (!isLikelyCoreAction) {
    // Only scan user actions if it's NOT likely a core action
    const glob = new Bun.Glob('**/*.{ts,js}')
    const scanOptions = { cwd: p.userActionsPath(), onlyFiles: true, absolute: true }

    // First pass: only check filenames, don't import anything
    const matchingFiles: string[] = []
    const basePath = p.userActionsPath()

    for await (const file of glob.scan(scanOptions)) {
      // Normalize the file path relative to basePath to match the action name
      // e.g., /path/to/app/Actions/SomeAction.ts -> SomeAction
      const relativePath = file.replace(`${basePath}/`, '').replace(/\.(ts|js)$/, '')

      if (relativePath === action || file.endsWith(`${action}.ts`) || file.endsWith(`${action}.js`)) {
        // Direct filename match - import and execute immediately
        return ((await import(file)).default as ActionType).handle()
      }
      // Collect all files for potential name matching (only if direct match fails)
      matchingFiles.push(file)
    }

    // Second pass: only import files if we didn't find a direct match
    // This is a fallback for custom action names
    for (const file of matchingFiles) {
      try {
        const a = await import(file)
        if (a.name === action) {
          return await a.handle()
        }
      }
      // eslint-disable-next-line unused-imports/no-unused-vars
      catch (error) {
        // handleError(error, { shouldExit: false })
      }
    }
  }

  // or else, just run the action normally by assuming the action is core Action,  stored in p.actionsPath
  const opts = buddyOptions()
  const path = p.relativeActionsPath(`src/${action}.ts`)

  // Use --watch for dev actions to enable hot reloading
  const isDevAction = action.startsWith('dev/')
  const watchFlag = isDevAction ? '--watch' : ''
  const cmd = `bun ${watchFlag} ${path} ${opts}`.trimEnd()

  const optionsWithCwd: CliOptions = {
    cwd: options?.cwd || p.projectPath(),
    stdio: [options?.stdin ?? 'inherit', 'pipe', 'pipe'],
    ...options,
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
export async function runActions(
  actions: Action[],
  options?: ActionOptions,
): Promise<Ok<Subprocess<Writable, Readable, Readable>, Error>[] | Err<never, string>> {
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

  const commands = actions.map(action => `bun ${p.relativeActionsPath(`src/${action}.ts`)} ${opts}`)

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
  const userActionFiles = globSync(userActionPatterns.map(pattern => p.userActionsPath(pattern)))

  // Check actions path with its specific patterns
  const actionFiles = globSync(actionPatterns.map(pattern => p.actionsPath(pattern)))

  return userActionFiles.length > 0 || actionFiles.length > 0

  // TODO: need to loop through all user actions and check whether the name is a valid action name match

  // return false
}
