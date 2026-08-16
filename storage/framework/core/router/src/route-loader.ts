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
/**
 * The framework's default route files, as selectable bundles.
 *
 * `core` is not listed because it is not optional: it carries the locale
 * cookie and the `/locale/{code}` redirect, and bootstrap registers it
 * unconditionally.
 */
export const DEFAULT_ROUTE_BUNDLES = ['auth', 'dashboard', 'email', 'forms'] as const

/**
 * Bundles an app must ask for. Excluded from the implicit default AND from
 * `all`, because both are what an app that said nothing gets: `social` mounts
 * OAuth callback URLs, which are surface for nothing in an app that never
 * configured a provider (stacksjs/stacks#2276). Naming one in
 * `STACKS_DEFAULT_ROUTES` mounts it like any other; bootstrap additionally
 * mounts `social` on its own when a provider is actually configured, so the
 * env var is only needed to force it on or off.
 */
export const OPT_IN_ROUTE_BUNDLES = ['social'] as const

export type DefaultRouteBundle = typeof DEFAULT_ROUTE_BUNDLES[number] | typeof OPT_IN_ROUTE_BUNDLES[number]

/** Where {@link loadFrameworkRoutes} leaves the selection for bootstrap.ts. */
export const DEFAULT_ROUTE_BUNDLES_KEY = '__stacksDefaultRouteBundles'

/**
 * Which framework default route bundles this app mounts.
 *
 * `STACKS_SKIP_DEFAULT_ROUTES=1` was a single boolean over a 724-line
 * `dashboard.ts` that bundled auth, password reset, 2FA, storefront
 * cart/checkout, reviews, sitemap, AI and voice together. An app wanting
 * `/login` and 2FA without shipping `Product` or `Coupon` had exactly two
 * options: mount the commerce demo surface, or turn everything off and
 * re-declare the auth routes by hand with the rate limits copied out of
 * framework source. One reporting app took the second and permanently gave up
 * 2FA, sign-out-everywhere and API token management (stacksjs/stacks#2229).
 *
 * `STACKS_DEFAULT_ROUTES=auth` now names the bundles directly.
 *
 * ## Why bundles are not gated on `feature()`
 *
 * The issue asks for `feature('auth')` to mount the auth bundle. It cannot:
 * `feature()` treats a present config object as enabled, and `config/auth.ts`
 * ships in every scaffolded app with `enabled: true`. Gating on it would mount
 * `/login`, `/register`, `/generate-two-factor-secret`, `/logout-all` and
 * `/auth/tokens` in every app that currently runs with `dashboard` off -
 * silently widening the public surface of existing apps on upgrade. An opt-in
 * that is on by default is not an opt-in. So selection is explicit, and the
 * default is exactly what the app got before.
 *
 * Precedence: `STACKS_DEFAULT_ROUTES` wins; then the legacy
 * `STACKS_SKIP_DEFAULT_ROUTES`; then everything.
 *
 * Accepted spellings, so the two variables cannot contradict each other in a
 * surprising way:
 *   - `STACKS_DEFAULT_ROUTES=auth,email` - exactly those bundles
 *   - `STACKS_DEFAULT_ROUTES=none` (or empty) - none, same as the old `=1`
 *   - `STACKS_DEFAULT_ROUTES=all` - everything, same as the old unset
 *   - `STACKS_SKIP_DEFAULT_ROUTES=1` - none. Still supported, still documented.
 *
 * An unknown name is ignored rather than fatal: a typo should cost you the
 * bundle you misspelled, not the whole boot. `unknown` reports them so the
 * caller can warn.
 *
 * ## Actions still resolve when routes do not
 *
 * Worth knowing because it is what made the original failure confusing to
 * diagnose. Turning bundles off stops the framework's ROUTES from being
 * registered; it does not stop its ACTIONS from resolving. A handler
 * referenced by string - `route.post('/login', 'Actions/Auth/LoginAction')` -
 * is still found in `@stacksjs/defaults`, so an app can re-declare a route in
 * `routes/api.ts` and point it at a framework action it never copied into
 * `app/Actions/`. The reporting app's nine hand-written auth routes work
 * exactly this way, which is why they have no files behind them.
 */
export function resolveDefaultRouteBundles(env: NodeJS.ProcessEnv = process.env): Set<DefaultRouteBundle> {
  return resolveDefaultRouteBundlesWithDiagnostics(env).bundles
}

/**
 * {@link resolveDefaultRouteBundles} plus the names it did not recognise, and
 * whether the app named bundles at all.
 *
 * `explicit` matters because it decides who wins against the feature flags. An
 * app that wrote `STACKS_DEFAULT_ROUTES=auth` has said what it wants; the
 * `feature('dashboard')` gate must not then withhold it, or the whole point -
 * mounting auth WITHOUT the dashboard surface - is lost. When nothing is
 * named, the flags gate exactly as they did before.
 */
export function resolveDefaultRouteBundlesWithDiagnostics(
  env: NodeJS.ProcessEnv = process.env,
): { bundles: Set<DefaultRouteBundle>, unknown: string[], explicit: boolean } {
  const all = (): Set<DefaultRouteBundle> => new Set(DEFAULT_ROUTE_BUNDLES)
  const raw = env.STACKS_DEFAULT_ROUTES

  if (raw !== undefined) {
    const names = raw.split(',').map(name => name.trim().toLowerCase()).filter(Boolean)

    if (names.length === 0 || names.includes('none'))
      return { bundles: new Set(), unknown: [], explicit: true }
    if (names.includes('all'))
      return { bundles: all(), unknown: [], explicit: true }

    const bundles = new Set<DefaultRouteBundle>()
    const unknown: string[] = []
    for (const name of names) {
      if ((DEFAULT_ROUTE_BUNDLES as readonly string[]).includes(name)
        || (OPT_IN_ROUTE_BUNDLES as readonly string[]).includes(name)) {
        bundles.add(name as DefaultRouteBundle)
      }
      else {
        unknown.push(name)
      }
    }
    return { bundles, unknown, explicit: true }
  }

  // Legacy wholesale switch. Only `1` ever meant anything, and it still does.
  if (env.STACKS_SKIP_DEFAULT_ROUTES === '1')
    return { bundles: new Set(), unknown: [], explicit: true }

  return { bundles: all(), unknown: [], explicit: false }
}

async function loadFrameworkRoutes(): Promise<void> {
  const { bundles, unknown, explicit } = resolveDefaultRouteBundlesWithDiagnostics()

  for (const name of unknown)
    log.warn(`[Routes] STACKS_DEFAULT_ROUTES lists unknown bundle "${name}" — known bundles are ${DEFAULT_ROUTE_BUNDLES.join(', ')}.`)

  if (bundles.size === 0)
    return

  // Publish the selection for `defaults/bootstrap.ts`, which does the actual
  // per-bundle registration. A module-scoped export would be cleaner, but
  // bootstrap.ts is reached by dynamic import from a path this package
  // resolves at runtime, so there is no import edge to hang it on.
  ;(globalThis as Record<string, unknown>)[DEFAULT_ROUTE_BUNDLES_KEY] = { bundles, explicit }

  try {
    // The gates in bootstrap.ts call `feature()`, which reads the live config
    // proxy. Before `overridesReady` resolves that proxy holds
    // `defaultsForOverrides()`, where every feature key is a present object
    // with no `enabled` field - and `feature()` treats presence as on. So a
    // gate evaluated too early answers "enabled" for a feature the app
    // switched off. `serve/api.ts` and `dev/api.ts` already await it before
    // calling in; `buddy route:list` and the lazy first-request load in
    // `handleServerRequest` did not. Awaiting here puts the wait next to the
    // read instead of relying on every caller to remember
    // (stacksjs/stacks#2229).
    try {
      const { overridesReady } = await import('@stacksjs/config')
      await overridesReady
    }
    catch { /* config unavailable; gates fall back to framework defaults */ }

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
