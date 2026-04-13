import type { Action as ActionType } from '@stacksjs/actions'
import type { Result } from '@stacksjs/error-handling'
import type { ActionOptions, CliOptions, CommandError, Subprocess } from '@stacksjs/types'
import process from 'node:process'
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
  log.debug(`[action] Running: ${action}`)

  // Special case: handle dev/views directly for maximum performance
  if (action === 'dev/views') {
    try {
      // Ensure pantry packages are resolvable for compiled dependencies
      // that import @stacksjs/* packages at runtime
      const pantryPath = p.projectPath('pantry')
      if (!process.env.NODE_PATH?.includes(pantryPath)) {
        process.env.NODE_PATH = process.env.NODE_PATH ? `${pantryPath}:${process.env.NODE_PATH}` : pantryPath
        // @ts-expect-error - force Bun/Node to re-read module paths
        require('module').Module._initPaths?.()
      }

      // Check if the project has its own serve.ts — if so, use it directly.
      // This allows projects to define their own API routes, middleware, and config.
      const projectServe = p.projectPath('serve.ts')
      const projectServeFile = Bun.file(projectServe)
      if (await projectServeFile.exists()) {
        await import(projectServe)
      }
      else {
        const port = Number(process.env.PORT) || 3000

        // Import and call serve function directly - no subprocess!
        // Try standard resolution first, then fall back to pantry path
        let serve: any
        try {
          ;({ serve } = await import('bun-plugin-stx/serve'))
        }
        catch {
          ;({ serve } = await import(p.projectPath('pantry/bun-plugin-stx/dist/serve.js')))
        }
        await serve({
          patterns: ['resources/views', 'storage/framework/defaults/resources/views'],
          port,
          componentsDir: 'storage/framework/defaults/resources/components/Dashboard',
          layoutsDir: 'resources/layouts',
          partialsDir: 'resources/components',
          fallbackPartialsDir: 'resources/views',
          quiet: true,
        })
      }

      // This will never return since serve runs forever
      // eslint-disable-next-line no-unreachable
      return { ok: true, value: {} as Subprocess } as any
    }
    catch (error) {
      return err(`Failed to start dev server: ${error}`) as any
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
        log.debug(`[action] Resolved: ${action} → ${file}`)
        return await ((await import(file)).default as ActionType).handle(undefined as unknown as Parameters<ActionType['handle']>[0])
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
          log.debug(`[action] Resolved: ${action} → ${file}`)
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
  const path = p.relativeActionsPath(`src/${action}.ts`)
  log.debug(`[action] Resolved: ${action} → ${path}`)

  // Use --watch for dev actions to enable hot reloading
  const isDevAction = action.startsWith('dev/')
  const watchFlag = isDevAction ? '--watch' : ''
  // Dev actions manage their own config — don't pass CLI flags that trigger dep loading
  const opts = isDevAction ? '' : (buddyOptions(options) || '')
  const cmd = `bun ${watchFlag} ${path} ${opts}`.trimEnd()

  // Ensure pantry packages are resolvable via NODE_PATH
  // This allows compiled pantry packages (e.g., bun-plugin-stx/serve.js) to
  // import their dependencies like @stacksjs/stx at runtime
  const pantryNodePath = p.projectPath('pantry')
  const existingNodePath = process.env.NODE_PATH
  const nodePath = existingNodePath ? `${pantryNodePath}:${existingNodePath}` : pantryNodePath

  // Dev actions manage their own output (buffered banners, etc.), so inherit
  // stdout/stderr by default. Suppress with quiet (used by multi-server mode).
  const shouldInherit = options?.verbose || (isDevAction && !options?.quiet)

  const optionsWithCwd: CliOptions = {
    cwd: options?.cwd || p.projectPath(),
    ...options,
    stdout: shouldInherit ? 'inherit' : undefined,
    stderr: shouldInherit ? 'inherit' : undefined,
    env: { ...options?.env, NODE_PATH: nodePath },
  }

  const result = await runCommand(cmd, optionsWithCwd)
  log.debug(`[action] Completed: ${action}`)
  return result
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
): Promise<any> {
  if (!actions.length)
    return err('No actions were specified')

  for (const action of actions) {
    if (!hasAction(action))
      return err(`The specified action "${action}" does not exist`)
  }

  const opts = buddyOptions(options) || ''

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
