/**
 * Stacks Router - Extends bun-router with action/controller resolution
 *
 * This module provides a router that wraps bun-router and adds the ability
 * to use string paths like 'Actions/MyAction' or 'Controllers/MyController@method'
 */

import type { Server } from 'bun'
import type { ActionValidations, ValidationResult } from '@stacksjs/actions'
import type { ActionHandler, EnhancedRequest, Route, ServerOptions } from '@stacksjs/bun-router'
import { Middleware } from './middleware'
// Side-import the EnhancedRequest module augmentation so every `req._foo`
// and `req.input(...)` access in this file type-checks without `as any`
// (stacksjs/stacks#1863 T-3).
import './request-augmentation'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { UploadedFile } from '@stacksjs/storage'
import { applyRequestEnhancements, Router } from '@stacksjs/bun-router'
import { runWithRequest } from './request-context'
import { isApiRequest, JSON_CONTENT_TYPE } from './api-shape'
import { clearTrackedQueries, createErrorResponse, createMiddlewareErrorResponse } from './error-handler'
import { rateLimit as enforceRateLimit } from './rate-limit'
import { applySecurityHeaders } from './security-headers'

import type { StacksActionPath } from './action-paths'

type RouteHandlerFn = (_req: EnhancedRequest) => Response | Promise<Response>
type StacksHandler = string | RouteHandlerFn

interface StacksRouterConfig {
  verbose?: boolean
  apiPrefix?: string
}

interface GroupOptions {
  prefix?: string
  middleware?: string | string[]
  /**
   * When `true`, every route registered inside the group forces a JSON
   * response regardless of content negotiation — `formatResult()` skips
   * `isApiRequest()` and unconditionally returns JSON for strings,
   * primitives, `null`/`undefined`, etc. Use for `/api/*` groups that
   * should never serve HTML even if a browser navigates to them by
   * mistake. Action-level `apiResponse` still wins if set.
   */
  apiResponse?: boolean
}

type ResourceAction = 'index' | 'store' | 'show' | 'update' | 'destroy'

interface ResourceRouteOptions {
  only?: ResourceAction[]
  except?: ResourceAction[]
  middleware?: string | string[]
}

/**
 * Chainable route interface for middleware and naming support
 */
interface ChainableRoute {
  middleware: (name: string) => ChainableRoute
  name: (routeName: string) => ChainableRoute
  /**
   * Opt this route out of the default-on CSRF check.
   *
   * Use for endpoints that legitimately can't participate in
   * cookie-based CSRF (third-party webhooks, server-to-server callbacks
   * authenticated by signature). Bearer-token APIs are already exempt
   * automatically — only call `.skipCsrf()` for cookie-less endpoints
   * that aren't bearer-authenticated either.
   *
   * @example
   * ```ts
   * route.post('/webhooks/stripe', 'Actions/StripeWebhookAction').skipCsrf()
   * ```
   */
  skipCsrf: () => ChainableRoute
  /**
   * Force CSRF enforcement on this specific route, even if the underlying
   * action declares `skipCsrf: true` (or `csrf: false`). Lets a single
   * "browser-facing" route share an action with API/webhook routes that
   * legitimately want the skip — without giving up CSRF on the browser-
   * facing one. Wins over both the route-level `.skipCsrf()` and the
   * action-level skip flag. See stacksjs/stacks#1870 R-9.
   *
   * @example
   * ```ts
   * route.post('/webhooks/stripe', 'Actions/StripeWebhookAction').skipCsrf()
   * route.post('/admin/refund',    'Actions/StripeWebhookAction').requireCsrf()
   * ```
   */
  requireCsrf: () => ChainableRoute
  /**
   * Declaratively rate-limit this route (stacksjs/stacks#1870 R-8).
   * Wraps `rateLimit(routeKey, max).per(window)` so callers don't
   * have to remember to invoke it inside every action's `handle()`.
   * The bucket identity is the per-route default (auth user → token
   * → IP → 'anon'); 429s carry the standard `Retry-After`.
   *
   * @example
   * ```ts
   * route.post('/login',  'Actions/LoginAction').rateLimit(5, 'minute')
   * route.post('/search', 'Actions/SearchAction').rateLimit(30, 'minute')
   * route.post('/upload', 'Actions/UploadAction').rateLimit(3, 900) // 3 per 15 min
   * ```
   *
   * `window` accepts either a named period (`'second'`, `'minute'`,
   * `'hour'`, `'day'`) or a positive number of seconds for custom
   * windows.
   */
  rateLimit: (max: number, window: 'second' | 'minute' | 'hour' | 'day' | number) => ChainableRoute
}

/**
 * Set of route keys (`METHOD:/path`) that have explicitly opted out of
 * CSRF enforcement via `.skipCsrf()`. Lookup happens once per request
 * during the middleware-handler entry point.
 */
const csrfSkipRegistry = new Set<string>()

/**
 * Set of route keys that have explicitly opted IN to CSRF via
 * `.requireCsrf()` — used to overrule an action-level `skipCsrf: true`
 * on a per-route basis (stacksjs/stacks#1870 R-9). Wins over both the
 * route's own skip set above and the action-level cache below.
 */
const csrfRequireRegistry = new Set<string>()

/**
 * Per-route rate-limit config registered via `.rateLimit(max, window)`
 * on the chainable route builder (stacksjs/stacks#1870 R-8). The
 * `createMiddlewareHandler` request entry point reads this once per
 * call and invokes the shared `rateLimit()` primitive before the
 * action body. Storing here (instead of as part of the action
 * definition) lets two routes registered against the same action
 * apply different limits, mirroring the `.skipCsrf()` /
 * `.requireCsrf()` split.
 */
interface RouteRateLimitConfig {
  max: number
  windowSeconds: number
}
const routeRateLimitRegistry = new Map<string, RouteRateLimitConfig>()

/**
 * Resolve a chainable-form `window` arg (`'minute'` or `300`) to a
 * positive integer of seconds. Throws on malformed input at
 * registration time so the typo surfaces at boot, not on the first
 * 429.
 */
function rateLimitWindowToSeconds(window: 'second' | 'minute' | 'hour' | 'day' | number): number {
  if (typeof window === 'number') {
    if (!Number.isFinite(window) || window <= 0) {
      throw new Error(`[Router] .rateLimit(): window must be a positive number of seconds, got ${window}`)
    }
    return Math.floor(window)
  }
  switch (window) {
    case 'second': return 1
    case 'minute': return 60
    case 'hour': return 3600
    case 'day': return 86_400
    default:
      throw new Error(`[Router] .rateLimit(): unknown period '${String(window)}'`)
  }
}

/**
 * FIFO-bounded Map. Wraps `Map` with a hard size cap; on overflow,
 * the oldest entry (Map insertion order) is evicted. Used for the
 * router's small framework-internal caches whose size is normally
 * bounded by action count, but which had no upper limit before —
 * tests that instantiate many short-lived routers would leak entries
 * across `createStacksRouter()` calls (stacksjs/stacks#1863 T-8).
 *
 * Insertion-order LRU is appropriate here because the access pattern
 * is "set once at action-load time, then many reads" — refreshing on
 * get would buy nothing since reads dominate.
 */
class BoundedMap<K, V> {
  private map = new Map<K, V>()

  constructor(private readonly max: number) {}

  get(key: K): V | undefined {
    return this.map.get(key)
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  set(key: K, value: V): this {
    // If we already have the key, refreshing its insertion order by
    // delete+set means newer writes survive eviction longer.
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    return this
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}

/**
 * Decide whether a request is authorized to read `/__routes` and
 * `/__openapi.json`.
 *
 * - When `STACKS_EXPOSE_ROUTES` is unset, the endpoint is allowed only
 *   outside production (`APP_ENV`/`NODE_ENV` !== `'production'`).
 * - When set to `'1'`, behaves as above (legacy "just turn it on" flag
 *   for dev convenience).
 * - When set to any other string, that value is treated as a shared
 *   secret. The request must echo it as `X-Stacks-Routes-Token`
 *   (header) or `?token=` (query string), compared in constant time.
 *   This branch works in any environment, prod included — without it,
 *   the previous behaviour silently published the entire route table
 *   to anyone who hit the URL in a `STACKS_EXPOSE_ROUTES=1`
 *   production deployment (stacksjs/stacks#1859 R-4).
 */
function isExposeRoutesAuthorized(req: Request): boolean {
  const flag = process.env.STACKS_EXPOSE_ROUTES ?? ''
  if (!flag) {
    const env = (process.env.APP_ENV ?? '').toLowerCase()
    const isProd = env === 'production' || process.env.NODE_ENV === 'production'
    return !isProd
  }
  if (flag === '1') {
    const env = (process.env.APP_ENV ?? '').toLowerCase()
    const isProd = env === 'production' || process.env.NODE_ENV === 'production'
    return !isProd
  }

  // Token mode — flag is the required value; request must echo it.
  const url = new URL(req.url)
  const submitted = req.headers.get('x-stacks-routes-token')
    || req.headers.get('X-Stacks-Routes-Token')
    || url.searchParams.get('token')
    || ''
  if (typeof submitted !== 'string' || submitted.length === 0 || submitted.length !== flag.length) return false
  try {
    return timingSafeEqual(Buffer.from(submitted), Buffer.from(flag))
  }
  catch {
    return false
  }
}

/**
 * Apply the configured CORS policy to an outgoing response. Pulled
 * out as a helper so success-path and error-path responses both flow
 * through the same single CORS injection point — error paths used to
 * skip CORS entirely, which left browsers unable to read error bodies
 * cross-origin and forced individual middleware (Throttle 429,
 * Maintenance 503) to hand-roll `Access-Control-Allow-Origin: *`
 * regardless of policy. See stacksjs/stacks#1859 H-3, R-3.
 */
async function applyCorsIfConfigured(req: EnhancedRequest, response: Response): Promise<Response> {
  if (!req._corsConfig || !response) return response
  try {
    const { applyCorsHeaders } = await import(p.storagePath('framework/defaults/app/Middleware/Cors.ts'))
    return (applyCorsHeaders as (req: Request, res: Response, cfg?: unknown) => Response)(
      req as unknown as Request,
      response,
      req._corsConfig,
    )
  }
  catch (err) {
    log.warn('[router] CORS header injection failed', { error: err })
    return response
  }
}

/**
 * Soft cap large enough to cover any realistic app's action count
 * (Stacks framework defaults today register ~120 actions); higher
 * gives us comfortable headroom for plugin authors without enabling
 * unbounded growth in long-lived test processes.
 */
const ACTION_CACHE_MAX = 5000

/**
 * Action-level CSRF opt-out cache, keyed by the resolved handler
 * import path. Populated lazily when an action with a string handler
 * is loaded — we read `action.skipCsrf` / `action.csrf` once at
 * load time and keep the answer here so the CSRF gate doesn't have to
 * re-import the module on every request.
 */
const actionSkipsCsrfCache = new BoundedMap<string, boolean>(ACTION_CACHE_MAX)

/**
 * Map of routeKey → handler-identifier so the CSRF gate can look up
 * action-level skip flags without re-importing the action module on
 * every request. Identifier is the original string handler path
 * (`'Actions/Foo'`); for function handlers the entry stays unset.
 */
const routeHandlerKeyRegistry = new BoundedMap<string, string>(ACTION_CACHE_MAX)

/** HTTP methods that mutate state and therefore need CSRF protection. */
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Named route registry — keeps the original path plus the precomputed
 * placeholder names and a per-param replacement regex so `url()` can
 * substitute without recompiling regex on every call.
 *
 * For a site with 200 routes that each call `url()` 50× per request,
 * the previous shape was 10k regex compilations per request. Caching
 * at registration time makes each call O(params).
 */
interface NamedRoute {
  path: string
  paramNames: string[]
  /** Pre-compiled `:name(?=$|/)` regex per param, anchored to a slash boundary. */
  colonRegex: Map<string, RegExp>
}
const namedRouteRegistry = new Map<string, NamedRoute>()

function compileNamedRoute(path: string): NamedRoute {
  const paramNames = extractRouteParamNames(path)
  const colonRegex = new Map<string, RegExp>()
  for (const name of paramNames) {
    // Anchor on `/:name` and require the closing edge to be a slash or
    // end of string so `:user` doesn't accidentally match the prefix
    // of `:userId`. Replaces all occurrences globally.
    colonRegex.set(name, new RegExp(`(^|/):${name}(?=$|/)`, 'g'))
  }
  return { path, paramNames, colonRegex }
}

/**
 * Extract `{param}` and `:param` placeholder names from a route path so
 * `url()` can detect missing/typo'd args at generation time.
 *
 * The right-hand `:param` regex anchors with `(?=$|/)` to avoid the
 * prefix-match bug where `:user` would also match the leading chars
 * of `:userId` and the substitution would land inside the longer name.
 */
function extractRouteParamNames(routePath: string): string[] {
  const names = new Set<string>()
  for (const m of routePath.matchAll(/\{(\w+)\}/g)) {
    if (m[1]) names.add(m[1])
  }
  for (const m of routePath.matchAll(/(?:^|\/):(\w+)(?=$|\/)/g)) {
    if (m[1]) names.add(m[1])
  }
  return [...names]
}

/**
 * Generate a full URL for a named route, like Laravel's route() helper.
 *
 * Validates path parameters at call time so a typo'd argument
 * (`url('user.post', { userId: 1 })` against `/users/{id}`) throws
 * immediately with a list of expected names instead of silently
 * producing a URL with `{id}` left literal in the path.
 *
 * @example
 * ```typescript
 * // Define a named route
 * route.get('/api/email/unsubscribe', 'Actions/UnsubscribeAction').name('email.unsubscribe')
 *
 * // Generate URL
 * url('email.unsubscribe', { token: 'abc-123' })
 * // → https://stacksjs.com/api/email/unsubscribe?token=abc-123
 *
 * // With path parameters
 * route.get('/users/{id}/posts/{postId}', handler).name('user.post')
 * url('user.post', { id: 42, postId: 7 })
 * // → https://stacksjs.com/users/42/posts/7
 * ```
 */
export function url(routeName: string, params: Record<string, string | number> = {}): string {
  const named = namedRouteRegistry.get(routeName)
  if (!named) {
    throw new Error(`Route '${routeName}' is not defined. Available routes: ${[...namedRouteRegistry.keys()].join(', ')}`)
  }

  // Catch missing required path params before they end up as literal
  // `{id}` in the rendered URL — that bug was previously only caught
  // when the SPA tried to navigate to the bad URL.
  const missing = named.paramNames.filter(name => !(name in params) || params[name] === undefined)
  if (missing.length > 0) {
    throw new Error(
      `url('${routeName}'): missing required path param${missing.length > 1 ? 's' : ''} `
      + `[${missing.join(', ')}] for path '${named.path}'. `
      + `Pass them as the second argument: url('${routeName}', { ${named.paramNames.join(', ')} })`,
    )
  }

  let appUrl: string
  try {
    appUrl = process.env.APP_URL || 'https://localhost'
  }
  catch {
    appUrl = 'https://localhost'
  }

  appUrl = appUrl.replace(/\/$/, '')
  if (!appUrl.startsWith('http')) {
    appUrl = `https://${appUrl}`
  }

  // Substitute path parameters like {id}, {postId}, :id, :postId.
  // Curly substitution is plain string replace (faster than regex);
  // colon substitution uses the per-route precompiled regex captured
  // at registration time.
  let resolvedPath = named.path
  const queryParams: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    const curly = `{${key}}`
    if (resolvedPath.includes(curly)) {
      resolvedPath = resolvedPath.replaceAll(curly, encodeURIComponent(String(value)))
    }
    else {
      const re = named.colonRegex.get(key)
      if (re && re.test(resolvedPath)) {
        re.lastIndex = 0
        resolvedPath = resolvedPath.replace(re, `$1${encodeURIComponent(String(value))}`)
      }
      else {
        queryParams[key] = String(value)
      }
    }
  }

  const queryString = Object.keys(queryParams).length > 0
    ? `?${new URLSearchParams(queryParams).toString()}`
    : ''

  return `${appUrl}${resolvedPath}${queryString}`
}

/**
 * List the placeholder names a named route expects — handy for
 * codegen/test cases and for detecting typos before runtime.
 */
export function routeParams(routeName: string): string[] {
  const named = namedRouteRegistry.get(routeName)
  return named ? [...named.paramNames] : []
}

/**
 * Snapshot of the registered routes — `{ method, path, name? }` per
 * route. Used by `buddy route:list` and the dev-server startup banner.
 */
export function listRegisteredRoutes(): Array<{ method: string, path: string, name?: string }> {
  const out: Array<{ method: string, path: string, name?: string }> = []
  // routeMiddlewareRegistry keys look like 'METHOD:/path'. We intentionally
  // walk it (not bunRouter.routes) so this works before serve() is called.
  const seen = new Set<string>()
  for (const key of routeMiddlewareRegistry.keys()) {
    if (seen.has(key)) continue
    seen.add(key)
    const idx = key.indexOf(':')
    if (idx === -1) continue
    const method = key.slice(0, idx)
    const path = key.slice(idx + 1)
    let routeName: string | undefined
    for (const [n, named] of namedRouteRegistry.entries()) {
      if (named.path === path) { routeName = n; break }
    }
    out.push({ method, path, name: routeName })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/** Represents a middleware module with a handle method */
interface MiddlewareHandler {
  handle: (req: EnhancedRequest) => Promise<void> | void
  /**
   * Optional execution priority. Lower numbers run earlier. Defaults to
   * `DEFAULT_MIDDLEWARE_PRIORITY` (10) when unset — matches the
   * `Middleware` class default in `./middleware.ts`. The chain is sorted
   * by this field at request time so declared order can be authored
   * for readability while execution order remains coherent (CORS
   * before auth before throttle, etc.). See stacksjs/stacks#1863.
   */
  priority?: number
}

const DEFAULT_MIDDLEWARE_PRIORITY = 10

/**
 * One-time warning for middleware priorities that fail the bounds check
 * (NaN, negative, or non-numeric). Tracked per name+value so a busy chain
 * doesn't spam the log on every request.
 */
const _warnedInvalidPriorities = new Set<string>()
function warnInvalidMiddlewarePriority(name: string, raw: unknown): void {
  const key = `${name}:${String(raw)}`
  if (_warnedInvalidPriorities.has(key)) return
  _warnedInvalidPriorities.add(key)
  log.warn(
    `[Router] Middleware '${name}' declared an invalid priority (${String(raw)}). `
    + `Priorities must be a finite non-negative number; falling back to default ${DEFAULT_MIDDLEWARE_PRIORITY}.`,
  )
}

/**
 * Adapt anything the `router.use(...)` API accepts into a shape bun-router's
 * `globalMiddleware` array understands.
 *
 * The bun-router contract is `(req, next) => Promise<Response>` — middleware
 * MUST call `next()` and return its Response, or the chain short-circuits to
 * a default `200 OK` empty body. The Stacks {@link Middleware} class uses a
 * simpler "return void to continue, throw a Response/HttpError to short-
 * circuit" contract, which is incompatible at the wire level.
 *
 * Previously callers had to remember to invoke `.toRouterHandler()` manually,
 * and forgetting silently broke every route in the chain. We now detect:
 *
 *  - real `Middleware` instances (via `instanceof`)
 *  - duck-typed objects with a `handle()` method (e.g. a default-exported
 *    plain object that mimics the Middleware shape — common in user code
 *    before they reach for the class)
 *
 * and route both through the same `next()`-aware wrapper. Bare functions and
 * string paths pass through unchanged.
 *
 * See stacksjs/stacks#1870 R-2.
 */
function adaptMiddlewareForBunRouter(
  middleware: ActionHandler | Middleware | { handle: (req: EnhancedRequest) => void | Promise<void> },
): ActionHandler {
  if (middleware instanceof Middleware) {
    return middleware.toRouterHandler() as unknown as ActionHandler
  }
  // Duck-typed handler object: `{ handle(req) { … } }` without the class.
  // Function values DO have a `.handle` property only if explicitly assigned;
  // the `typeof !== 'function'` guard keeps bare functions on the pass-through
  // path so they hit bun-router's existing function branch.
  if (
    middleware
    && typeof middleware === 'object'
    && typeof (middleware as { handle?: unknown }).handle === 'function'
    && typeof middleware !== 'function'
  ) {
    const handle = (middleware as { handle: (req: EnhancedRequest) => void | Promise<void> }).handle.bind(middleware)
    const wrapper = async (req: EnhancedRequest, next: () => Promise<Response>): Promise<Response> => {
      try {
        await handle(req)
      }
      catch (thrown) {
        if (thrown instanceof Response) return thrown
        throw thrown
      }
      return next()
    }
    return wrapper as unknown as ActionHandler
  }
  return middleware as ActionHandler
}

/**
 * Cache for loaded middleware handlers
 */
const middlewareCache = new Map<string, MiddlewareHandler | null>()

/**
 * Cache for the middleware alias map (loaded once from app/Middleware.ts).
 *
 * Stored as a Promise so concurrent first-callers all await the same
 * import instead of each kicking off their own — without the promise
 * guard, 50 in-flight requests on a cold dev server can each trigger
 * the dynamic import in parallel, which Bun deduplicates eventually
 * but the redundant `if/await` overhead shows up as visible jitter.
 */
let middlewareAliasesPromise: Promise<Record<string, string>> | null = null

/**
 * Load the middleware alias map from app/Middleware.ts
 * Maps short names (e.g., 'auth') to class names (e.g., 'Auth')
 */
async function getMiddlewareAliases(): Promise<Record<string, string>> {
  if (middlewareAliasesPromise) return middlewareAliasesPromise
  middlewareAliasesPromise = (async (): Promise<Record<string, string>> => {
    try {
      const aliasModule = await import(p.appPath('Middleware.ts'))
      return aliasModule.default || {}
    }
    catch {
      try {
        const defaultModule = await import(p.storagePath('framework/defaults/app/Middleware.ts'))
        return defaultModule.default || {}
      }
      catch {
        return {}
      }
    }
  })()
  return middlewareAliasesPromise
}

/**
 * Convert a kebab-case / snake_case / lowercase identifier to PascalCase
 * for middleware class file lookup. Plain capitalize-first failed for
 * common shapes like `ensure-verified` (became `Ensure-verified` and
 * the file `app/Middleware/EnsureVerified.ts` was missed).
 *
 * Memoized + module-scoped regex: the input set is small and bounded
 * (one entry per registered middleware), so caching is essentially free
 * memory-wise but skips the split-filter-map pipeline on every request.
 */
const PASCAL_SPLIT_REGEX = /[-_\s]+/
const pascalCaseCache = new Map<string, string>()
function toPascalCase(input: string): string {
  if (!input) return input
  const cached = pascalCaseCache.get(input)
  if (cached !== undefined) return cached
  const out = input
    .split(PASCAL_SPLIT_REGEX)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  pascalCaseCache.set(input, out)
  return out
}

/**
 * Resolve a middleware alias to its class name
 * e.g., 'auth' → 'Auth', 'verified' → 'EnsureEmailIsVerified',
 *       'ensure-verified' → 'EnsureVerified'
 */
async function resolveMiddlewareName(name: string): Promise<string> {
  const aliases = await getMiddlewareAliases()
  const resolved = aliases[name] || toPascalCase(name)
  log.debug(`[middleware] Resolved: ${name} → ${resolved}`)
  return resolved
}

/**
 * Load a middleware by name
 */
async function loadMiddleware(name: string): Promise<MiddlewareHandler | null> {
  if (middlewareCache.has(name)) {
    return middlewareCache.get(name) ?? null
  }

  const className = await resolveMiddlewareName(name)

  // Try loading from app/Middleware first (user overrides)
  try {
    const userPath = p.appPath(`Middleware/${className}.ts`)
    const middleware = await import(userPath)
    const handler = middleware.default as MiddlewareHandler | null
    middlewareCache.set(name, handler)
    return handler
  }
  catch {
    // Fall back to framework defaults
    try {
      const defaultPath = p.storagePath(`framework/defaults/app/Middleware/${className}.ts`)
      const middleware = await import(defaultPath)
      const handler = middleware.default as MiddlewareHandler | null
      middlewareCache.set(name, handler)
      return handler
    }
    catch (err: unknown) {
      log.error(`[Router] Failed to load middleware '${name}' (resolved to '${className}'):`, err)
      return null
    }
  }
}

/**
 * Clear the middleware cache (useful for hot-reload in development).
 *
 * `installMiddlewareHotReload()` will wire this up automatically when
 * called from the dev server — production should never invoke it.
 */
export function clearMiddlewareCache(): void {
  middlewareCache.clear()
  middlewareAliasesPromise = null
  // Action-level CSRF skip cache + route-handler key registry are
  // populated lazily when actions load; they should be flushed in
  // lockstep with the middleware cache so a hot-reloaded action that
  // toggled its `skipCsrf` flag is re-read on the next request rather
  // than serving from a stale answer (stacksjs/stacks#1863 T-8).
  actionSkipsCsrfCache.clear()
  routeHandlerKeyRegistry.clear()
}

/**
 * Watch `app/Middleware/` and `app/Middleware.ts` and invalidate the
 * cached middleware modules whenever a file changes. Intended for the
 * dev server only — calling this in production is a no-op (the
 * watcher handle is created but never fires anything user code cares
 * about). Returns a `disposer()` to stop watching.
 *
 * Without this hook, editing a middleware file in dev requires a
 * full server restart to see the change — the import map caches the
 * old version forever.
 */
export function installMiddlewareHotReload(): () => void {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return () => { /* no-op outside dev */ }
  }
  let fsWatchers: Array<{ close: () => void }> = []
  void (async () => {
    try {
      const fs = await import('node:fs')
      const targets = [
        p.appPath('Middleware'),
        p.appPath('Middleware.ts'),
      ]
      for (const target of targets) {
        try {
          if (!fs.existsSync(target)) continue
          const w = fs.watch(target, { recursive: true }, () => {
            log.debug('[middleware] hot-reload: clearing cache')
            clearMiddlewareCache()
          })
          fsWatchers.push(w)
        }
        catch { /* file not watchable — skip */ }
      }
    }
    catch { /* node:fs not available — skip */ }
  })()
  return () => {
    for (const w of fsWatchers) {
      try { w.close() }
      catch { /* ignore */ }
    }
    fsWatchers = []
  }
}

/**
 * Registry for route middleware - maps route paths to middleware names
 */
const routeMiddlewareRegistry = new Map<string, string[]>()

/**
 * Route keys that inherited `apiResponse: true` from a `route.group({
 * apiResponse: true }, …)` declaration. Checked at request time to flip
 * `req._forceJson`, which makes `formatResult()` skip content negotiation.
 * Action-level `apiResponse` (read from the resolved Action instance) is
 * applied separately and wins over the group setting.
 */
const routeApiResponseRegistry = new Set<string>()

/**
 * Parse middleware name and parameters
 * e.g., 'abilities:read,write' -> { name: 'abilities', params: 'read,write' }
 */
function parseMiddlewareName(middleware: string): { name: string, params?: string } {
  const colonIndex = middleware.indexOf(':')
  if (colonIndex === -1) {
    return { name: middleware }
  }
  return {
    name: middleware.substring(0, colonIndex),
    params: middleware.substring(colonIndex + 1),
  }
}

/**
 * Create a wrapped handler with middleware support
 */
function createMiddlewareHandler(routeKey: string, handler: StacksHandler): RouteHandlerFn {
  // Create the base handler with skipParsing=true since we'll do it ourselves
  const wrappedBase = wrapHandler(handler, true)

  // Pre-resolve string handlers so action-level flags (skipCsrf, etc.)
  // are populated in their respective caches before the middleware
  // chain runs. Without this prefetch, the first request to a webhook
  // would inject CSRF, fail, and only the SECOND request would see the
  // populated cache and skip injection. Idempotent: subsequent
  // resolutions are served from the import cache.
  let actionPrefetch: Promise<void> | null = null
  if (typeof handler === 'string') {
    actionPrefetch = resolveStringHandler(handler).then(() => undefined).catch(() => undefined)
  }

  return async (req: EnhancedRequest) => {
    // Parse body and enhance request first. parseRequestBody can throw
    // an HttpError(400) on malformed JSON (stacksjs/stacks#1859 H-5) —
    // route that to the standard error response path instead of letting
    // it bubble out of the handler as an unhandled rejection.
    try {
      await parseRequestBody(req)
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      return createMiddlewareErrorResponse(
        error as Error & { statusCode?: number, status?: number },
        req,
      )
    }
    const enhancedReq = enhanceRequest(req)
    if (actionPrefetch) await actionPrefetch

    // Group-level apiResponse: flip `_forceJson` so `formatResult` skips
    // negotiation and always returns JSON. Action-level apiResponse is
    // applied later (inside the action wrapper) and wins by also setting
    // the same flag.
    if (routeApiResponseRegistry.has(routeKey)) {
      ;req._forceJson = true
    }

    // Run the entire request handling within the request context
    // This allows Auth and other services to access the current request
    return runWithRequest<Promise<Response>>(enhancedReq, async () => {
      // Declarative per-route rate-limit (stacksjs/stacks#1870 R-8).
      // Read once per request; routes that never called `.rateLimit()`
      // skip the call entirely. The shared limiter cache inside
      // `rate-limit.ts` keeps the bucket math coherent across requests
      // for the same `routeKey:max:window` shape.
      const rl = routeRateLimitRegistry.get(routeKey)
      if (rl) {
        try {
          await enforceRateLimit(routeKey, rl.max).over(rl.windowSeconds)
        }
        catch (err) {
          // rateLimit() throws HttpError(429) with Retry-After headers
          // already attached. Route through the shared error responder
          // so the 429 shape matches every other framework error.
          return createMiddlewareErrorResponse(
            err as Error & { statusCode?: number, status?: number, headers?: Record<string, string> },
            req,
          )
        }
      }

      const userMiddleware = routeMiddlewareRegistry.get(routeKey) || []

      // Default-on CSRF: every state-mutating method gets `csrf` injected
      // at the front of the chain unless:
      //   - the route author explicitly added `.skipCsrf()` (csrfSkipRegistry)
      //   - they already listed `csrf` themselves (don't double-run)
      //   - the resolved action exports `skipCsrf: true` / `csrf: false`
      //     (handled by stamping `_skipCsrf` on the request — the CSRF
      //     middleware itself bails when it sees that flag)
      // The bearer-token bypass and safe-method bypass live inside the
      // CSRF middleware itself, so they don't need to be re-checked here.
      const method = req.method.toUpperCase()
      const middlewareEntries: string[] = [...userMiddleware]
      const alreadyHasCsrf = userMiddleware.some(m => m === 'csrf' || m.startsWith('csrf:'))
      const routeSkipped = csrfSkipRegistry.has(routeKey)
      const routeRequired = csrfRequireRegistry.has(routeKey)
      // Check action-level cache: an action exporting `skipCsrf: true`
      // means we should NOT inject the middleware at all (rather than
      // injecting it and having it self-bail). Skipping at injection
      // time avoids the import + parse cost of csrf.ts entirely on
      // hot webhook paths.
      const handlerKey = routeHandlerKeyRegistry.get(routeKey)
      const actionSkipped = handlerKey ? actionSkipsCsrfCache.get(handlerKey) === true : false
      // Decision order (stacksjs/stacks#1870 R-9):
      //   1. `.requireCsrf()` on the route wins over EVERYTHING — used to
      //      re-enable CSRF for a browser-facing route that shares an
      //      action with API/webhook routes that legitimately skip.
      //   2. Otherwise the union of the route- and action-level skip
      //      flags decides — either one is enough to bypass.
      const shouldInjectCsrf
        = CSRF_PROTECTED_METHODS.has(method)
        && !alreadyHasCsrf
        && (routeRequired || (!routeSkipped && !actionSkipped))
      if (shouldInjectCsrf) {
        // Prepend so CSRF runs before auth/etc. — a request that fails
        // CSRF should never reach the rest of the chain.
        middlewareEntries.unshift('csrf')
      }

      if (middlewareEntries.length > 0) {
        const urlPath = new URL(req.url).pathname
        log.debug(`[middleware] Executing chain: [${middlewareEntries.join(', ')}] for ${method} ${urlPath}`)
      }

      // Pre-resolve every entry to its handler + priority. Each
      // Middleware instance declares an optional `priority` (lower
      // runs earlier, default 10); without sorting, declared order
      // alone decides execution — which contradicts the Cors header
      // contract requiring CORS to precede auth/throttle so 4xx
      // responses still carry the right headers. See
      // stacksjs/stacks#1863, #1859 (H-1).
      interface ResolvedMiddleware {
        name: string
        handler: MiddlewareHandler
        priority: number
      }
      const resolved: ResolvedMiddleware[] = []
      for (const middlewareEntry of middlewareEntries) {
        const { name: middlewareName, params } = parseMiddlewareName(middlewareEntry)

        // Store middleware params on request for middleware to access.
        // Params are keyed by middleware name so this is order-independent.
        if (params) {
          ;enhancedReq._middlewareParams = enhancedReq._middlewareParams || {}
          ;enhancedReq._middlewareParams[middlewareName] = params
        }

        const middleware = await loadMiddleware(middlewareName)
        if (!middleware || typeof middleware.handle !== 'function') continue
        // Bounds-check the priority. The chain is sorted by this number; a
        // NaN sneaks past the comparator (NaN comparisons evaluate false) and
        // misorders silently, while a negative value makes a middleware run
        // ahead of CORS/Csrf/Logger and bypasses every observability hook
        // those rely on. Clamp + warn-once so the misconfiguration is
        // visible without breaking the chain. See stacksjs/stacks#1870 R-10.
        const rawPriority = (middleware as { priority?: unknown }).priority
        let priority = DEFAULT_MIDDLEWARE_PRIORITY
        if (typeof rawPriority === 'number' && Number.isFinite(rawPriority) && rawPriority >= 0) {
          priority = rawPriority
        }
        else if (rawPriority !== undefined) {
          warnInvalidMiddlewarePriority(middlewareName, rawPriority)
        }
        resolved.push({ name: middlewareName, handler: middleware, priority })
      }

      // Stable sort — V8 + Bun guarantee Array.sort is stable since 2018,
      // so same-priority entries preserve insertion order. This keeps
      // declared sequencing within a priority band predictable.
      resolved.sort((a, b) => a.priority - b.priority)

      // Run middleware in priority order
      const middlewareTimings: Array<{ name: string, ms: number }> = []
      for (const { name: middlewareName, handler: middleware } of resolved) {
        // Per-middleware timing is appended to the request's
        // Server-Timing trail so devtools (and Chrome's network panel)
        // can show exactly which middleware spent how long. Cheap —
        // hrtime delta per layer.
        const mwStart = process.hrtime.bigint()
          try {
            // 30s middleware budget. A misbehaving middleware that hangs
            // (e.g. waits forever on a deadlocked external service) used
            // to lock the entire request handler indefinitely; the
            // timeout surfaces it as a 500 instead, freeing the worker
            // to keep serving other requests.
            const MIDDLEWARE_TIMEOUT_MS = 30_000
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Middleware '${middlewareName}' exceeded ${MIDDLEWARE_TIMEOUT_MS}ms`)), MIDDLEWARE_TIMEOUT_MS),
            )
            await Promise.race([middleware.handle(enhancedReq), timeoutPromise])
            const elapsedMs = Number(process.hrtime.bigint() - mwStart) / 1_000_000
            middlewareTimings.push({ name: middlewareName, ms: elapsedMs })
          }
          catch (error) {
            // Even on a thrown middleware, record the timing so the
            // Server-Timing header on the error response is complete.
            // Without this, an auth-rejected 401 had no per-middleware
            // timings at all — making it impossible to tell from the
            // response whether the rejection was instant or hung first.
            const elapsedMs = Number(process.hrtime.bigint() - mwStart) / 1_000_000
            middlewareTimings.push({ name: middlewareName, ms: elapsedMs })
            log.debug(`[middleware] Blocked by: ${middlewareName}`)
            // Middleware can throw a Response directly (CORS preflight,
            // Maintenance, Throttle 429, etc.) to short-circuit the chain
            // with an exact status/body. Honor that pre-built response
            // verbatim — wrapping it as Error would lose the body and
            // status entirely.
            if (error instanceof Response) {
              try {
                const reqId = enhancedReq._requestId as string | undefined
                const startNs = enhancedReq._startNs as bigint | undefined
                const total = startNs != null ? Number(process.hrtime.bigint() - startNs) / 1_000_000 : null
                const parts = total != null ? [`total;dur=${total.toFixed(1)}`] : []
                for (const t of middlewareTimings) {
                  const safeName = t.name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32)
                  parts.push(`mw_${safeName};dur=${t.ms.toFixed(1)}`)
                }
                if (parts.length > 0) error.headers.set('Server-Timing', parts.join(', '))
                if (reqId) error.headers.set('X-Request-ID', reqId)
              }
              catch { /* immutable headers — leave the response alone */ }
              return await applyCorsIfConfigured(enhancedReq, error)
            }
            const err = error instanceof Error ? error : new Error(String(error))
            // Accept both `statusCode` (Express convention) and `status`
            // (HttpError convention) so framework auth/validation throws
            // surface as 4xx instead of falling through to a 500 page.
            const errorResponse = ('statusCode' in err || 'status' in err)
              ? await createMiddlewareErrorResponse(
                  err as Error & { statusCode?: number, status?: number },
                  enhancedReq,
                )
              : await (() => {
                  log.error(`[Router] Middleware '${middlewareName}' threw an unexpected error:`, err)
                  return createErrorResponse(err, enhancedReq, { status: 500 })
                })()
            // Attach Server-Timing to the error response too — same
            // shape as the success path, so dashboards don't have to
            // special-case errored requests.
            try {
              const reqId = enhancedReq._requestId as string | undefined
              const startNs = enhancedReq._startNs as bigint | undefined
              const total = startNs != null ? Number(process.hrtime.bigint() - startNs) / 1_000_000 : null
              const parts = total != null ? [`total;dur=${total.toFixed(1)}`] : []
              for (const t of middlewareTimings) {
                const safeName = t.name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32)
                parts.push(`mw_${safeName};dur=${t.ms.toFixed(1)}`)
              }
              if (parts.length > 0) errorResponse.headers.set('Server-Timing', parts.join(', '))
              if (reqId) errorResponse.headers.set('X-Request-ID', reqId)
            }
            catch { /* immutable headers — leave the response alone */ }
            return await applyCorsIfConfigured(enhancedReq, errorResponse)
          }
      }

      // Call the actual handler with the enhanced request.
      // `let` (not `const`) because the post-action CORS wrapper below may
      // replace it with a header-mutated copy when the original Response's
      // Headers are immutable.
      let response = await wrappedBase(enhancedReq)

      // Clear tracked queries after each request to prevent accumulation
      clearTrackedQueries()

      // CSRF cookie seeding — on safe-method responses (GET/HEAD/OPTIONS),
      // attach a fresh `X-CSRF-Token` cookie when none is present so SPAs
      // and forms have a usable token to echo on the next unsafe request.
      // Without this, the default-on CSRF middleware rejected every
      // browser POST that lacked a Bearer-token bypass — the cookie was
      // read but never written. See stacksjs/stacks#1859 (CSRF
      // seeding INVESTIGATE → confirmed broken-by-default).
      if (response) {
        const safeMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
        if (safeMethod) {
          try {
            const { seedCsrfCookieIfMissing } = await import(p.storagePath('framework/defaults/app/Middleware/Csrf.ts'))
            response = (seedCsrfCookieIfMissing as (req: Request, res: Response) => Response)(
              enhancedReq as unknown as Request,
              response,
            )
          }
          catch (err) {
            log.warn('[router] CSRF cookie seeding failed', { error: err })
          }
        }
      }

      // CORS — applied BEFORE the request_id/Server-Timing rebuild path
      // so a JSON-error rewrite carries the freshly-set CORS headers
      // forward, and BEFORE compression so the resulting `Vary` value
      // can include both `Origin` and `Accept-Encoding`. The `_corsConfig`
      // marker is set by the `cors` middleware's `handle()`. Uses the
      // same `applyCorsIfConfigured` helper as the error paths above
      // so policy enforcement is consistent across all responses
      // (stacksjs/stacks#1859 H-3).
      if (response) response = await applyCorsIfConfigured(enhancedReq, response)

      // Echo X-Request-ID + Server-Timing on every response, AND stitch
      // the request_id into JSON error bodies so SPA error toasts can show
      // it (and bug reports can include it). For 4xx/5xx JSON responses
      // we rebuild the body once with `request_id` added; for 2xx/3xx we
      // only touch headers.
      const reqId = enhancedReq._requestId as string | undefined
      const startNs = enhancedReq._startNs as bigint | undefined
      const durMs = startNs != null ? Number(process.hrtime.bigint() - startNs) / 1_000_000 : null

      const setHeaders = (h: Headers) => {
        if (reqId) h.set('X-Request-ID', reqId)
        if (durMs != null) {
          const parts = [`total;dur=${durMs.toFixed(1)}`]
          // Append per-middleware timing entries. Chrome's network
          // panel shows these as a stacked timeline under the response.
          for (const t of middlewareTimings) {
            const safeName = t.name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32)
            parts.push(`mw_${safeName};dur=${t.ms.toFixed(1)}`)
          }
          h.set('Server-Timing', parts.join(', '))
        }
        applySecurityHeaders(h)
      }

      if (response && typeof (response as any).headers?.set === 'function') {
        const isErrorJson = response.status >= 400
          && (response.headers.get('content-type') || '').includes('json')

        // Inject request_id into JSON error bodies for SPA-side correlation.
        // Always overwrite — if upstream code (or a wrapped service) added
        // its own request_id field, the inner-most router is the
        // authoritative source for THIS request's id, so a stale upstream
        // value would just confuse correlation in logs.
        if (isErrorJson && reqId) {
          try {
            const text = await response.clone().text()
            const parsed = JSON.parse(text)
            if (parsed && typeof parsed === 'object') {
              const newHeaders = new Headers(response.headers)
              setHeaders(newHeaders)
              return new Response(JSON.stringify({ ...parsed, request_id: reqId }), {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
              })
            }
          }
          catch { /* malformed JSON — fall through to header-only rewrite */ }
        }

        try {
          setHeaders(response.headers)
        }
        catch {
          try {
            const cloned = response.clone()
            const newHeaders = new Headers(response.headers)
            setHeaders(newHeaders)
            return new Response(cloned.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            })
          }
          catch { /* if cloning also fails, keep the original response */ }
        }
      }

      // Compression — runs as a post-action wrapper because the middleware
      // pipeline is pre-action only. The marker stamp (`_compress`) is
      // set by the `compress` middleware's `handle()` when it's in this
      // route's chain. We import lazily so routes that don't use
      // compression don't pay the load cost.
      if (enhancedReq._compress === true && response) {
        try {
          const { applyCompression } = await import(p.storagePath('framework/defaults/app/Middleware/Compress.ts'))
          return await (applyCompression as (req: Request, res: Response) => Promise<Response>)(enhancedReq as unknown as Request, response)
        }
        catch (err) {
          // Compression failure must NEVER drop the response — log and
          // ship the uncompressed body. A broken compress step taking
          // down the request would be far worse than a missed gzip.
          log.warn(`[router] Compression failed; sending uncompressed response: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      return response
    })
  }
}

/**
 * Create a chainable route object (for .middleware() support)
 */
function createChainableRoute(routeKey: string): ChainableRoute {
  // Initialize middleware list for this route
  if (!routeMiddlewareRegistry.has(routeKey)) {
    routeMiddlewareRegistry.set(routeKey, [])
  }

  // Extract the path from routeKey (format: "METHOD:/path")
  const routePath = routeKey.includes(':') ? routeKey.substring(routeKey.indexOf(':') + 1) : routeKey

  const chain: ChainableRoute = {
    middleware(name: string) {
      const middlewareList = routeMiddlewareRegistry.get(routeKey)
      if (middlewareList) {
        middlewareList.push(name)
      }
      return chain
    },

    name(routeName: string) {
      // Pre-compile the placeholder regex once at registration time;
      // every later `url()` call reads from this cached shape.
      namedRouteRegistry.set(routeName, compileNamedRoute(routePath))
      return chain
    },

    skipCsrf() {
      // Mark this route key as exempt — the auto-CSRF gate in
      // createMiddlewareHandler reads this set before adding `csrf`
      // to the effective middleware chain.
      csrfSkipRegistry.add(routeKey)
      // Mutually exclusive with requireCsrf — last call wins so the
      // chain stays predictable rather than silently combining state.
      csrfRequireRegistry.delete(routeKey)
      return chain
    },

    requireCsrf() {
      // Mark this route key as forced-on — overrides both the route's
      // own skip set and the action-level skip cache. See
      // stacksjs/stacks#1870 R-9.
      csrfRequireRegistry.add(routeKey)
      csrfSkipRegistry.delete(routeKey)
      return chain
    },

    rateLimit(max, window) {
      // Resolve at registration time so a typo (e.g. .rateLimit(5, 'minutes'))
      // throws on boot, not on the first 429. The check is read once per
      // request in createMiddlewareHandler — registry lookup keeps the hot
      // path branch-free for routes that didn't opt in.
      if (!Number.isFinite(max) || max <= 0) {
        throw new Error(`[Router] .rateLimit(): max must be a positive number, got ${String(max)}`)
      }
      const windowSeconds = rateLimitWindowToSeconds(window)
      routeRateLimitRegistry.set(routeKey, { max: Math.floor(max), windowSeconds })
      return chain
    },
  }
  return chain
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const file = Bun.file(path)
    return await file.exists()
  }
  catch {
    return false
  }
}

/**
 * Reject handler paths that try to escape their expected root via
 * `..`/absolute paths/null bytes. Route definitions are author-trusted
 * today, but treating them as untrusted at the resolver boundary
 * costs nothing and prevents a future "let users register routes"
 * feature from turning into a path-traversal vector.
 */
function assertSafeHandlerPath(handlerPath: string): void {
  if (typeof handlerPath !== 'string' || handlerPath.length === 0) {
    throw new Error(`[Router] Refusing to resolve handler '${String(handlerPath)}': empty or non-string`)
  }
  if (handlerPath.includes('\0')) {
    throw new Error(`[Router] Refusing to resolve handler with null byte`)
  }
  if (handlerPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(handlerPath)) {
    throw new Error(`[Router] Refusing to resolve absolute handler path '${handlerPath}'`)
  }
  // Disallow `../` segments. We do allow `./` because route definitions
  // sometimes use `./Actions/Foo` style, but climbing out of `app/` is
  // never legitimate.
  const segments = handlerPath.split(/[/\\]/)
  if (segments.some(s => s === '..')) {
    throw new Error(`[Router] Refusing to resolve handler path '${handlerPath}' (contains '..' segment)`)
  }
}

// Cache `import(fullPath)` promises so two routes that point at the
// same action file share one in-flight import. Without this, registering
// the same handler in two route groups (e.g. PostIndexAction under both
// /cms and /blog) causes two parallel imports of the same module — and
// the second one races against the first's mid-evaluation state, which
// Bun surfaces as `Cannot access 'default' before initialization`.
const _moduleImportCache = new Map<string, Promise<any>>()
function cachedImport(fullPath: string): Promise<any> {
  let p = _moduleImportCache.get(fullPath)
  if (!p) {
    p = import(fullPath)
    _moduleImportCache.set(fullPath, p)
  }
  return p
}

/**
 * Resolve a string handler to an actual handler function
 * Supports user overrides: checks user's app/ first, then falls back to defaults
 */
async function resolveStringHandler(handlerPath: string): Promise<RouteHandlerFn> {
  assertSafeHandlerPath(handlerPath)
  let modulePath = handlerPath

  // Remove trailing .ts if present
  modulePath = modulePath.endsWith('.ts') ? modulePath.slice(0, -3) : modulePath

  // Handle controller-based routing (e.g., 'Controllers/MyController@method')
  if (modulePath.includes('Controller')) {
    const [controllerPath, methodName = 'index'] = modulePath.split('@')

    // Try user path first, then fall back to defaults
    const userPath = p.appPath(`${controllerPath}.ts`)
    const defaultPath = p.storagePath(`framework/defaults/app/${controllerPath}.ts`)
    const fullPath = await fileExists(userPath) ? userPath : defaultPath

    try {
      const controller = await cachedImport(fullPath)

      if (!controller.default || typeof controller.default !== 'function') {
        throw new Error(`Controller ${controllerPath} does not export a default class`)
      }

      // eslint-disable-next-line new-cap
      const instance = new controller.default()

      if (typeof instance[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)
      }

      return async (req: EnhancedRequest) => {
        const result = await instance[methodName](req)
        return formatResult(result, req)
      }
    }
    catch (error) {
      log.error(`[Router] Failed to load controller '${fullPath}':`, error)
      throw error
    }
  }

  // Handle action-based routing (e.g., 'Actions/MyAction')
  let fullPath: string

  if (modulePath.includes('storage/framework/orm')) {
    fullPath = modulePath
  }
  else if (modulePath.includes('OrmAction')) {
    fullPath = p.storagePath(`framework/actions/src/${modulePath}.ts`)
  }
  else if (modulePath.includes('Actions')) {
    // Try user path first, then fall back to defaults
    const userPath = p.projectPath(`app/${modulePath}.ts`)
    const defaultPath = p.storagePath(`framework/defaults/app/${modulePath}.ts`)
    fullPath = await fileExists(userPath) ? userPath : defaultPath
  }
  else {
    // Generic app path - try user first, then defaults
    const userPath = p.appPath(`${modulePath}.ts`)
    const defaultPath = p.storagePath(`framework/defaults/app/${modulePath}.ts`)
    fullPath = await fileExists(userPath) ? userPath : defaultPath
  }


  try {
    const actionModule = await cachedImport(fullPath)
    const action = actionModule.default

    if (!action) {
      throw new Error(`Action '${handlerPath}' has no default export`)
    }

    if (typeof action.handle !== 'function') {
      log.error(`[Router] Action '${handlerPath}' structure:`, Object.keys(action))
      throw new Error(`Action '${handlerPath}' has no handle() method. Got: ${typeof action.handle}`)
    }

    // Action-level CSRF opt-out flag. Read once at resolve time and
    // memoize against the original handler path so the CSRF gate can
    // skip lookups without re-importing the action on every request.
    // Accept both spellings: `skipCsrf: true` (intent-explicit) and
    // `csrf: false` (group-config-shaped).
    const actionSkipsCsrf = action.skipCsrf === true || action.csrf === false
    actionSkipsCsrfCache.set(handlerPath, actionSkipsCsrf)

    // Action-level apiResponse: when `true`, force JSON responses for this
    // route regardless of content negotiation. Wins over the group-level
    // flag (which `createMiddlewareHandler` already applied).
    const actionForcesJson = action.apiResponse === true

    return async (req: EnhancedRequest) => {
      if (actionSkipsCsrf) {
        ;req._skipCsrf = true
      }
      if (actionForcesJson) {
        ;req._forceJson = true
      }
      try {
        // Validate action input if validations are defined. Always returns
        // JSON — validation failures are 100% an API-shape signal and HTML
        // pages would be useless here.
        if (action.validations) {
          const validationResult = await validateActionInput(req, action.validations)
          if (!validationResult.valid) {
            // Positional status (not `{ status: 422 }`) — bun-router's
            // `Response.json` macro had a positional-only signature for a
            // while (see stacksjs/stacks#1857 for the historical bite).
            // The macro is dual-shape now, but defensive positional usage
            // keeps the validation failure path working even if a project
            // resolves to an older `@stacksjs/bun-router`.
            return Response.json(
              { error: 'Validation failed', errors: validationResult.errors },
              422,
            )
          }
        }

        // Action lifecycle hooks (stacksjs/stacks#1870 R-5).
        // `authorize` runs after validation so the handler can rely on
        // a typed, validated payload when deciding access. A literal
        // `false` short-circuits with a generic 403 (intentionally
        // opaque to avoid info-disclosure); returning a Response lets
        // the caller customise the status/body.
        if (typeof action.authorize === 'function') {
          const auth = await action.authorize(req)
          if (auth instanceof Response) return auth
          if (auth === false) {
            return Response.json({ error: 'Forbidden' }, 403)
          }
        }

        // `before` runs after authorize; returning a Response still
        // short-circuits, returning void continues into `handle()`.
        if (typeof action.before === 'function') {
          const pre = await action.before(req)
          if (pre instanceof Response) return pre
        }

        const result = await action.handle(req)
        return formatResult(result, req)
      }
      catch (handleError) {
        // Print the full stack so action failures are diagnosable.
        // The previous form passed the error as the second arg, which
        // log.error treated as `LogErrorOptions` and dropped — every
        // 500 from an action looked like an empty `[Router] Error in
        // action.handle() for 'X':` line with no detail.
        const errMsg = handleError instanceof Error
          ? (handleError.stack || handleError.message)
          : String(handleError)
        log.error(`[Router] Error in action.handle() for '${handlerPath}': ${errMsg}`)
        throw handleError
      }
    }
  }
  catch (importError) {
    log.error(`[Router] Failed to import action '${fullPath}':`, importError)
    throw importError
  }
}

// `ActionValidations` and `ValidationResult` are imported from
// `@stacksjs/actions` — they're a single source of truth, owned by the
// actions package. The previous local copies here drifted out of sync
// during the #1865 typed-request work (stacksjs/stacks#1870 R-3).

/**
 * Run an action's declarative `validations:` against the request.
 *
 * @internal Exported for regression coverage of path-param coercion
 * (stacksjs/stacks#1865). Production callers should rely on the
 * router's action-resolution path, which invokes this for you.
 */
export async function validateActionInput(req: EnhancedRequest, validations: ActionValidations): Promise<ValidationResult> {
  const errors: Record<string, string[]> = {}

  // Pass `validations` so wire-stringified path/query values get coerced
  // to the type the rule expects before they're tested. Without this,
  // `schema.number()` on a path-param `id` 422s on every request because
  // the URL delivers `"1"` not `1` and ts-validation's NumberValidator is
  // a strict `typeof value === 'number'` check. See stacksjs/stacks#1865.
  const input = await getRequestInput(req, validations)

  for (const [field, validation] of Object.entries(validations)) {
    const value = input[field]
    let result: { valid: boolean, errors?: Array<{ message: string }> }

    try {
      result = validation.rule.validate(value)
    }
    catch {
      result = { valid: false, errors: [{ message: `${field} validation failed` }] }
    }

    if (!result.valid) {
      const fieldErrors: string[] = []
      // Friendlier label: snake_case → "snake case", camelCase → "camel case",
      // capitalized so messages read naturally (`"Email is invalid"` rather
      // than the bare `"is invalid"` clients used to receive).
      const label = field
        .replace(/[-_]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, c => c.toUpperCase())
      const decorate = (msg: string): string => (msg.toLowerCase().startsWith(field.toLowerCase()) || msg.includes(label))
        ? msg
        : `${label} ${msg}`

      if (result.errors && result.errors.length > 0) {
        // Use custom message if provided, otherwise decorate the
        // validator's bare message with the field label.
        if (validation.message) {
          const firstMessage = result.errors[0]?.message ?? ''
          fieldErrors.push(typeof validation.message === 'string' ? validation.message : validation.message[field] || decorate(firstMessage))
        }
        else {
          result.errors.forEach(err => fieldErrors.push(decorate(err.message)))
        }
      }
      else {
        fieldErrors.push(validation.message ? (typeof validation.message === 'string' ? validation.message : `${label} is invalid`) : `${label} is invalid`)
      }

      errors[field] = fieldErrors
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Get all input data from request (body + query params + path params).
 *
 * When `validations` is supplied, any string-valued field whose rule
 * expects a non-string primitive (number / boolean) is coerced before
 * validation runs. Wire formats deliver path and query params as
 * strings even when they "look like" numbers, and ts-validation's
 * `NumberValidator`/`BooleanValidator` are strict `typeof` checks —
 * without this coercion, `schema.number()` on a path-param id 422s on
 * every request. Body fields are left untouched because the JSON
 * parser already gave them their proper JS types
 * (see stacksjs/stacks#1865).
 */
async function getRequestInput(
  req: EnhancedRequest,
  validations?: ActionValidations,
): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {}

  // Get query parameters (always strings on the wire)
  const url = new URL(req.url)
  url.searchParams.forEach((value, key) => {
    input[key] = value
  })

  // Get route params if available (also strings — bun-router doesn't
  // know the route-pattern type)
  if (req.params) {
    Object.assign(input, req.params)
  }

  // Use already-parsed body (from parseRequestBody) if available
  if (req.jsonBody && typeof req.jsonBody === 'object') {
    Object.assign(input, req.jsonBody)
  }
  else if (req.formBody && typeof req.formBody === 'object') {
    Object.assign(input, req.formBody)
  }

  // Merge multipart files so file-shaped validations
  // (`schema.file().image().maxBytes(...)`) see the `UploadedFile`
  // instance under its field name. Body wins on collision — text
  // fields and file uploads sharing a name is a pathological case the
  // caller should disambiguate, and silently overwriting the body
  // value with the file would be more surprising than the reverse.
  // (stacksjs/stacks#1856)
  if (typeof req.allFiles === 'function') {
    try {
      const files = req.allFiles() as Record<string, unknown>
      for (const key of Object.keys(files ?? {})) {
        if (!(key in input)) input[key] = files[key]
      }
    }
    catch {
      // allFiles() reads parsed multipart state — if parsing failed,
      // skip file merge rather than fail the whole validation pass.
    }
  }

  if (!validations)
    return input

  // Coerce string values when the rule expects a non-string primitive.
  // Path/query params are always strings on the wire; body-sourced
  // values were already typed by the JSON parser, so `typeof value !==
  // 'string'` skips them naturally. Form-body fields are still strings
  // (multipart wire format) — same code path covers them.
  for (const [field, validation] of Object.entries(validations)) {
    const value = input[field]
    if (typeof value !== 'string') continue

    const validatorName = (validation.rule as { name?: string })?.name
    if (validatorName === 'number') {
      // `Number.isFinite()` guard so malformed inputs (`"abc"`,
      // `"NaN"`, `"Infinity"`) stay as strings — the validator then
      // emits its natural "Must be a number" error rather than us
      // swallowing the bad value as 0.
      const n = Number(value)
      if (Number.isFinite(n))
        input[field] = n
    }
    else if (validatorName === 'boolean') {
      if (value === 'true' || value === '1') input[field] = true
      else if (value === 'false' || value === '0') input[field] = false
    }
  }

  return input
}

/**
 * Format an action's return value into a Response.
 *
 * JSON-first: any caller that looks like an API client (per
 * `isApiRequest()`) gets JSON for every shape — primitives become
 * JSON-encoded scalars, `null`/`undefined` becomes `204 No Content`. Only
 * top-level browser navigations fall back to `text/plain` / empty 200,
 * keeping the obvious dev-mode "open this URL in a browser" path readable.
 *
 * Forced override: when an Action or route group sets `apiResponse: true`,
 * the resolver flips `req._forceJson` and we skip the negotiation. Useful
 * for endpoints that should never serve HTML even if a browser navigates
 * to them by mistake.
 */
function formatResult(result: unknown, req: EnhancedRequest): Response {
  if (result instanceof Response) {
    return result
  }

  // Streaming returns: an action that yields a `ReadableStream` (or an
  // async generator wrapped via `stream(...)`) gets piped straight back
  // to the client. Use `application/octet-stream` as a neutral default;
  // SSE / chunked-JSON callers should reach for the `stream(...)` helper
  // which sets the right Content-Type. The router preserves the stream
  // verbatim — no buffering, no Content-Length precomputation — so
  // backpressure and cancellation propagate end-to-end.
  // See stacksjs/stacks#1870 R-4.
  if (result instanceof ReadableStream) {
    return new Response(result, {
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  }

  const forceJson = req._forceJson === true
  const apiShaped = forceJson || isApiRequest(req as unknown as Request)

  // Null / undefined → 204 No Content for API requests; empty 200 for the
  // browser-nav case (returning a literal `'null'` string was a bug; the
  // old behaviour serialized it as text/plain).
  if (result === null || result === undefined) {
    return apiShaped
      ? new Response(null, { status: 204 })
      : new Response('', { status: 200 })
  }

  // Objects + arrays always serialize as JSON regardless of negotiation —
  // there's no reasonable HTML representation of `{id: 1}`, and userland
  // that wants HTML should return a `new Response(html, …)` directly.
  if (typeof result === 'object') {
    return Response.json(result)
  }

  // Primitives: JSON-encode for API requests so a string return lands as
  // `"ok"` with `application/json`, not `ok` with `text/plain`.
  if (apiShaped) {
    return Response.json(result)
  }

  return new Response(String(result), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/**
 * Helper for streaming responses — wraps a `ReadableStream` or async
 * generator with the right headers for the chosen content type.
 *
 * Common shapes:
 *
 *   ```ts
 *   // Server-Sent Events
 *   return stream(async function* () {
 *     for await (const evt of source) yield `data: ${JSON.stringify(evt)}\n\n`
 *   }, { type: 'sse' })
 *
 *   // Chunked JSON (NDJSON) — one JSON object per line
 *   return stream(async function* () {
 *     for await (const row of rows) yield `${JSON.stringify(row)}\n`
 *   }, { type: 'ndjson' })
 *
 *   // Raw bytes — caller supplies a ReadableStream of Uint8Array chunks
 *   return stream(myReadable, { contentType: 'application/octet-stream' })
 *   ```
 *
 * The wrapper sets `Cache-Control: no-cache` and `Connection: keep-alive`
 * for SSE — the two headers a sane proxy / browser pair won't ignore — and
 * leaves backpressure / cancellation to the underlying stream.
 *
 * See stacksjs/stacks#1870 R-4.
 */
export interface StreamOptions {
  /**
   * Preset for common stream shapes. `'sse'` sets
   * `text/event-stream` + no-cache + keep-alive. `'ndjson'` sets
   * `application/x-ndjson`. Falls back to `contentType` (or
   * `application/octet-stream`) when omitted.
   */
  type?: 'sse' | 'ndjson'
  /** Explicit Content-Type, ignored when `type` is set. */
  contentType?: string
  /** Extra headers merged after the preset. Last wins. */
  headers?: HeadersInit
  /** HTTP status, defaults to 200. */
  status?: number
}

export function stream(
  source: ReadableStream | AsyncIterable<string | Uint8Array>,
  options: StreamOptions = {},
): Response {
  const baseHeaders: Record<string, string> = {}
  if (options.type === 'sse') {
    baseHeaders['Content-Type'] = 'text/event-stream; charset=utf-8'
    baseHeaders['Cache-Control'] = 'no-cache'
    baseHeaders['Connection'] = 'keep-alive'
  }
  else if (options.type === 'ndjson') {
    baseHeaders['Content-Type'] = 'application/x-ndjson; charset=utf-8'
  }
  else {
    baseHeaders['Content-Type'] = options.contentType ?? 'application/octet-stream'
  }

  // Async-iterable (incl. generator) → ReadableStream. Generators don't
  // expose backpressure natively, so chunks are pulled one at a time —
  // good for low-throughput SSE; for high-throughput byte streams the
  // caller should hand us a real ReadableStream.
  const body: ReadableStream = source instanceof ReadableStream
    ? source
    : new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of source) {
              controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
            }
            controller.close()
          }
          catch (err) {
            controller.error(err)
          }
        },
      })

  const merged = new Headers(baseHeaders)
  if (options.headers) {
    const extra = new Headers(options.headers)
    extra.forEach((value, key) => merged.set(key, value))
  }
  return new Response(body, { status: options.status ?? 200, headers: merged })
}

// Decorate the incoming request with the helpers the framework's middleware
// and actions assume are always available. Names follow Laravel's convention
// because that's the API surface Stacks userland expects.
export function enhanceRequest(req: EnhancedRequest): EnhancedRequest {
  applyRequestEnhancements(req as unknown as Request, req.params || {})

  // Parse query string if not present
  let query = req.query
  if (!query) {
    const url = new URL(req.url)
    query = {} as Record<string, string>
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })
    ;req.query = query
  }

  // Cached input data — computed once on first access
  let cachedInput: Record<string, unknown> | null = null

  const getAllInput = (): Record<string, unknown> => {
    if (cachedInput) return cachedInput

    const input: Record<string, unknown> = {}

    // Query parameters
    for (const [key, value] of Object.entries(query || {})) {
      input[key] = value
    }

    // JSON body
    if (req.jsonBody && typeof req.jsonBody === 'object') {
      for (const [key, value] of Object.entries(req.jsonBody)) {
        input[key] = value
      }
    }

    // Form body
    if (req.formBody && typeof req.formBody === 'object') {
      for (const [key, value] of Object.entries(req.formBody)) {
        input[key] = value
      }
    }

    // Route params
    if (req.params && typeof req.params === 'object') {
      for (const [key, value] of Object.entries(req.params)) {
        input[key] = value
      }
    }

    cachedInput = input
    return input
  }

  // Add Laravel-style methods
  ;req.get = <T = any>(key: string, defaultValue?: T): T => {
    const input = getAllInput()
    const value = input[key]
    return (value !== undefined ? value : defaultValue) as T
  }

  ;req.input = <T = any>(key: string, defaultValue?: T): T => {
    const input = getAllInput()
    const value = input[key]
    return (value !== undefined ? value : defaultValue) as T
  }

  ;req.all = (): Record<string, unknown> => getAllInput()

  ;req.only = <T extends Record<string, unknown>>(keys: string[]): T => {
    const input = getAllInput()
    const result = {} as T
    for (const key of keys) {
      if (key in input) {
        (result as any)[key] = input[key]
      }
    }
    return result
  }

  ;req.except = <T extends Record<string, unknown>>(keys: string[]): T => {
    const input = getAllInput()
    const result = { ...input } as T
    for (const key of keys) {
      delete (result as any)[key]
    }
    return result
  }

  ;req.has = (key: string | string[]): boolean => {
    const input = getAllInput()
    if (Array.isArray(key)) {
      return key.every(k => k in input && input[k] !== undefined)
    }
    return key in input && input[key] !== undefined
  }

  ;req.hasAny = (keys: string[]): boolean => {
    const input = getAllInput()
    return keys.some(k => k in input && input[k] !== undefined)
  }

  ;req.filled = (key: string | string[]): boolean => {
    const input = getAllInput()
    const isFilled = (k: string): boolean => {
      const value = input[k]
      return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
    }
    if (Array.isArray(key)) {
      return key.every(isFilled)
    }
    return isFilled(key)
  }

  ;req.missing = (key: string | string[]): boolean => {
    const input = getAllInput()
    if (Array.isArray(key)) {
      return key.every(k => !(k in input) || input[k] === undefined)
    }
    return !(key in input) || input[key] === undefined
  }

  ;req.string = (key: string, defaultValue: string = ''): string => {
    const input = getAllInput()
    const value = input[key]
    return value !== undefined && value !== null ? String(value) : defaultValue
  }

  // Strict numeric parsing: `Number.parseInt('123abc')` returns 123 silently,
  // which lets callers accept partial numeric input they didn't intend
  // (e.g. pagination size gets set to the leading digits of a typo'd query
  // param). We require the entire string to be a valid number — any trailing
  // garbage falls through to `defaultValue`.
  ;req.integer = (key: string, defaultValue: number = 0): number => {
    const input = getAllInput()
    const value = input[key]
    if (value === undefined || value === null || value === '') return defaultValue
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : defaultValue
    const str = String(value).trim()
    if (!/^-?\d+$/.test(str)) return defaultValue
    const parsed = Number.parseInt(str, 10)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  ;req.float = (key: string, defaultValue: number = 0): number => {
    const input = getAllInput()
    const value = input[key]
    if (value === undefined || value === null || value === '') return defaultValue
    if (typeof value === 'number') return Number.isFinite(value) ? value : defaultValue
    const str = String(value).trim()
    if (!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(str)) return defaultValue
    const parsed = Number.parseFloat(str)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  ;req.boolean = (key: string, defaultValue: boolean = false): boolean => {
    const input = getAllInput()
    const value = input[key]
    if (value === undefined || value === null) return defaultValue
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === '1' || value === 1) return true
    if (value === 'false' || value === '0' || value === 0) return false
    return defaultValue
  }

  ;req.array = <T = unknown>(key: string): T[] => {
    const input = getAllInput()
    const value = input[key]
    if (Array.isArray(value)) return value as T[]
    return value !== undefined && value !== null ? [value as T] : []
  }

  // File handling methods - returns UploadedFile with store/storeAs methods
  ;req.file = (key: string): UploadedFile | null => {
    const files = req.files || {}
    const file = files[key]
    if (!file) return null
    const rawFile = Array.isArray(file) ? file[0] : file
    return rawFile ? new UploadedFile(rawFile) : null
  }

  ;req.getFiles = (key: string): UploadedFile[] => {
    const files = req.files || {}
    const file = files[key]
    if (!file) return []
    const fileArray = Array.isArray(file) ? file : [file]
    return fileArray.map(f => new UploadedFile(f))
  }

  ;req.hasFile = (key: string): boolean => {
    const files = req.files || {}
    return key in files && files[key] !== undefined
  }

  ;req.allFiles = (): Record<string, UploadedFile | UploadedFile[]> => {
    const files = req.files || {}
    const result: Record<string, UploadedFile | UploadedFile[]> = {}
    for (const [key, value] of Object.entries(files)) {
      if (Array.isArray(value)) {
        result[key] = value.map(f => new UploadedFile(f as File))
      } else {
        result[key] = new UploadedFile(value as File)
      }
    }
    return result
  }

  // Auth method - returns the authenticated user set by middleware
  ;req.user = async (): Promise<any> => {
    // Return user set by auth middleware (e.g., BearerToken middleware)
    return req._authenticatedUser
  }

  // Get the current access token instance
  ;req.userToken = async (): Promise<any> => {
    return req._currentAccessToken
  }

  // Check if the current token has an ability.
  // Strict: a missing token, a token without an `abilities` array, or
  // a non-string ability all fail-closed. Earlier shape did
  // `token.abilities?.includes('*')` which silently accepted any object
  // with a truthy `abilities[Symbol.iterator]` — a malformed token
  // produced by a partially-completed auth race could grant wildcard
  // permissions because of how `?.includes` resolves on non-arrays.
  ;req.tokenCan = async (ability: string): Promise<boolean> => {
    if (typeof ability !== 'string' || ability.length === 0) return false
    const token = req._currentAccessToken
    if (!token || typeof token !== 'object') return false
    if (!Array.isArray(token.abilities)) return false
    if (token.abilities.includes('*')) return true
    return token.abilities.includes(ability)
  }

  // Check if the current token does NOT have an ability
  ;req.tokenCant = async (ability: string): Promise<boolean> => {
    return !(await req.tokenCan(ability))
  }

  // Gate / Policy macros (stacksjs/stacks#1874 F-9). Lazy-import
  // `@stacksjs/auth` to dodge the router←auth cycle declared in
  // `auth/package.json`. Resolve the user from `_authenticatedUser`
  // (stamped by the Auth middleware) — passing `null` when missing so
  // gates that explicitly handle the unauthenticated case still get a
  // chance to allow (e.g. public-read policies).
  ;req.can = async (ability: string, ...args: unknown[]): Promise<boolean> => {
    if (typeof ability !== 'string' || ability.length === 0) return false
    const { Gate } = await import('@stacksjs/auth')
    const user = (req._authenticatedUser as Parameters<typeof Gate.allows>[1]) ?? null
    return Gate.allows(ability, user, ...args)
  }

  ;req.cannot = async (ability: string, ...args: unknown[]): Promise<boolean> => {
    return !(await req.can(ability, ...args))
  }

  // Throw-on-deny variant (Laravel's `$this->authorize(...)`). Reuses
  // the same Gate path so policy `before()` / `after()` hooks fire
  // consistently regardless of which macro the caller picks. Throws
  // `AuthorizationException` (status 403) on deny — handlers can let
  // it bubble to the global error handler or catch and reshape.
  ;req.authorize = async (ability: string, ...args: unknown[]): Promise<void> => {
    const { Gate } = await import('@stacksjs/auth')
    const user = (req._authenticatedUser as Parameters<typeof Gate.authorize>[1]) ?? null
    await Gate.authorize(ability, user, ...args)
  }

  return req
}

function wrapHandler(handler: StacksHandler, skipParsing = false): RouteHandlerFn {
  if (typeof handler === 'string') {
    const handlerPath = handler // capture for error messages
    return async (req: EnhancedRequest) => {
      try {
        // Skip parsing if already done (e.g., by createMiddlewareHandler)
        if (!skipParsing) {
          // Parse JSON body BEFORE enhancing with Laravel methods
          await parseRequestBody(req)

          // Enhance request with Laravel-style methods
          req = enhanceRequest(req)
        }

        const resolvedHandler = await resolveStringHandler(handlerPath)
        // Must await to catch async errors in try-catch
        return await resolvedHandler(req)
      }
      catch (error) {
        log.error(`[Router] Error handling request for '${handlerPath}':`, error)
        // Return Ignition-style error page in development, JSON in production
        return await createErrorResponse(
          error instanceof Error ? error : new Error(String(error)),
          req,
          { handlerPath },
        )
      }
    }
  }
  // Inline function handler. Route the return value through
  // `formatResult` so a `() => 'ok'` handler gets the same JSON-first
  // negotiation as a string-resolved action — same null → 204, same
  // primitive → JSON-encoded scalar, same Response passthrough.
  // Without this wrapper, function handlers would return strings to
  // bun-router and end up as `text/plain` regardless of the client.
  const fn = handler as RouteHandlerFn
  return async (req: EnhancedRequest) => {
    const result = await fn(req)
    return formatResult(result as unknown, req)
  }
}

/**
 * Parse request body and attach to request object
 */
async function parseRequestBody(req: EnhancedRequest): Promise<void> {
  // Skip if body was already parsed (avoid double-parsing)
  if (req._bodyParsed) return
  ;req._bodyParsed = true

  const contentType = req.headers.get('content-type') || ''

  try {
    // Clone once up front — only the branch that matches content-type will use it
    if (JSON_CONTENT_TYPE.test(contentType)) {
      // Empty body on a JSON-typed POST is common (clients sending only
      // query/path params). Land as `{}` so `request.get('x')` returns
      // undefined instead of throwing, and validation reports the missing
      // field cleanly. **Malformed** JSON used to collapse to `{}` too,
      // which let bad-shape bodies bypass action validation when the
      // action didn't declare schemas for every field (e.g. truncated
      // JSON sent by an attacker). Now: a parse error throws a 400 so
      // the middleware chain returns a proper "Invalid JSON body"
      // response. Empty body is still allowed (Content-Length: 0 →
      // empty string → no parse attempt). See stacksjs/stacks#1859 H-5.
      const cloned = req.clone()
      const raw = await cloned.text()
      if (raw.length === 0) {
        ;req.jsonBody = {}
      }
      else {
        try {
          const body = JSON.parse(raw)
          ;req.jsonBody = body && typeof body === 'object' ? body : {}
        }
        catch (parseErr) {
          const message = parseErr instanceof Error ? parseErr.message : 'Invalid JSON'
          const { HttpError } = await import('@stacksjs/error-handling')
          throw new HttpError(400, `Invalid JSON body: ${message}`)
        }
      }
    }
    else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.clone().text()
      const params = new URLSearchParams(text)
      const formBody: Record<string, string> = {}
      params.forEach((value, key) => {
        formBody[key] = value
      })
      ;req.formBody = formBody
    }
    else if (contentType.includes('multipart/form-data')) {
      const formData = await req.clone().formData()
      const formBody: Record<string, unknown> = {}
      const files: Record<string, File | File[]> = {}

      formData.forEach((value, key) => {
        if (value instanceof File) {
          if (files[key]) {
            if (Array.isArray(files[key])) {
              (files[key] as File[]).push(value)
            }
            else {
              files[key] = [files[key] as File, value]
            }
          }
          else {
            files[key] = value
          }
        }
        else {
          formBody[key] = value
        }
      })

      ;req.formBody = formBody
      ;req.files = files
    }
  }
  catch (e) {
    // HttpError thrown by the malformed-JSON path is an intentional
    // signal — let it propagate so the handler wrapper can turn it
    // into a 400 response. Everything else is best-effort body
    // parsing (e.g. multipart with weird shape) where falling
    // through to a `{}` body keeps the request alive for the
    // action / validator to surface a clearer error.
    const status = (e as { status?: number, statusCode?: number })?.status
      ?? (e as { status?: number, statusCode?: number })?.statusCode
    if (typeof status === 'number') throw e
    log.debug('[stacks-router] Body parsing failed:', e)
  }
}

/**
 * Create a Stacks-enhanced router
 */
export function createStacksRouter(config: StacksRouterConfig = {}): StacksRouterInstance {
  const bunRouter = new Router({
    verbose: config.verbose ?? false,
  })

  let currentPrefix = ''
  let currentGroupMiddleware: string[] = []
  let currentGroupApiResponse = false

  // Helper to register a route with group middleware applied
  function registerRoute(method: string, path: string, _handler: StacksHandler) {
    const fullPath = currentPrefix + path
    const routeKey = `${method}:${fullPath}`
    log.debug(`[router] ${method} ${fullPath} → ${typeof _handler === 'string' ? _handler : 'function'}`)

    // Pre-populate middleware registry with group middleware
    if (currentGroupMiddleware.length > 0) {
      routeMiddlewareRegistry.set(routeKey, [...currentGroupMiddleware])
    }

    // Pre-populate apiResponse registry with the group flag so the request
    // handler can flip `req._forceJson` without re-walking the group stack.
    if (currentGroupApiResponse) {
      routeApiResponseRegistry.add(routeKey)
    }

    // Track string handlers so the CSRF gate can look up action-level
    // skipCsrf flags without re-importing on every request.
    if (typeof _handler === 'string') {
      routeHandlerKeyRegistry.set(routeKey, _handler)
    }

    return { fullPath, routeKey }
  }

  const stacksRouter: StacksRouterInstance = {
    // Access underlying bun-router
    bunRouter,

    // Get all routes
    get routes(): Route[] {
      return bunRouter.routes
    },

    // HTTP methods with string handler support
    get(path: string, handler: StacksHandler) {
      const { fullPath, routeKey } = registerRoute('GET', path, handler)
      bunRouter.get(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    post(path: string, handler: StacksHandler) {
      const { fullPath, routeKey } = registerRoute('POST', path, handler)
      bunRouter.post(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    put(path: string, handler: StacksHandler) {
      const { fullPath, routeKey } = registerRoute('PUT', path, handler)
      bunRouter.put(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    patch(path: string, handler: StacksHandler) {
      const { fullPath, routeKey } = registerRoute('PATCH', path, handler)
      bunRouter.patch(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    delete(path: string, handler: StacksHandler) {
      const { fullPath, routeKey } = registerRoute('DELETE', path, handler)
      bunRouter.delete(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    options(path: string, handler: StacksHandler) {
      const { fullPath, routeKey } = registerRoute('OPTIONS', path, handler)
      bunRouter.options(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    // Route grouping with prefix and middleware support
    group(options: GroupOptions, callback: () => void | Promise<void>): StacksRouterInstance | Promise<StacksRouterInstance> {
      const previousPrefix = currentPrefix
      const previousMiddleware = [...currentGroupMiddleware]
      const previousApiResponse = currentGroupApiResponse

      // Apply prefix
      if (options.prefix) {
        currentPrefix = previousPrefix + options.prefix
      }

      // Apply middleware (can be string or array)
      const middlewareList = options.middleware
        ? (Array.isArray(options.middleware) ? options.middleware : [options.middleware])
        : undefined
      if (middlewareList) {
        currentGroupMiddleware = [...currentGroupMiddleware, ...middlewareList]
      }

      // Inherit apiResponse from the enclosing group; an inner `false`
      // cannot un-force JSON once an outer group opted in (groups stack
      // additively, same as middleware).
      if (options.apiResponse === true) {
        currentGroupApiResponse = true
      }

      log.debug(`[router] Entering group: prefix=${options.prefix || '/'} middleware=[${middlewareList?.join(', ') || ''}]${currentGroupApiResponse ? ' apiResponse=true' : ''}`)

      // Call the callback
      const result = callback()

      // For async callbacks that need to import files, we need to wait
      // But for regular async callbacks (with sync route registrations inside),
      // we restore immediately since routes are registered synchronously
      if (result instanceof Promise) {
        // Check if this is a dynamic import scenario (route-loader)
        // by returning a promise that properly waits
        return result.then(() => {
          currentPrefix = previousPrefix
          currentGroupMiddleware = previousMiddleware
          currentGroupApiResponse = previousApiResponse
          return stacksRouter
        }).catch((err) => {
          currentPrefix = previousPrefix
          currentGroupMiddleware = previousMiddleware
          currentGroupApiResponse = previousApiResponse
          throw err
        })
      }

      // Sync callback - restore state immediately
      currentPrefix = previousPrefix
      currentGroupMiddleware = previousMiddleware
      currentGroupApiResponse = previousApiResponse
      return stacksRouter
    },

    // Resource route helper - generates standard CRUD routes like Laravel's Route::resource()
    resource(name: string, handler: string, options?: ResourceRouteOptions) {
      const actions: ResourceAction[] = ['index', 'store', 'show', 'update', 'destroy']

      const activeActions = options?.only
        ? actions.filter(a => options.only!.includes(a))
        : options?.except
          ? actions.filter(a => !options.except!.includes(a))
          : actions

      const handlerBase = handler.replace(/Action$/, '')
      log.debug(`[router] Resource: /${name} → ${handler} [${activeActions.join(', ')}]`)

      const registerResourceRoutes = () => {
        for (const action of activeActions) {
          switch (action) {
            case 'index':
              stacksRouter.get(`/${name}`, `${handlerBase}IndexAction`)
              break
            case 'store':
              stacksRouter.post(`/${name}`, `${handlerBase}StoreAction`)
              break
            case 'show':
              stacksRouter.get(`/${name}/:id`, `${handlerBase}ShowAction`)
              break
            case 'update':
              stacksRouter.put(`/${name}/:id`, `${handlerBase}UpdateAction`)
              break
            case 'destroy':
              stacksRouter.delete(`/${name}/:id`, `${handlerBase}DestroyAction`)
              break
          }
        }
      }

      // Wrap resource routes in a group if middleware is specified
      if (options?.middleware) {
        stacksRouter.group({ middleware: options.middleware }, registerResourceRoutes)
      }
      else {
        registerResourceRoutes()
      }

      return stacksRouter
    },

    // Match multiple HTTP methods for a single route
    match(methods: string[], path: string, handler: StacksHandler) {
      log.debug(`[router] Match: [${methods.join(', ')}] ${path} → ${typeof handler === 'string' ? handler : 'function'}`)
      for (const method of methods) {
        const m = method.toUpperCase()
        const { fullPath, routeKey } = registerRoute(m, path, handler)
        const wrappedHandler = createMiddlewareHandler(routeKey, handler)
        switch (m) {
          case 'GET':
            bunRouter.get(fullPath, wrappedHandler)
            break
          case 'POST':
            bunRouter.post(fullPath, wrappedHandler)
            break
          case 'PUT':
            bunRouter.put(fullPath, wrappedHandler)
            break
          case 'PATCH':
            bunRouter.patch(fullPath, wrappedHandler)
            break
          case 'DELETE':
            bunRouter.delete(fullPath, wrappedHandler)
            break
          case 'OPTIONS':
            bunRouter.options(fullPath, wrappedHandler)
            break
        }
      }
      return createChainableRoute(`${methods[0]}:${currentPrefix}${path}`)
    },

    // Health check route — probes critical dependencies and returns
    // 503 if any of them fail. Returning 200 unconditionally (the old
    // behavior) defeats the purpose: load balancers and uptime checks
    // happily kept routing traffic to a server with a dead database.
    //
    // Each probe is wrapped in a 1.5s timeout because a hung dependency
    // would otherwise stall the health check itself, and the LB health
    // check would time out at the LB layer instead of seeing a clean
    // 503 from the app.
    //
    // Registered at `/api/health` rather than `/health` so it doesn't
    // collide with a userland `health/index.stx` page (the dev dashboard
    // ships one). LBs and uptime monitors should be pointed at
    // `/api/health`.
    health() {
      bunRouter.get('/api/health', async () => {
        const checks: Record<string, { ok: boolean, message?: string, ms?: number }> = {}
        const probe = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
          const start = Date.now()
          try {
            const ac = new AbortController()
            const t = setTimeout(() => ac.abort(), 1500)
            await Promise.race([
              fn(),
              new Promise<never>((_, rej) => ac.signal.addEventListener('abort', () => rej(new Error('timeout')))),
            ])
            clearTimeout(t)
            checks[name] = { ok: true, ms: Date.now() - start }
          }
          catch (err) {
            checks[name] = {
              ok: false,
              ms: Date.now() - start,
              message: err instanceof Error ? err.message : String(err),
            }
          }
        }

        await Promise.all([
          probe('database', async () => {
            const { db } = await import('@stacksjs/database')
            // `SELECT 1` is the universal "I can talk to the DB" probe.
            await (db as any).unsafe?.('SELECT 1')
          }),
          probe('cache', async () => {
            const { cache } = await import('@stacksjs/cache')
            const k = `__health__:${Date.now()}`
            await cache.set(k, 1, 5)
            await cache.del(k)
          }),
        ])

        const healthy = Object.values(checks).every(c => c.ok)
        const body = {
          status: healthy ? 'healthy' : 'degraded',
          checks,
          timestamp: Date.now(),
        }
        return Response.json(body, healthy ? 200 : 503)
      })
      // Internal route-introspection endpoint. Powers `buddy dev` route
      // listing on startup and future `buddy route:list` consumers.
      //
      // Access semantics for `STACKS_EXPOSE_ROUTES` env:
      //   - unset / empty   → endpoint is 404 outside dev
      //   - "1"             → endpoint is open in non-prod, 404 in prod
      //   - any other value → that value is a required token; the request
      //                       must echo it as `X-Stacks-Routes-Token`
      //                       (header) OR `?token=` query param. Works in
      //                       any environment, prod included.
      //
      // The token mode closes stacksjs/stacks#1859 R-4: the previous
      // implementation accepted `STACKS_EXPOSE_ROUTES=1` in prod with
      // no auth gate, publishing the full route table + action paths
      // to anyone who learned the URL.
      bunRouter.get('/__routes', (req: Request) => {
        if (!isExposeRoutesAuthorized(req)) return Response.json({ error: 'disabled' }, 404)
        return Response.json(listRegisteredRoutes())
      })

      // Signed-URL file server for the local disk. Pairs with
      // `Storage.disk('local').signedUrl(...)`. Always-on (no env gate)
      // because the URL itself is unguessable — without a valid HMAC
      // token, every response is 403. The token is verified against
      // both the path AND the expiry, so a leaked URL stops working
      // at `exp` regardless of who holds it.
      bunRouter.get('/__storage/:path', async (req: Request) => {
        const url = new URL(req.url)
        const token = url.searchParams.get('token')
        // Pull the storage-relative path from the route param. We
        // decodeURIComponent because the signer URL-encodes the path
        // (slashes, spaces, etc.) when minting the URL — the JWT
        // claim is the raw path, so we must decode here to compare.
        const params = req.params as Record<string, string> | undefined
        const rawPath = params?.path
          ? decodeURIComponent(params.path)
          : decodeURIComponent(url.pathname.replace(/^\/__storage\//, ''))

        if (!token || typeof rawPath !== 'string' || rawPath.length === 0) {
          return new Response('Forbidden', { status: 403 })
        }

        const { verifySignedStorageToken, Storage } = await import('@stacksjs/storage')
        const v = verifySignedStorageToken(token, rawPath)
        if (!v.valid) {
          // Differentiated body for dev visibility, generic for prod —
          // we DON'T reveal the reason to the client (a malicious
          // probe could differentiate "expired" vs "tampered" and
          // refine attacks). 403 is intentionally opaque.
          return new Response('Forbidden', { status: 403 })
        }

        try {
          const adapter = Storage.disk()
          const exists = await adapter.fileExists(rawPath)
          if (!exists) return new Response('Not Found', { status: 404 })
          // Read as a Buffer (Node-style) which Response accepts as
          // body input cleanly — Bun's `Uint8Array<ArrayBufferLike>` union
          // sometimes doesn't widen to `BodyInit`.
          const buf = await adapter.readToBuffer(rawPath)
          const mime = await adapter.mimeType(rawPath).catch(() => 'application/octet-stream')
          return new Response(buf as unknown as Blob, {
            status: 200,
            headers: {
              'Content-Type': mime,
              // Files behind a signed URL are intentionally short-lived;
              // tell intermediate caches not to keep a copy past the
              // token's lifetime. `private, max-age=60` is a compromise
              // between request rate to the storage backend and the risk
              // of stale responses if a file is updated mid-window.
              'Cache-Control': 'private, max-age=60',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        }
        catch (err) {
          log.error('[storage] signed-url fetch failed:', err)
          return new Response('Internal Error', { status: 500 })
        }
      })

      // OpenAPI spec — live, regenerated on each hit. Same env gate as
      // /__routes because exposing the full schema is implicitly
      // exposing the route table. SwaggerUI/Insomnia/Postman can point
      // straight at this URL in dev for instant docs.
      bunRouter.get('/__openapi.json', async (req: Request) => {
        if (!isExposeRoutesAuthorized(req)) return Response.json({ error: 'disabled' }, 404)
        try {
          const { generateOpenApi } = await import('@stacksjs/api')
          const spec = await (generateOpenApi as () => Promise<unknown>)()
          return Response.json(spec)
        }
        catch (err) {
          return Response.json(
            { error: 'OpenAPI generation failed', message: err instanceof Error ? err.message : String(err) },
            500,
          )
        }
      })
      return stacksRouter
    },

    // Use middleware
    //
    // Accepts:
    // - a bun-router `ActionHandler` (string/path/function/class) — pushed as-is
    // - a `Middleware` instance — auto-wrapped via `.toRouterHandler()` so the
    //   void/throw contract is honored. Without this wrap, returning `undefined`
    //   from `Middleware.handle()` is interpreted by bun-router's
    //   `buildMiddlewareChain` as a final 200 OK with empty body, and every
    //   downstream route silently breaks. See stacksjs/stacks#1870 R-2.
    // - any other handler-shaped object with a `handle()` method — also wrapped,
    //   under the same contract.
    use(middleware: ActionHandler | Middleware | { handle: (req: EnhancedRequest) => void | Promise<void> }) {
      // bunRouter.use() is async, so we need to call it properly
      // For synchronous chaining, we push directly to globalMiddleware
      const adapted = adaptMiddlewareForBunRouter(middleware)
      bunRouter.globalMiddleware.push(adapted as any)
      return stacksRouter
    },

    // Serve the router
    async serve(options: ServerOptions = {}): Promise<Server<unknown>> {
      return bunRouter.serve(options)
    },

    // Handle a request directly
    async handleRequest(req: Request): Promise<Response> {
      return bunRouter.handleRequest(req)
    },

    // Mirror bun-router's introspection: which HTTP methods are registered
    // for `pathname`. Used by the dev dashboard's onRequest gate to decide
    // whether to delegate or fall through to STX page rendering.
    getAllowedMethods(pathname: string, domain?: string): string[] {
      return bunRouter.getAllowedMethods(pathname, domain)
    },

    // Register routes from a package or module file within an optional group
    async register(routePath: string, options?: { prefix?: string, middleware?: string | string[] }): Promise<StacksRouterInstance> {
      log.debug(`[router] Register: ${routePath} prefix=${options?.prefix || 'none'}`)
      const callback = async () => {
        await import(routePath)
      }

      if (options?.prefix || options?.middleware) {
        await stacksRouter.group({
          prefix: options.prefix,
          middleware: options.middleware,
        }, callback)
      }
      else {
        await callback()
      }

      return stacksRouter
    },

    // Import routes from route registry
    async importRoutes(): Promise<void> {
      // Load user-defined routes
      log.debug('[router] Loading user routes from registry...')
      try {
        const { loadRoutes } = await import('./route-loader')
        // Resolve `app/Routes.ts` against the project root via @stacksjs/path
        // so this works under both layouts (workspace vs installed package).
        // The hardcoded `../../../../../app/Routes` path only resolved when
        // the router lived at `storage/framework/core/router/src/`.
        const { appPath } = await import('@stacksjs/path')
        const routeRegistry = (await import(appPath('Routes.ts'))).default
        await loadRoutes(routeRegistry)
      }
      catch (error) {
        log.error('Failed to load route registry:', error)
        throw error
      }

      // Load ORM-generated API routes. The generator writes a project-local
      // routes file; we accept both locations:
      //   - `storage/framework/orm/routes.ts` (canonical, outside the core
      //     package so it survives when @stacksjs/orm is npm-installed)
      //   - `storage/framework/core/orm/routes.ts` (legacy, inside the core
      //     workspace package)
      log.debug('[router] Loading ORM routes...')
      const ormRoutesCandidates = [
        p.frameworkPath('orm/routes.ts'),
        p.frameworkPath('core/orm/routes.ts'),
      ]
      for (const candidate of ormRoutesCandidates) {
        try {
          if (await Bun.file(candidate).exists()) {
            await import(candidate)
            break
          }
        }
        catch (error) {
          log.debug(`ORM routes load failed for ${candidate}:`, error)
        }
      }

      // Load routes from discovered packages
      log.debug('[router] Loading discovered package routes...')
      try {
        await stacksRouter.loadDiscoveredRoutes()
      }
      catch (error) {
        log.debug('Package route discovery skipped:', error)
      }
    },

    // Load routes from discovered Stacks packages in pantry
    async loadDiscoveredRoutes(): Promise<void> {
      try {
        const manifestPath = p.storagePath('framework/discovered-packages.json')
        const file = Bun.file(manifestPath)
        if (!(await file.exists())) return

        const manifest = await file.json()
        const packages = manifest?.packages
        if (!packages) return

        const pantryDir = p.projectPath('pantry')

        for (const [pkgName, meta] of Object.entries(packages) as [string, any][]) {
          const routes = meta?.routes
          if (!routes) continue

          const routeList = Array.isArray(routes) ? routes : [routes]
          const pkgDir = `${pantryDir}/${pkgName}`

          for (const routeFile of routeList) {
            log.debug(`[router] Discovered route: ${pkgName} → ${routeFile}`)
            const fullPath = routeFile.startsWith('/') ? routeFile : `${pkgDir}/${routeFile}`
            const prefix = meta?.routePrefix
            const middleware = meta?.routeMiddleware

            try {
              await stacksRouter.register(fullPath, { prefix, middleware })
            }
            catch (err) {
              log.warn(`Failed to load routes from package '${pkgName}': ${err}`)
            }
          }
        }
      }
      catch {
        // No manifest or failed to parse — skip silently
      }
    },
  }

  return stacksRouter
}

export interface StacksRouterInstance {
  bunRouter: Router
  routes: Route[]
  get: (path: string, handler: StacksHandler) => ChainableRoute
  post: (path: string, handler: StacksHandler) => ChainableRoute
  put: (path: string, handler: StacksHandler) => ChainableRoute
  patch: (path: string, handler: StacksHandler) => ChainableRoute
  delete: (path: string, handler: StacksHandler) => ChainableRoute
  options: (path: string, handler: StacksHandler) => ChainableRoute
  group: (options: GroupOptions, callback: () => void | Promise<void>) => StacksRouterInstance | Promise<StacksRouterInstance>
  resource: (name: string, handler: string, options?: ResourceRouteOptions) => StacksRouterInstance
  match: (methods: string[], path: string, handler: StacksHandler) => ChainableRoute
  health: () => StacksRouterInstance
  use: (middleware: ActionHandler) => StacksRouterInstance
  register: (routePath: string, options?: { prefix?: string, middleware?: string | string[] }) => Promise<StacksRouterInstance>
  serve: (options?: ServerOptions) => Promise<Server<unknown>>
  handleRequest: (req: Request) => Promise<Response>
  /**
   * Returns the HTTP methods registered for `pathname`. Empty array means
   * no route is registered. Useful for upstream gates (e.g. dev servers
   * that want to fall through to a static-file/page renderer when
   * bun-router has nothing to say) and for distinguishing 404 from 405:
   * non-empty + method-not-included = 405.
   */
  getAllowedMethods: (pathname: string, domain?: string) => string[]
  importRoutes: () => Promise<void>
  loadDiscoveredRoutes: () => Promise<void>
}

// Create and export a default router instance
export const route = createStacksRouter()

// Promise-based route loading to prevent race conditions under concurrency
let routesLoadPromise: Promise<void> | null = null

/**
 * Handle a server request through the router
 * This is the main entry point for the Stacks server
 */
export async function serverResponse(request: Request, _body?: string): Promise<Response> {
  // Load routes on first request — use a shared promise to prevent double-loading
  if (!routesLoadPromise) {
    log.debug('[router] Loading routes for first time...')
    routesLoadPromise = route.importRoutes().catch((err) => {
      routesLoadPromise = null
      throw err
    })
  }
  await routesLoadPromise

  const response = await route.handleRequest(request)

  // Enrich generic 404s with the requested path so client-side debugging
  // (typo'd endpoint, missing route in api.ts, stale SPA cache) is one
  // grep away. Only rewrite the framework's default `Not Found` body —
  // user 404s with their own message stay untouched.
  if (response.status === 404 && response.headers.get('content-type')?.includes('json')) {
    try {
      const body = await response.clone().json() as any
      const isGeneric = body?.message === 'Not Found' || body?.error === 'Not Found'
      if (isGeneric) {
        const url = new URL(request.url)
        const enriched = {
          ...body,
          path: url.pathname,
          method: request.method,
        }
        return new Response(JSON.stringify(enriched), {
          status: 404,
          headers: response.headers,
        })
      }
    }
    catch { /* not parseable JSON — leave the original response alone */ }
  }

  return response
}

// Export serve function that uses the default router
export async function serve(options: ServerOptions = {}): Promise<Server<unknown>> {
  return route.serve(options)
}
