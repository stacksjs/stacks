import type { Action as ActionType } from '@stacksjs/actions'
import type { Result } from '@stacksjs/error-handling'
import type { ActionOptions, CliOptions, CommandError, Subprocess } from '@stacksjs/types'
import { existsSync } from 'node:fs'
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

  // Special case: handle dev/views directly for maximum performance
  if (action === 'dev/views') {
    try {
      // Ensure pantry packages are resolvable for compiled dependencies
      // that import @stacksjs/* packages at runtime
      const pantryPath = p.projectPath('pantry')
      if (!process.env.NODE_PATH?.includes(pantryPath)) {
        process.env.NODE_PATH = process.env.NODE_PATH ? `${pantryPath}:${process.env.NODE_PATH}` : pantryPath
        // force Bun/Node to re-read module paths
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
        const apiPort = Number(process.env.PORT_API) || 3008
        const apiBase = `http://127.0.0.1:${apiPort}`

        // Resolve serve(): prefer the project-vendored pantry copy so
        // framework patches dropped into pantry/ take effect even when
        // Bun's global install cache has an older bun-plugin-stx
        // version. Fall back to the standard module resolver.
        let serve: any
        try {
          ;({ serve } = await import(p.projectPath('pantry/bun-plugin-stx/dist/serve.js')))
        }
        catch {
          ;({ serve } = await import('bun-plugin-stx/serve'))
        }

        // Pre-resolve stx the same way. The pantry-vendored serve.js does
        // a bare-specifier `import('@stacksjs/stx')` — Bun walks up
        // node_modules from the importer's location, finds a stale copy
        // there before pantry, and ships it. Pass the pantry copy
        // explicitly via the `stxModule` option so layout resolution
        // (@extends('layouts/...') with layoutsDir) matches the patched
        // behaviour the rest of the framework expects.
        let stxModule: any
        try {
          const vendoredStx = p.projectPath('pantry/@stacksjs/stx/dist/index.js')
          if (await Bun.file(vendoredStx).exists())
            stxModule = await import(vendoredStx)
        }
        catch { /* fall through — serve() will resolve its own */ }

        // Cookie that signals an authenticated session. `setToken()` in
        // the SPA mirrors the bearer token here so the SSR pass can
        // gate /trips, /favorites, /host/*, /book/*, etc. without
        // every project having to ship a custom serve.ts.
        let authCookie = 'auth-token'
        try {
          const { config } = await import('@stacksjs/config')
          authCookie = (config as any)?.auth?.defaultTokenName ?? authCookie
        }
        catch { /* config not available — keep default */ }

        // Per-request cookie helper exposed on globalThis for stx
        // server-script blocks. stx-serve does not pass the raw
        // Request into template context, so anonymous-cart and
        // session-aware pages would otherwise have no way to read
        // their own cookie during SSR.
        const { AsyncLocalStorage } = await import('node:async_hooks')
        const requestStore = new AsyncLocalStorage<{ cookies: Record<string, string>, url: string }>()
        ;(globalThis as any).requestContext = {
          cookie(name: string): string | null {
            const ctx = requestStore.getStore()
            return ctx?.cookies?.[name] ?? null
          },
          url(): string {
            return requestStore.getStore()?.url ?? ''
          },
        }
        const parseCookies = (req: Request): Record<string, string> => {
          const out: Record<string, string> = {}
          const header = req.headers.get('cookie') || ''
          if (!header)
            return out
          for (const part of header.split(';')) {
            const trimmed = part.trim()
            const eq = trimmed.indexOf('=')
            if (eq === -1)
              continue
            const k = trimmed.slice(0, eq).trim()
            const v = trimmed.slice(eq + 1).trim()
            if (!k)
              continue
            try { out[k] = decodeURIComponent(v) }
            catch { out[k] = v }
          }
          return out
        }
        const proxyToApi = async (req: Request): Promise<Response> => {
          const incoming = new URL(req.url)
          const target = `${apiBase}${incoming.pathname}${incoming.search}`
          const fwd = new Headers(req.headers)
          fwd.delete('host')
          fwd.delete('content-length')
          fwd.set('x-forwarded-host', incoming.host)
          fwd.set('x-forwarded-proto', incoming.protocol.replace(':', ''))
          const body = req.method === 'GET' || req.method === 'HEAD'
            ? undefined
            : await req.arrayBuffer()
          const upstream = await fetch(target, {
            method: req.method,
            headers: fwd,
            body,
            redirect: 'manual',
          })
          const out = new Headers(upstream.headers)
          out.delete('content-length')
          out.delete('content-encoding')
          return new Response(upstream.body, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: out,
          })
        }

        // Layouts/partials live alongside views by default
        // (resources/views/layouts, resources/views/components). Older
        // scaffolds put them at resources/layouts and resources/components,
        // so we prefer the new layout when present and fall back to the
        // legacy paths otherwise.
        const firstExisting = async (candidates: [string, ...string[]]): Promise<string> => {
          for (const candidate of candidates) {
            try {
              if (await Bun.file(p.projectPath(candidate)).exists())
                return candidate
            }
            catch { /* ignore */ }
          }
          return candidates[0]
        }
        const layoutsDir = await firstExisting(['resources/views/layouts', 'resources/layouts'])
        const partialsDir = await firstExisting(['resources/views/components', 'resources/components'])

        await serve({
          patterns: ['resources/views', 'storage/framework/defaults/resources/views'],
          port,
          // Wider than the dashboard subdir so both Dashboard/* and
          // Storefront/* (and any future <Namespace>/Component.stx) get
          // resolved. stx-serve walks one subdirectory deep, so this
          // gives us discovery without enumerating every namespace.
          componentsDir: 'storage/framework/defaults/resources/components',
          layoutsDir,
          partialsDir,
          fallbackPartialsDir: 'resources/views',
          quiet: true,
          ...(stxModule && { stxModule }),
          auth: {
            cookieName: authCookie,
            redirectTo: '/login',
          },
          // /api/** → API dev server. Storefront forms posting to local
          // routes need this; without it stx-serve answers with a 404
          // page since it doesn't know about bun-router actions.
          // We also stash cookies in AsyncLocalStorage so server-script
          // blocks rendering this request can pull them via
          // globalThis.requestContext.
          onRequest: async (req: Request) => {
            const url = new URL(req.url)
            if (url.pathname.startsWith('/api/'))
              return proxyToApi(req)
            requestStore.enterWith({
              cookies: parseCookies(req),
              url: req.url,
            })
            return null
          },
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
