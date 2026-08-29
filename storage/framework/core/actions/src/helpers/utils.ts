import type { Action as ActionType } from '@stacksjs/actions'
import type { Result } from '@stacksjs/error-handling'
import type { ActionOptions, CliOptions, CommandError, Subprocess } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import process from 'node:process'
import { buddyOptions, runCommand } from '@stacksjs/cli'
import { err } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'

/**
 * Augmentation target: the actions this application can run.
 *
 * Filled by `storage/framework/types/registries.d.ts` from the same name map
 * the resolver reads, so a name that typechecks is a name that resolves. Empty
 * here by design - a package cannot know an application's actions.
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface RunnableActions {}

/** An action name, as narrow as the application has made it. */
export type RunnableActionName = keyof RunnableActions extends never
  ? string
  : Extract<keyof RunnableActions, string>

/**
 * What `runAction` accepts.
 *
 * This used to be
 *
 *   type ActionPath = string // TODO: narrow this by automating its generation
 *   type ActionName = string // TODO: narrow this by automating its generation
 *   type Action = ActionPath | ActionName | string
 *
 * where all three members were `string`, so the union collapsed to `string`:
 * no name was checked and none was offered as a completion. The registry the
 * TODOs are asking for exists now, and `schedule.action()` already reads it.
 *
 * `(string & {})` rather than a bare `string` keeps the declared names as
 * completions while still admitting the paths that are legitimately dynamic -
 * `runAction('dev/views')` is a framework entry point, not an app action, and
 * a `/actions/:name` route passes one straight through. A bare `string` in the
 * union would erase the other members, which is the bug being fixed.
 */
// eslint-disable-next-line ts/ban-types -- `string & {}` keeps literal completions alive
type Action = RunnableActionName | (string & {})

export function publishedActionCandidates(action: string, packageRoot?: string): string[] {
  let root = packageRoot

  if (!root) {
    try {
      const pkgUrl = import.meta.resolve('@stacksjs/actions/package.json')
      if (pkgUrl) {
        const pkgPath = new URL(pkgUrl).pathname
        root = pkgPath.slice(0, pkgPath.lastIndexOf('/'))
      }
    }
    catch {
      return []
    }
  }

  if (!root)
    return []

  return [
    `${root}/dist/${action}.js`,
    `${root}/dist/src/${action}.js`,
    `${root}/src/${action}.ts`,
  ]
}

export function developmentConditionForProject(projectRoot: string): string {
  return existsSync(join(projectRoot, 'storage/framework/core'))
    && existsSync(join(projectRoot, 'node_modules/@stacksjs/env/src/index.ts'))
    ? '--conditions development'
    : ''
}

/**
 * Build the lookup path for action subprocesses.
 *
 * Installed application dependencies are authoritative. Pantry is a fallback
 * for compiled tools that need packages which are not installed in the app;
 * putting it first lets an old local Pantry snapshot silently shadow the
 * versions locked in node_modules during migrations and production deploys.
 */
export function actionNodePath(projectRoot: string, existingNodePath?: string): string {
  const nodeModulesPath = join(projectRoot, 'node_modules')
  const pantryPath = join(projectRoot, 'pantry')
  const paths = [nodeModulesPath]

  for (const entry of existingNodePath?.split(delimiter) ?? []) {
    if (entry && entry !== nodeModulesPath && entry !== pantryPath && !paths.includes(entry))
      paths.push(entry)
  }

  paths.push(pantryPath)
  return paths.join(delimiter)
}

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
async function resolveActionFile(action: string, projectRoot?: string): Promise<string | null> {
  const candidates: string[] = []

  // 1) User override path (legacy framework directory). `projectRoot` is set
  //    when the action runs in a different project than this process booted
  //    from (see `userActionsBase` in runAction) so its vendored core wins
  //    over the host project's.
  if (projectRoot)
    candidates.push(join(projectRoot, `storage/framework/core/actions/src/${action}.ts`))

  candidates.push(p.actionsPath(`src/${action}.ts`))

  // 2/3) Find the @stacksjs/actions package root, then look for a built
  //      action JS alongside its TS source. Wrapped in try/catch because
  //      the package may not be installed at all in some layouts.
  // The build emits a flat `dist/` (root: './src'), so `dist/<action>.js`
  // is the current layout. `dist/src/<action>.js` is kept as a fallback for
  // older published packages that shipped the nested layout.
  candidates.push(...publishedActionCandidates(action))

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
      const nodePath = actionNodePath(p.projectPath(), process.env.NODE_PATH)
      if (process.env.NODE_PATH !== nodePath) {
        process.env.NODE_PATH = nodePath
        require('module').Module._initPaths?.()
      }

      // The first two are vendored layouts. The published candidates are the
      // ones an app that runs on the installed @stacksjs packages has, and
      // without them `dev/views` resolved to nothing there: `buddy dev` still
      // started the API and docs servers, so the only symptom was a frontend
      // that never came up.
      const viewsEntries = [
        p.projectPath('storage/framework/core/actions/src/dev/views.ts'),
        p.frameworkPath('actions/src/dev/views.ts'),
        ...publishedActionCandidates('dev/views'),
      ]
      for (const entry of viewsEntries) {
        if (existsSync(entry)) {
          await import(entry)
          // eslint-disable-next-line no-unreachable
          return { ok: true, value: {} as Subprocess }
        }
      }

      return err('dev/views entry not found')
    }
    catch (error) {
      return err(`Failed to start dev server: ${error}`)
    }
  }

  // Quick check: does this look like a core action? (contains a slash or is a common core action name)
  // Most core actions are like "dev/views", "build/app", etc.
  const isLikelyCoreAction = action.includes('/') || ['dev', 'build', 'install', 'upgrade', 'migrate'].some(prefix => action.startsWith(prefix))

  // `app/Actions` of the project the action runs IN, which is not necessarily
  // the project this process booted from: `buddy new` scaffolds into a fresh
  // directory and then runs actions there via `options.cwd`. `p.userActionsPath()`
  // derives from `process.cwd()`, so without honoring the override the scan
  // below targets the host project (e.g. the directory `buddy new` was invoked
  // from, which has no `app/` at all).
  const userActionsBase = options?.cwd ? join(String(options.cwd), 'app/Actions') : p.userActionsPath()

  // Bun.Glob#scan rejects with ENOENT when `cwd` does not exist, and this call
  // site is not wrapped — an uncaught rejection kills the CLI. A project
  // without `app/Actions` simply has no user actions to match.
  if (!isLikelyCoreAction && existsSync(userActionsBase)) {
    // Only scan user actions if it's NOT likely a core action
    const glob = new Bun.Glob('**/*.{ts,js}')
    const scanOptions = { cwd: userActionsBase, onlyFiles: true, absolute: true }

    // First pass: only check filenames, don't import anything
    const matchingFiles: string[] = []
    const basePath = userActionsBase

    for await (const file of glob.scan(scanOptions)) {
      // Normalize the file path relative to basePath to match the action name
      // e.g., /path/to/app/Actions/SomeAction.ts -> SomeAction
      const relativePath = file.replace(`${basePath}/`, '').replace(/\.(ts|js)$/, '')

      if (relativePath === action || file.endsWith(`${action}.ts`) || file.endsWith(`${action}.js`)) {
        // Direct filename match - import and execute immediately
        log.debug(`[action] Resolved: ${action} → ${file}`)
        return await ((await import(file)).default as ActionType).handle(undefined as unknown as Parameters<ActionType['handle']>[0]) as unknown as Result<Subprocess, CommandError>
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
          return await a.handle() as Result<Subprocess, CommandError>
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
  const path = await resolveActionFile(action, options?.cwd ? String(options.cwd) : undefined)
  if (!path) {
    return err(`Action '${action}' not found in storage/framework/core/actions/src or @stacksjs/actions`)
  }
  log.debug(`[action] Resolved: ${action} → ${path}`)

  // STX dashboard and desktop actions own their source watcher and HMR server.
  // Wrapping them in Bun's process-level watch mode tears down the listening
  // socket on the first component edit; the re-exec then exits and leaves the
  // advertised dashboard port closed. Other dev actions still use Bun watch.
  const isDevAction = action.startsWith('dev/')
  const watchFlag = developmentWatchFlag(action)
  // Match the top-level `buddy` launcher: vendored workspace packages ship
  // source but may not have been built yet, so their `bun` export can point at
  // a missing/stale dist file. Keep the development condition on child action
  // processes instead of silently dropping it at this spawn boundary.
  const developmentCondition = developmentConditionForProject(p.projectPath())
  // Dev actions manage their own config — don't pass CLI flags that trigger dep loading
  const opts = isDevAction ? '' : (buddyOptions(options) || '')
  const cmd = ['bun', developmentCondition, watchFlag, path, opts].filter(Boolean).join(' ')

  // Ensure pantry packages are resolvable via NODE_PATH
  // This allows compiled pantry packages (e.g., bun-plugin-stx/serve.js) to
  // import their dependencies like @stacksjs/stx at runtime
  const nodePath = actionNodePath(p.projectPath(), process.env.NODE_PATH)

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

export function developmentWatchFlag(action: Action): string {
  if (!action.startsWith('dev/'))
    return ''
  return action === 'dev/dashboard' || action === 'dev/desktop' ? '' : '--watch'
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

  return await runActionSequence(actions, options)
}

export async function runActionSequence(
  actions: Action[],
  options: ActionOptions | undefined,
  runner: typeof runAction = runAction,
): Promise<any> {
  let result: any

  for (const action of actions) {
    result = await runner(action, options)
    if (result?.isErr)
      return result
  }

  return result
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
    ...publishedActionCandidates(action),
  ]

  return candidates.some(candidate => existsSync(candidate))
}
