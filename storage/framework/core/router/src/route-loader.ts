/**
 * Route Loader
 *
 * Loads routes from the route registry with automatic prefixing.
 * The key name becomes the URL prefix; `'web'` is the only key that
 * loads at root (`/`) without a prefix.
 *
 * The `'api'` key auto-prefixes with `/api` so user routes in
 * `routes/api.ts` line up with the rpx proxy forward path
 * (`/api/*` → API server with `stripPrefix: false`). Previously this
 * key was also in `NO_PREFIX_KEYS`, which produced silent 404s when
 * `routes/api.ts` registered `route.get('/cart/add', ...)` but the
 * proxied request arrived as `/api/cart/add` — see
 * stacksjs/stacks#1835 root cause 4.
 *
 * User routes are loaded FIRST so they always take priority over
 * framework defaults. When bun-router encounters a duplicate route
 * (same method + path), the first registration wins — so user-defined
 * routes naturally override framework routes.
 */

import type { RouteDefinition, RouteRegistry } from './route-types'
import { log } from '@stacksjs/logging'
import { route } from './stacks-router'

/**
 * Keys that load at root `/` with no prefix. Currently just `'web'`
 * for HTML/SSR routes that mount at the document root.
 *
 * `'api'` is deliberately NOT in this list (see top-of-file note).
 * It picks up the conventional `/api` prefix via the default
 * key-to-prefix mapping below.
 */
const NO_PREFIX_KEYS = ['web']

/**
 * Load all routes from the registry
 */
export async function loadRoutes(registry: RouteRegistry): Promise<void> {
  // Load user-defined routes FIRST — they take priority over framework defaults.
  // bun-router silently ignores duplicate registrations (same method + path),
  // so whichever registers first wins. This ensures users can override any
  // framework route simply by defining the same path in routes/api.ts.
  for (const [key, definition] of Object.entries(registry)) {
    const config = normalizeDefinition(definition)
    const prefix = config.prefix !== undefined
      ? (config.prefix ? (config.prefix.startsWith('/') ? config.prefix : `/${config.prefix}`) : undefined)
      : (NO_PREFIX_KEYS.includes(key) ? undefined : `/${key}`)
    const middleware = normalizeMiddleware(config.middleware)
    log.debug(`[route-loader] Loading: ${config.path} prefix=${prefix || '/'} middleware=[${middleware.join(', ')}]`)

    try {
      if (prefix || middleware.length > 0) {
        await route.group({
          prefix,
          middleware: middleware.length > 0 ? middleware : undefined,
        }, async () => {
          await importRouteFile(config.path)
        })
      }
      else {
        await importRouteFile(config.path)
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[Routes] Failed to load route file '${config.path}': ${message}`)
      throw new Error(`Route loading failed for '${config.path}': ${message}`)
    }
  }

  // Load framework default routes AFTER user routes.
  // Any route already registered by the user will cause the framework
  // version to be silently skipped, giving users full override control.
  await loadFrameworkRoutes()
}

/**
 * Load framework default routes via `storage/framework/defaults/bootstrap.ts`.
 *
 * The bootstrap file is the single source of truth for which framework
 * packages participate in route registration. It either imports each
 * package (whose own entry calls `route.register(...)` on import — the
 * service-provider pattern competing frameworks use to let packages
 * self-wire at boot) or registers routes files directly via
 * `route.register(...)`. Adding a new framework package = add a line
 * to bootstrap.ts; the loader stays untouched.
 *
 * Resolved through @stacksjs/path so the same import works whether this
 * package runs from the workspace or from `node_modules/@stacksjs/router/`.
 */
async function loadFrameworkRoutes(): Promise<void> {
  // Projects that don't use the bundled dashboard / commerce / monitoring
  // surface area can opt out of framework default route registration
  // entirely by setting `STACKS_SKIP_DEFAULT_ROUTES=1`. Without it, the
  // bootstrap imports `defaults/routes/dashboard.ts` (and friends), each
  // of which references actions that pull in models like `Product`,
  // `Coupon`, `WaitlistRestaurant`, `Error` — and projects that don't
  // ship those models flood their API boot with
  // `[Router] Failed to import action ...` lines for every missing one.
  //
  // The per-route override pattern (declare the same path first in
  // `routes/api.ts`) only scales when you want a handful of overrides;
  // for projects that want none of the bundled domain at all this gate
  // is the wholesale escape hatch. Pattern matches the existing
  // `STACKS_DEV_DASHBOARD=1` opt-in on the dev-server side.
  if (process.env.STACKS_SKIP_DEFAULT_ROUTES === '1') return
  try {
    const { frameworkPath } = await import('@stacksjs/path')
    const bootstrapPath = frameworkPath('defaults/bootstrap.ts')
    if (await Bun.file(bootstrapPath).exists()) {
      await import(bootstrapPath)
    }
  }
  catch (error) {
    // Framework bootstrap is optional — don't crash if it doesn't exist
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('Cannot find module') && !message.includes('MODULE_NOT_FOUND')) {
      console.error(`[Routes] Failed to load framework bootstrap: ${message}`)
    }
  }
}

/**
 * Validate that a route-file name can't escape the `routes/` root.
 *
 * The registry today is author-trusted, but treating it as untrusted
 * at the loader boundary costs nothing and prevents a future "let
 * users register routes" feature from turning into a path-traversal
 * vector. Mirrors `assertSafeHandlerPath` in `stacks-router.ts` so a
 * reviewer can compare the two side-by-side.
 *
 * Checks in order:
 *   1. Null bytes anywhere.
 *   2. URL-encoded characters (`%2e%2e` → `..`) — decoded BEFORE the
 *      traversal check, otherwise an attacker could hide `..` from the
 *      string-contains check by encoding it.
 *   3. Absolute paths (POSIX `/...` and Windows `C:\...`).
 *   4. `..` segments after splitting on either separator (catches
 *      `..\..\..\etc` on Windows registries).
 *
 * stacksjs/stacks#1863 (T-9).
 */
function assertSafeRouteName(routeName: string): string {
  if (typeof routeName !== 'string' || routeName.length === 0)
    throw new Error(`[route-loader] Invalid route path: empty or non-string`)
  if (routeName.includes('\0'))
    throw new Error(`[route-loader] Invalid route path: null byte`)

  let decoded: string
  try {
    decoded = decodeURIComponent(routeName)
  }
  catch {
    throw new Error(`[route-loader] Invalid route path: malformed URL encoding`)
  }

  const cleanPath = decoded.replace(/\.ts$/, '')

  if (cleanPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(cleanPath))
    throw new Error(`[route-loader] Invalid route path: absolute paths not allowed (${cleanPath})`)

  const segments = cleanPath.split(/[/\\]/)
  if (segments.some(s => s === '..'))
    throw new Error(`[route-loader] Invalid route path: '..' segment not allowed (${cleanPath})`)

  return cleanPath
}

/**
 * Import a route file from the routes directory
 */
async function importRouteFile(routeName: string): Promise<void> {
  const cleanPath = assertSafeRouteName(routeName)

  // Resolve `routes/<name>` against the project root via @stacksjs/path so
  // the import works whether this package is loaded from the workspace
  // (`storage/framework/core/router/`) or from `node_modules/@stacksjs/router/`.
  // The relative-path version `../../../../../routes/${cleanPath}` only
  // resolved correctly under the workspace layout.
  const { projectPath } = await import('@stacksjs/path')
  await import(projectPath(`routes/${cleanPath}`))
}

/**
 * Normalize route definition to object form
 */
function normalizeDefinition(def: string | RouteDefinition): RouteDefinition {
  if (typeof def === 'string') {
    return { path: def }
  }
  return def
}

/**
 * Normalize middleware to array form
 */
function normalizeMiddleware(middleware: string | string[] | undefined): string[] {
  if (!middleware) return []
  if (typeof middleware === 'string') return [middleware]
  return middleware
}
