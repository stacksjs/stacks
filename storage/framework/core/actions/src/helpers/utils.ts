import type { Action as ActionType } from '@stacksjs/actions'
import type { Result } from '@stacksjs/error-handling'
import type { ActionOptions, CliOptions, CommandError, Subprocess } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { buddyOptions, runCommand, runCommands } from '@stacksjs/cli'
import { err } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'

type ActionPath = string // TODO: narrow this by automating its generation
type ActionName = string // TODO: narrow this by automating its generation
type Action = ActionPath | ActionName | string

/**
 * Resolve a core-action name (e.g. `route/list`, `queue/status`, `dev/api`) to
 * an on-disk file path that `bun` can execute.
 *
 * Resolution order:
 *   1. `storage/framework/core/actions/src/<action>.ts` — userland override
 *      (kept first so `buddy publish:core actions` still wins).
 *   2. `@stacksjs/actions/dist/src/<action>.js` — published, minified JS.
 *      Preferred over TS source because each action invocation is its own
 *      `bun` subprocess — minified JS skips transpilation and parses faster
 *      on cold start.
 *   3. `@stacksjs/actions/src/<action>.ts` — TS source. Final fallback for
 *      installs that ship source but no dist (workspace links during
 *      framework dev).
 *
 * Returns the first candidate that exists on disk, or `null` if none do.
 *
 * Note on resolution mechanics: we first locate the package root via
 * `import.meta.resolve('@stacksjs/actions/package.json')` and then build
 * subpaths off it manually. Going through the `./*` exports map doesn't
 * work because the `bun` condition rewrites `dist/src/foo.js` to
 * `src/dist/src/foo.js` (the conditional remap happens with `*` substituted
 * into the pattern's right-hand side). Looking up the package root once
 * and joining gives us a direct on-disk path regardless of the exports
 * field shape.
 */
async function resolveActionFile(action: string): Promise<string | null> {
  const candidates: string[] = []

  // 1) User override path (legacy framework directory)
  candidates.push(p.actionsPath(`src/${action}.ts`))

  // 2/3) Find the @stacksjs/actions package root, then look for a built
  //      action JS alongside its TS source. Wrapped in try/catch because
  //      the package may not be installed at all in some layouts.
  try {
    const pkgUrl = import.meta.resolve('@stacksjs/actions/package.json')
    if (pkgUrl) {
      const pkgPath = new URL(pkgUrl).pathname
      const pkgRoot = pkgPath.slice(0, pkgPath.lastIndexOf('/'))
      candidates.push(`${pkgRoot}/dist/src/${action}.js`)
      candidates.push(`${pkgRoot}/src/${action}.ts`)
    }
  }
  catch { /* package not installed — skip, fall through to override only */ }

  for (const candidate of candidates) {
    if (await Bun.file(candidate).exists()) return candidate
  }
  return null
}

/**
 * Run an Action the Stacks way.
 *
 * @param action The action to invoke.
 * @param options The options to pass to the command.
 * @returns The result of the command.
 */
export async function runAction(action: Action, options?: ActionOptions): Promise<Result<Subprocess, CommandError>> {
  log.debug(`[action] Running: ${action}`)

  // Special case: hand off to the canonical views entry (STX i18n, /locale proxy, etc.)
  if (action === 'dev/views') {
    try {
      const pantryPath = p.projectPath('pantry')
      if (!process.env.NODE_PATH?.includes(pantryPath)) {
        process.env.NODE_PATH = process.env.NODE_PATH ? `${pantryPath}:${process.env.NODE_PATH}` : pantryPath
        require('module').Module._initPaths?.()
      }

      const viewsEntries = [
        p.projectPath('storage/framework/core/actions/src/dev/views.ts'),
        p.frameworkPath('actions/src/dev/views.ts'),
      ]
      for (const entry of viewsEntries) {
        if (existsSync(entry)) {
          await import(entry)
          // eslint-disable-next-line no-unreachable
          return { ok: true, value: {} as Subprocess } as any
        }
      }

      return err('dev/views entry not found') as any
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

  // Resolve the core action file. Three locations are tried, in order, so a
  // project can opt into shipping `storage/framework/core` (legacy / override)
  // OR rely solely on the installed `@stacksjs/actions` package:
  //
  //   1. `storage/framework/core/actions/src/<action>.ts` — userland override,
  //      same path the framework has always used. If the file exists here it
  //      always wins, so `buddy publish:core actions` keeps working.
  //   2. `node_modules/@stacksjs/actions/src/<action>.ts` — published TS source
  //      (the package's `./*` export pattern lets `bun` execute it directly).
  //   3. `node_modules/@stacksjs/actions/dist/src/<action>.js` — fallback for
  //      published builds that ship JS only.
  //
  // Bun resolves either an absolute path or a `bun .../foo.ts` arg the same
  // way, so we just pick the first existing candidate and hand it to `bun`.
  const path = await resolveActionFile(action)
  if (!path) {
    return err(`Action '${action}' not found in storage/framework/core/actions/src or @stacksjs/actions`) as any
  }
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
    // Dev server subprocesses (`bun --watch dev/*.ts`) run the bunfig preloader
    // with empty argv, so it can't tell them apart from a server boot and runs
    // the full ~800ms auto-import + package-discovery pass on EVERY server. That
    // work is redundant for the API (api.ts injects its own globals via
    // injectGlobalAutoImports) and pure waste for the frontend/docs servers,
    // which never touch models. Flag the subprocess so the preloader skips it.
    env: { ...options?.env, NODE_PATH: nodePath, ...(isDevAction ? { STACKS_DEV_SERVER: '1' } : {}) },
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
  // Use direct fs existence checks instead of globSync — node:fs.globSync
  // does NOT match literal absolute paths even when the file exists
  // (only patterns containing wildcards return matches), which silently
  // made every `runActions` chain in `release.ts` no-op for years.
  const userActionPatterns = [
    `${action}.ts`,
    `${action}`,
    `Dashboard/${action}.ts`,
    `Dashboard/${action}`,
    `Buddy/${action}.ts`,
    `Buddy/${action}`,
  ]
  const actionPatterns = [`src/${action}.ts`, `src/${action}`, `${action}.ts`, `${action}`]

  const candidates = [
    ...userActionPatterns.map(pattern => p.userActionsPath(pattern)),
    ...actionPatterns.map(pattern => p.actionsPath(pattern)),
  ]

  return candidates.some(candidate => existsSync(candidate))
}
