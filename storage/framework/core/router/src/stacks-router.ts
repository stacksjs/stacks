/**
 * Stacks Router - Extends bun-router with action/controller resolution
 *
 * This module provides a router that wraps bun-router and adds the ability
 * to use string paths like 'Actions/MyAction' or 'Controllers/MyController@method'
 */

import type { Server } from 'bun'
import type { ActionResult, ActionValidations, ValidationResult } from '@stacksjs/actions'
import type { ActionHandler, ActionPath, EnhancedRequest, ExtractRouteParams, KnownRouteName, MiddlewareHandler as BunMiddlewareHandler, MiddlewareReference, PathForRouteName, RequestFor, Route, ServerOptions } from '@stacksjs/bun-router'
import { response } from '@stacksjs/bun-router'
import { Middleware } from './middleware'
// Side-import the EnhancedRequest module augmentation so every `req._foo`
// and `req.input(...)` access in this file type-checks without `as any`
// (stacksjs/stacks#1863 T-3).
import './request-augmentation'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
import { collect } from '@stacksjs/collections'
import { log, report } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { UploadedFile } from '@stacksjs/storage/uploaded-file'
import { applyRequestEnhancements, applyResponseCompression, Router } from '@stacksjs/bun-router'
import { checkApplicationHealth } from './health'

// --- Split-router-instance detection (stacksjs/stacks#1975 / #1982) ---------
// Two physically distinct @stacksjs/router modules can load in one process: an
// app vendors storage/framework/core AND installs the published dist package,
// and a tsconfig `paths` mapping (`@stacksjs/* -> ./*/src`) resolves core files
// to ./router/src while root files (routes/, app/) resolve to node_modules
// dist. Historically that split user routes onto one `route` instance while the
// server served another's empty table — every route 404'd with NO error logged.
//
// That split is now HARMLESS: the `route` singleton (below) and the
// request-context ALS (request-context.ts) are keyed on process-global Symbols,
// so every loaded copy shares one route table and one request context. We still
// record each loaded module and warn once — a duplicated install is wasteful
// and worth fixing — but it no longer breaks routing, so we do NOT throw.
const ROUTER_INSTANCES_KEY = Symbol.for('@stacksjs/router:loaded-instances')
const loadedRouterInstances: Set<string> = ((globalThis as Record<symbol, unknown>)[ROUTER_INSTANCES_KEY] ??= new Set<string>()) as Set<string>
loadedRouterInstances.add(import.meta.path)
const MULTI_INSTANCE_WARNED_KEY = Symbol.for('@stacksjs/router:multi-instance-warned')

/**
 * Warn (once per process) when more than one @stacksjs/router module has loaded
 * (stacksjs/stacks#1975 / #1982). Routing still works — the route table and
 * request context are process-global singletons — but a duplicated install is
 * worth surfacing. Called at serve() boot. Returns whether a split was detected
 * so callers/tests can assert on it without capturing logs.
 */
/**
 * Work to do once, after the routes are loaded and before the first request.
 *
 * An application has a place to declare routes, a place to declare middleware
 * and - until now - nowhere to say "do this once when the process starts".
 * `app/Routes.ts` is a config object, and a route file runs at import time,
 * which is too early: it is before the router knows what it is serving and
 * before anything the app configures at boot exists.
 *
 * So the shape people reach for instead is a module-level side effect in a file
 * they hope is imported, which is a boot hook that runs at a time nobody chose
 * and cannot be turned off. This is the one they wanted.
 *
 * ## What it is for, and what it is not
 *
 * **Preparation that is optional.** Warming a cache, loading grammars, opening
 * a connection early so the first request does not pay for it. The case it was
 * built for: a syntax highlighter whose first call in a process pays for
 * grammar parsing and JIT, once, and hands that second to whichever reader
 * happened to arrive first.
 *
 * **Not for anything the application requires.** A failing hook is logged and
 * the boot continues, deliberately: refusing to start a server because a cache
 * could not be pre-warmed is a worse failure than a slow first request.
 * Anything that must succeed belongs before `serve()` in the application's own
 * start path, where a rejection stops the process.
 */
export interface BootHook {
  /** Named, so a failure says which one failed rather than "a hook". */
  name: string
  run: () => void | Promise<void>
}

const bootHooks: BootHook[] = []

/** Hooks already run, so a second `serve()` in one process does not repeat them. */
let bootHooksRun = false

/**
 * Run every registered boot hook, once per process.
 *
 * Sequential rather than concurrent: a hook that warms a cache and a hook that
 * opens a connection are both doing work the first request would otherwise do,
 * and running them at once on a cold process contends for the same core that
 * is about to serve. Boot is the one moment where finishing sooner matters less
 * than finishing.
 */
export async function runBootHooks(): Promise<void> {
  if (bootHooksRun)
    return

  bootHooksRun = true

  for (const hook of bootHooks) {
    try {
      await hook.run()
    }
    catch (error) {
      // Logged and survived. See `BootHook` for why this is not fatal.
      log.error(`[router] boot hook "${hook.name}" failed:`, error)
    }
  }
}

/** For tests, and for a process that genuinely re-boots. */
export function resetBootHooks(): void {
  bootHooks.length = 0
  bootHooksRun = false
}

export function warnOnMultipleRouterInstances(): boolean {
  if (loadedRouterInstances.size <= 1)
    return false
  const g = globalThis as Record<symbol, unknown>
  if (!g[MULTI_INSTANCE_WARNED_KEY]) {
    g[MULTI_INSTANCE_WARNED_KEY] = true
    const paths = [...loadedRouterInstances].map(p => `    - ${p}`).join('\n')
    log.warn(
      `${loadedRouterInstances.size} distinct @stacksjs/router modules loaded in one process; they now share one route `
      + `table (stacksjs/stacks#1982) so routing still works, but this is a duplicated install worth fixing. It usually `
      + `means an app vendors storage/framework/core AND installs the published @stacksjs/* dist, and a tsconfig \`paths\` `
      + `mapping (\`@stacksjs/* -> ./*/src\`) splits module resolution between core files and root files. See stacksjs/stacks#1975.\n`
      + `Loaded instances:\n${paths}`,
    )
  }
  return true
}

// Resolve a scaffold-defaults file (under storage/framework/defaults).
//
// Userland first: `buddy publish:middleware Csrf` copies the default into
// `app/Middleware/Csrf.ts` precisely so the app can change it, and named
// middleware already resolves that way (resolveMiddlewareClass below tries
// appPath before the defaults). The framework's own built-ins — Csrf, Cors,
// Compress — used to skip straight to the defaults tree, so a published
// override of exactly those three was loaded by nothing: the file sat in
// app/Middleware looking authoritative while every request ran the stock copy.
// A security policy that silently does not apply is worse than one that was
// never edited.
//
// Then a vendored checkout's storage/framework/defaults; then the published
// @stacksjs/defaults package (which ships the app/ + resources/ trees). Without
// that last fallback the router can't load default
// Actions/Middleware/Controllers on a node_modules deploy and the API server
// fails to boot.
let __defaultsPkgRoot: string | null | undefined
/*
 * Memoized, because the answer cannot change while the process runs and the
 * question was being asked on the hot path.
 *
 * `existsSync` is a synchronous stat, and the CSRF seeding below called this
 * three times on every GET - once to mint a render token, twice more to seed
 * the cookie - so a trivial JSON route paid three filesystem round trips
 * before it answered anything. Whether this checkout is vendored or installed
 * from node_modules is decided at install time, not at request time.
 */
const __defaultsPathCache = new Map<string, string>()
function resolveDefaultsPath(rel: string): string {
  const cached = __defaultsPathCache.get(rel)
  if (cached !== undefined)
    return cached

  // `app/Middleware/Csrf.ts` → `app/Middleware/Csrf.ts` in the project root.
  // Only the `app/` tree is publishable to userland; `resources/` and the rest
  // of the defaults package have no userland counterpart.
  if (rel.startsWith('app/')) {
    const published = p.appPath(rel.slice('app/'.length))
    if (existsSync(published)) {
      __defaultsPathCache.set(rel, published)
      return published
    }
  }

  const vendored = p.storagePath(`framework/defaults/${rel}`)
  let resolved: string
  if (existsSync(vendored)) {
    resolved = vendored
  }
  else {
    if (__defaultsPkgRoot === undefined) {
      try {
        const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
        __defaultsPkgRoot = pkgJson.slice(0, pkgJson.lastIndexOf('/'))
      }
      catch {
        __defaultsPkgRoot = null
      }
    }
    resolved = __defaultsPkgRoot ? `${__defaultsPkgRoot}/${rel}` : vendored
  }

  __defaultsPathCache.set(rel, resolved)
  return resolved
}

const NATIVE_ROUTE_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
const NATIVE_ROUTE_PARAM = /^\{[A-Z_$][\w$]*\}$/i

function hasNativeCompatiblePath(path: string): boolean {
  if (path === '*')
    return true

  const segments = path.split('/')
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!
    if (segment === '' || NATIVE_ROUTE_PARAM.test(segment))
      continue
    if (segment === '*' && index === segments.length - 1)
      continue
    if (segment.includes('{') || segment.includes(':') || segment.includes('*'))
      return false
  }
  return true
}

/**
 * Production defaults to Bun's native matcher only when every eligible route
 * can keep the same semantics. One incompatible route keeps the whole table on
 * bun-router, since a native route can otherwise intercept a request that an
 * overlapping constrained, domain-scoped, or mixed-parameter route expected.
 */
export function shouldUseNativeRoutesByDefault(routes: readonly Route[]): boolean {
  let hasEligibleRoute = false
  for (const route of routes) {
    if (!NATIVE_ROUTE_METHODS.has(route.method) || route.handler instanceof Response)
      continue

    hasEligibleRoute = true
    if (route.nativeDispatch === false
      || route.domain
      || (route.constraints && Object.keys(route.constraints).length > 0)
      || !hasNativeCompatiblePath(route.path))
      return false
  }
  return hasEligibleRoute
}

import { runWithRequest } from './request-context'
import { isApiRequest, JSON_CONTENT_TYPE } from './api-shape'
import { createErrorResponse, createMiddlewareErrorResponse } from './error-handler'
import { applySecurityHeaders, createJsonSecurityHeaders, secureSerializedJsonResponse } from './security-headers'
import { isCursorPaginator, isPaginator, isSimplePaginator } from '@stacksjs/pagination'


type RouteHandlerFn = (_req: EnhancedRequest) => Response | Promise<Response>

/**
 * An inline handler, as a route file writes one.
 *
 * Wider than {@link RouteHandlerFn} on purpose: a function handler's return
 * value goes through `formatResult`, which turns an object into JSON, a string
 * into text, `null` into a 204 and a stream into a streamed response. The type
 * said `Response`, so `route.get('/x', () => ({ ok: true }))` - which works,
 * and is the shape most handlers actually want - did not compile, and the
 * workaround was to reach for `Response.json` or an `any`.
 *
 * `RouteHandlerFn` stays as it is: that is what a WRAPPED handler returns, and
 * by then `formatResult` has already run.
 */
type InlineRouteHandler = (_req: EnhancedRequest) => ActionResult | Promise<ActionResult>

/**
 * The same, with `request.params` narrowed to what the path declares.
 *
 * Declared as the FIRST overload on every route method so an inline arrow is
 * contextually typed by it. A single parameter typed as the whole
 * {@link StacksHandler} union gives TypeScript nothing to type an arrow with -
 * `route.get('/users/{id}', req => req.params.slugTypo)` compiled and returned
 * `undefined`, which is the failure a typed router exists to prevent.
 */
type TypedInlineRouteHandler<TPath extends string>
  = (_req: RequestFor<TPath>) => ActionResult | Promise<ActionResult>

export type StacksHandler = ActionPath | InlineRouteHandler | RouterAction

interface StacksRouterConfig {
  verbose?: boolean
  apiPrefix?: string
}

interface GroupOptions {
  prefix?: string
  middleware?: MiddlewareReference | MiddlewareReference[]
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
  // `readonly`, so the declared signature's `readonly TOnly[]` - which is what
  // makes `only: ['index', 'show']` infer as literals rather than widening to
  // `ResourceAction[]` - is assignable to it. The implementation only reads.
  only?: readonly ResourceAction[]
  except?: readonly ResourceAction[]
  middleware?: MiddlewareReference | MiddlewareReference[]
}

/** `'PostAction'` → `'Post'`; anything else is left alone. */
type StripActionSuffix<T extends string> = T extends `${infer Base}Action` ? Base : T

/** `'Post'` → `'Actions/Post'`; an explicit `'Actions/…'` base is left alone. */
type WithActionsPrefix<T extends string> = T extends `Actions/${string}` ? T : `Actions/${T}`

/** The file-name half each CRUD action is composed from. */
interface ResourceKindOf {
  index: 'Index'
  store: 'Store'
  show: 'Show'
  update: 'Update'
  destroy: 'Destroy'
}

/**
 * The actions a call actually registers.
 *
 * `only` wins over `except`, matching the runtime: it checks `options.only`
 * first and never looks at `except` when both are given.
 */
type ActiveResourceActions<TOnly extends ResourceAction, TExcept extends ResourceAction>
  = [TOnly] extends [never]
    ? ([TExcept] extends [never] ? ResourceAction : Exclude<ResourceAction, TExcept>)
    : TOnly

/** The action files a call needs, given its base and its active actions. */
type RequiredResourceActions<TBase extends string, TActive extends ResourceAction>
  = `${WithActionsPrefix<StripActionSuffix<TBase>>}${ResourceKindOf[TActive]}Action`

/** Of those, the ones that do not exist. */
type MissingResourceActions<TBase extends string, TActive extends ResourceAction>
  = Exclude<RequiredResourceActions<TBase, TActive>, ActionPath>

/**
 * Every action a `resource()` call will register has to exist.
 *
 * Not "at least one of them" - that waves through the case this is really for.
 * `Actions/Cms/Page` has Index, Store, Update and Destroy but no Show, so
 * `route.resource('pages', 'Actions/Cms/Page')` registers a `GET /pages/{id}`
 * that 500s the first time anybody opens a page, while
 * `{ except: ['show'] }` is completely fine. Only the exact set answers that,
 * which is why `only` and `except` are inferred as literals and read here.
 *
 * Resolves to `unknown` when nothing is missing - an intersection with
 * `unknown` is the base itself - and otherwise to an object the base cannot
 * satisfy, whose property name puts the missing files in the error message.
 */
type ResourceBaseCheck<TBase extends string, TActive extends ResourceAction>
  = [MissingResourceActions<TBase, TActive>] extends [never]
    ? unknown
    : { 'these actions do not exist': MissingResourceActions<TBase, TActive> }

/**
 * Chainable route interface for middleware and naming support
 */
export interface ChainableRoute {
  /**
   * One middleware alias, or an array of them applied in order.
   *
   * The array form is what the implementation has always accepted - and what
   * `RouteOptions.middleware` and `register()` already declare - but this
   * interface said `string`, so `.middleware(['auth', 'can:x'])` was a type
   * error at every call site despite working.
   */
  middleware: (name: MiddlewareReference | readonly MiddlewareReference[]) => ChainableRoute
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

const CSRF_DEFAULT = 0
const CSRF_SKIPPED = 1
const CSRF_REQUIRED = 2
type RouteCsrfMode = typeof CSRF_DEFAULT | typeof CSRF_SKIPPED | typeof CSRF_REQUIRED

/**
 * Mutable route-owned CSRF state. The handler and chainable route retain the
 * same object, so `.skipCsrf()` and `.requireCsrf()` stay live without two
 * global Set lookups on every protected request.
 */
interface RouteCsrfState {
  mode: RouteCsrfMode
}
const routeCsrfRegistry = new Map<string, RouteCsrfState>()

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
interface RouteRateLimitState {
  config?: RouteRateLimitConfig
}
const routeRateLimitRegistry = new Map<string, RouteRateLimitState>()

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
    const { applyCorsHeaders } = await import(resolveDefaultsPath('app/Middleware/Cors.ts'))
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

/**
 * Actions registered by import rather than by name, keyed by route.
 *
 * A route registered as `'Actions/ShowProject'` tells the OpenAPI generator
 * where to read the action's `validations` from. A route registered with the
 * action object itself has no such path - so without this the typed form would
 * silently document every one of its endpoints as accepting nothing, which is
 * the exact failure the handler registry was added to fix for the string form.
 */
const routeActionRegistry = new Map<string, RouterAction>()

/** HTTP methods that mutate state and therefore need CSRF protection. */
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_SEEDED_BY_HANDLE_REQUEST = Symbol.for('stacks.router.csrfSeededByHandleRequest')
const FRAMEWORK_RESPONSE_METADATA_APPLIED = Symbol('stacks.router.frameworkResponseMetadataApplied')

interface ResolvedMiddleware {
  name: string
  timingName: string
  handler: MiddlewareHandler
  priority: number
  parameterName?: string
  params?: string
}

interface MiddlewareTiming {
  name: string
  ms: number
}

const EMPTY_MIDDLEWARE_TIMINGS: MiddlewareTiming[] = []
const EMPTY_MIDDLEWARE_ENTRIES: readonly string[] = []
const CSRF_ONLY_MIDDLEWARE: readonly string[] = ['csrf']

/** Finished middleware descriptors, reused until a development cache clear. */
let resolvedMiddlewareEntryCache = new Map<string, ResolvedMiddleware>()
let resolvedCsrfOnlyMiddleware: ResolvedMiddleware[] | undefined

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
/**
 * The params a named route needs, plus anything else that becomes query string.
 *
 * The required half comes from the path the name resolves to, so
 * `url('user.post', { id: 42 })` against `/users/{id}/posts/{postId}` stops
 * compiling instead of throwing at call time. Extra keys stay allowed: the
 * implementation appends whatever it did not consume as a query string, which
 * is what `url('email.unsubscribe', { token })` relies on.
 */
export type UrlParams<TName extends string>
  = { [K in keyof ExtractRouteParams<PathForRouteName<TName>>]: string | number }
    & Record<string, string | number>

/** The keys of `T` that are not optional. */
type RequiredParamKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T]

/**
 * Whether `url()` must be given a second argument.
 *
 * Keyed on REQUIRED params: a path whose only placeholder is optional is
 * reachable with nothing at all, and demanding an empty object for it would be
 * the type getting in the way of the truth.
 */
type RequiresUrlParams<TName extends string>
  = [RequiredParamKeys<ExtractRouteParams<PathForRouteName<TName>>>] extends [never] ? false : true

// False positive: this is an overload signature, which has no body for its
// parameters to be used in. The implementation below uses them.
// eslint-disable-next-line unused-imports/no-unused-vars
export function url<TName extends KnownRouteName>(
  routeName: TName,
  ...params: RequiresUrlParams<TName> extends true ? [params: UrlParams<TName>] : [params?: UrlParams<TName>]
): string
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
 * Every named route, as `name → path`.
 *
 * `listRegisteredRoutes()` reports a name by searching the named registry for a
 * matching path, which answers "what is this route called" and cannot answer
 * "what routes are there names for" - two routes on one path give the first
 * name found, and a name whose route was never registered is invisible.
 *
 * The type generator needs the second question: it writes this map into the
 * router's type registry so `url('users.shwo')` stops compiling. Reading the
 * registry directly is the only way to get every name.
 */
export function listNamedRoutes(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, named] of namedRouteRegistry.entries())
    out[name] = named.path
  return out
}

/**
 * Snapshot of the registered routes — `{ method, path, name?, handler? }` per
 * route. Used by `buddy route:list`, the dev-server startup banner, and the
 * OpenAPI generator.
 *
 * `handler` is the string a route was registered with (`'Actions/…'`), and it
 * is absent for an inline function, which has no file to read anything out of.
 * The OpenAPI generator needs it to find the action's `validations`: it used to
 * guess the path by title-casing the route *name* (`posts.store` →
 * `Actions/PostsStoreAction`), which found a schema for the handful of routes
 * following that convention and silently described every other endpoint as
 * taking no input at all. The registry has known the real answer the whole
 * time; it was simply not being reported.
 */
export function listRegisteredRoutes(): Array<{ method: string, path: string, name?: string, handler?: string, action?: RouterAction }> {
  const out: Array<{ method: string, path: string, name?: string, handler?: string, action?: RouterAction }> = []
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
    out.push({
      method,
      path,
      name: routeName,
      handler: routeHandlerKeyRegistry.get(key),
      action: routeActionRegistry.get(key),
    })
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

/**
 * How long the whole middleware chain gets before the router gives up on it
 * and answers 500, so a hung layer frees the worker instead of holding it.
 */
const MIDDLEWARE_TIMEOUT_MS = 30_000

/**
 * Whether `log.debug` would print, cached.
 *
 * `process.env` is a live view of the real environment in Bun, so reading
 * `LOG_LEVEL` is not a plain property access - and this gate sits on the
 * request path of every middleware-bearing route. The level is a boot-time
 * setting; re-asking per request only spends time discovering it has not
 * changed. Mirrors what `security-headers.ts` already does with its own flags.
 */
let _debugLoggingCache: boolean | undefined
function isDebugLogging(): boolean {
  if (_debugLoggingCache === undefined) {
    const level = (process.env.LOG_LEVEL || 'info').toLowerCase()
    _debugLoggingCache = level !== 'info' && level !== 'warn' && level !== 'error'
  }
  return _debugLoggingCache
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
  /*
   * The same union `use()` accepts, including the two-argument
   * `(req, next) => Response` form. That arm was missing here, so the sync
   * chaining path had to cast to reach this function at all - and a cast at
   * the call site unchecks every other arm too. The bare-function
   * pass-through at the end of this function is already the correct handling
   * for it: bun-router has its own function branch.
   */
  middleware:
    | ActionHandler
    | BunMiddlewareHandler
    | Middleware
    | { handle: (req: EnhancedRequest) => void | Promise<void> },
): BunMiddlewareHandler {
  if (middleware instanceof Middleware) {
    // `toRouterHandler()` already returns `(req, next) => Promise<Response>`,
    // which is exactly a MiddlewareHandler - it only needed a cast while this
    // function claimed to return the much broader ActionHandler.
    return middleware.toRouterHandler()
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
    const wrapper: BunMiddlewareHandler = async (req, next) => {
      try {
        await handle(req)
      }
      catch (thrown) {
        if (thrown instanceof Response) return thrown
        throw thrown
      }
      return next()
    }
    return wrapper
  }

  /*
   * Pass-through for the bare-function forms, which bun-router runs through
   * its own function branch.
   *
   * `ActionHandler` is a broad union that also admits a route path string and
   * a constructor; neither is usable as global middleware, and neither is what
   * any caller passes here. The narrowing says which arm this line is for.
   */
  return middleware as BunMiddlewareHandler
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
 * Load the middleware alias map, defaults first and the application's own on
 * top. Maps short names (e.g., 'auth') to class names (e.g., 'Auth').
 *
 * MERGED rather than either/or. The app's file used to replace the defaults
 * wholesale, which reads as an override and behaves as a deletion: every alias
 * the framework adds after a project was scaffolded is missing from that
 * project, silently, and the only symptom is a route whose guard resolves to
 * something else or to nothing. `generate:types` already unions both files into
 * `MiddlewareAlias`, so the type said those aliases existed while the runtime
 * had never heard of them.
 */
async function getMiddlewareAliases(): Promise<Record<string, string>> {
  if (middlewareAliasesPromise) return middlewareAliasesPromise
  middlewareAliasesPromise = (async (): Promise<Record<string, string>> => {
    const merged: Record<string, string> = {}

    for (const load of [
      () => import(resolveDefaultsPath('app/Middleware.ts')),
      () => import(p.appPath('Middleware.ts')),
    ]) {
      try {
        const module = await load()
        Object.assign(merged, module.default ?? {})
      }
      catch {
        // A project without an `app/Middleware.ts`, or a checkout without the
        // defaults on disk, is normal. Only both missing leaves this empty.
      }
    }

    return merged
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
 * The generated middleware registry: class name to file, resolved absolute.
 *
 * `buddy generate` writes `storage/framework/auto-imports/middleware.ts` from
 * `app/Middleware/` and the framework defaults behind it - the same map
 * `MiddlewareClasses` is `keyof`'d from, so a class name that type-checks in
 * `app/Middleware.ts` is one that resolves here.
 *
 * Null when the file is absent, and `loadMiddleware` falls back to the two
 * paths it always tried, so a project that has not run `buddy generate` still
 * works.
 */
let middlewareRegistryPromise: Promise<Record<string, string> | null> | null = null

async function getMiddlewareRegistry(): Promise<Record<string, string> | null> {
  if (middlewareRegistryPromise)
    return middlewareRegistryPromise

  middlewareRegistryPromise = (async () => {
    try {
      const dir = p.storagePath('framework/auto-imports')
      const module = await import(`${dir}/middleware.ts`) as { middleware?: Record<string, string> }
      if (!module.middleware)
        return null

      const { resolve } = await import('node:path')

      return Object.fromEntries(
        Object.entries(module.middleware).map(([name, file]) => [name, resolve(dir, file)]),
      )
    }
    catch {
      return null
    }
  })()

  return middlewareRegistryPromise
}

/**
 * Load a middleware by name.
 *
 * Returns null when the alias cannot be resolved to a module with a
 * usable `handle()` — callers MUST treat null as fatal for the route
 * (fail closed), never as "skip this middleware". A found-but-broken
 * file (no default export / no handle method) is cached as null so the
 * breakage is deterministic; a missing file is NOT cached, so creating
 * the file in dev fixes the alias without a restart.
 */
async function loadMiddleware(name: string): Promise<MiddlewareHandler | null> {
  if (middlewareCache.has(name)) {
    return middlewareCache.get(name) ?? null
  }

  const className = await resolveMiddlewareName(name)

  // The registry first: it is exact, it already encodes the app-over-defaults
  // override, and it works inside a compiled binary where probing source
  // directories finds nothing.
  const registry = await getMiddlewareRegistry()
  const registered = registry?.[className]
  if (registered) {
    try {
      const middleware = await import(registered)
      const handler = (middleware.default ?? null) as MiddlewareHandler | null
      if (!handler || typeof handler.handle !== 'function') {
        log.error(`[Router] Middleware '${name}' resolved to ${registered}, but the file has no default export with a handle() method`)
        middlewareCache.set(name, null)
        return null
      }
      middlewareCache.set(name, handler)
      return handler
    }
    catch (err: unknown) {
      // A registry entry that fails to IMPORT is a broken file, not a missing
      // one, and the path fallback below would only find the same file again.
      log.error(`[Router] Failed to load middleware '${name}' from ${registered}:`, err)
      return null
    }
  }

  // Try loading from app/Middleware first (user overrides)
  let userPathError: unknown
  try {
    const userPath = p.appPath(`Middleware/${className}.ts`)
    const middleware = await import(userPath)
    const handler = (middleware.default ?? null) as MiddlewareHandler | null
    if (!handler || typeof handler.handle !== 'function') {
      // The file exists and shadows the framework default — a missing
      // default export here is a bug in the user's middleware, not a
      // reason to silently fall back to different behavior.
      log.error(`[Router] Middleware '${name}' resolved to ${userPath}, but the file has no default export with a handle() method`)
      middlewareCache.set(name, null)
      return null
    }
    middlewareCache.set(name, handler)
    return handler
  }
  catch (err: unknown) {
    userPathError = err
  }

  // Fall back to framework defaults
  try {
    const defaultPath = resolveDefaultsPath(`app/Middleware/${className}.ts`)
    const middleware = await import(defaultPath)
    const handler = (middleware.default ?? null) as MiddlewareHandler | null
    if (!handler || typeof handler.handle !== 'function') {
      log.error(`[Router] Middleware '${name}' resolved to ${defaultPath}, but the file has no default export with a handle() method`)
      middlewareCache.set(name, null)
      return null
    }
    middlewareCache.set(name, handler)
    return handler
  }
  catch (err: unknown) {
    // Surface BOTH lookup failures — the user-path error was previously
    // swallowed, which hid "user file exists but fails to import" behind
    // a misleading defaults-only message.
    const userMsg = userPathError instanceof Error ? userPathError.message : String(userPathError)
    log.error(`[Router] Failed to load middleware '${name}' (resolved to '${className}'). app/Middleware: ${userMsg}; defaults:`, err)
    return null
  }
}

/**
 * The merged middleware alias map: the framework defaults, with the
 * application's own map on top.
 *
 * Exported for diagnostics and tests. A copy, so a caller cannot edit the
 * cached map out from under the router.
 */
export async function middlewareAliases(): Promise<Record<string, string>> {
  return { ...(await getMiddlewareAliases()) }
}

/**
 * Negated middleware, by the name of the middleware being negated.
 *
 * Kept separate from `middlewareCache` so `'auth'` and `'!auth'` never collide,
 * and cleared alongside it on hot reload.
 */
const negatedMiddlewareCache = new Map<string, MiddlewareHandler>()

/**
 * Whether a thrown value is a middleware saying "no" rather than crashing.
 *
 * The `Middleware` contract is "return to continue, throw a `Response` or an
 * HTTP error to short-circuit", so a refusal is recognisable: a `Response`, or
 * an error carrying a status. A `TypeError` from a bug inside the middleware is
 * neither, and must not be read as a refusal - that is the difference between
 * `!auth` letting a guest through and `!auth` letting everyone through because
 * `Auth` happened to throw on a malformed header.
 */
function isShortCircuit(thrown: unknown): boolean {
  if (thrown instanceof Response)
    return true

  return typeof thrown === 'object'
    && thrown !== null
    && ('status' in thrown || 'statusCode' in thrown)
}

/**
 * Invert a middleware: pass when it refuses, refuse when it passes.
 *
 * `!auth` (a route for guests only) and `!env:production` are documented in
 * `app/Middleware.ts`, are legal in the `MiddlewareReference` type, and have a
 * type-level test asserting `.middleware('!auth')` compiles. Nothing
 * implemented them. `resolveMiddlewareName('!auth')` looked up an alias that
 * was not there, PascalCased the string into `'!auth'`, failed to find
 * `app/Middleware/!auth.ts`, and returned null - which the router correctly
 * treats as fatal, so the documented syntax aborted boot with "Unresolvable
 * middleware alias(es)".
 */
function negateMiddleware(name: string, inner: MiddlewareHandler): MiddlewareHandler {
  const cached = negatedMiddlewareCache.get(name)
  if (cached)
    return cached

  const negated: MiddlewareHandler = {
    priority: inner.priority,
    async handle(req) {
      try {
        await inner.handle(req)
      }
      catch (thrown) {
        if (isShortCircuit(thrown))
          return

        throw thrown
      }

      const { HttpError } = await import('@stacksjs/error-handling')
      throw new HttpError(403, `Access denied. This route requires "${name}" not to apply.`)
    },
  }

  negatedMiddlewareCache.set(name, negated)

  return negated
}

/**
 * Load the handler a parsed reference names, negated when it asked to be.
 */
function loadParsedMiddleware(parsed: ParsedMiddleware): MiddlewareHandler | null | Promise<MiddlewareHandler | null> {
  // Resolved modules are synchronous values. Keep cached failures as null so
  // the caller still fails closed, and use the same cache hot reload clears.
  const cached = middlewareCache.get(parsed.name)
  if (cached !== undefined)
    return cached && parsed.negated ? negateMiddleware(parsed.name, cached) : cached

  return loadMiddleware(parsed.name).then(handler =>
    handler && parsed.negated ? negateMiddleware(parsed.name, handler) : handler,
  )
}

/**
 * Clear the middleware cache (useful for hot-reload in development).
 *
 * `installMiddlewareHotReload()` will wire this up automatically when
 * called from the dev server — production should never invoke it.
 */
export function clearMiddlewareCache(): void {
  middlewareCache.clear()
  negatedMiddlewareCache.clear()
  resolvedMiddlewareEntryCache = new Map()
  resolvedCsrfOnlyMiddleware = undefined
  // In-flight parses keep their original map and cannot refill this cache
  // with aliases from before a reload.
  parsedMiddlewareCache = new Map()
  middlewareAliasesPromise = null
  middlewareRegistryPromise = null
  actionRegistryPromise = null
  // Action-level CSRF skip cache + route-handler key registry are
  // populated lazily when actions load; they should be flushed in
  // lockstep with the middleware cache so a hot-reloaded action that
  // toggled its `skipCsrf` flag is re-read on the next request rather
  // than serving from a stale answer (stacksjs/stacks#1863 T-8).
  actionSkipsCsrfCache.clear()
  routeHandlerKeyRegistry.clear()
  routeActionRegistry.clear()
  // Same reasoning for the resolved CSRF middleware module: editing
  // `app/Middleware/Csrf.ts` in dev has to be picked up without a restart, and
  // it is now held as a module reference rather than re-imported per request.
  clearCsrfModuleCache()
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
 * Drop every registered route → middleware mapping.
 *
 * The registry is module-scoped and lives for the life of the process, which
 * is what `listRegisteredRoutes()` and the boot-time validators read. That is
 * correct at runtime — routes are registered once at boot — but it means a
 * test that registers a route keeps it visible to every later caller in the
 * same process, including `assertRouteMiddlewareResolvable()`. A suite that
 * deliberately registers an unresolvable alias therefore made an unrelated
 * file's `serverResponse()` throw on routes it never declared.
 *
 * `clearMiddlewareCache()` deliberately does NOT do this: it flushes resolved
 * middleware so a hot-reloaded file is re-read, while the routes themselves
 * must survive. Clearing the route table is a separate, coarser action.
 */
export function clearRouteMiddlewareRegistry(): void {
  // Request handlers retain their route's array so chainable middleware can
  // be read without a Map lookup on every dispatch. Empty those arrays before
  // dropping the registry entries so this test/reset seam still affects live
  // handlers exactly as it did before.
  for (const middleware of routeMiddlewareRegistry.values())
    middleware.length = 0
  routeMiddlewareRegistry.clear()
}

/**
 * Route keys that inherited `apiResponse: true` from a `route.group({
 * apiResponse: true }, …)` declaration. Checked at request time to flip
 * `req._forceJson`, which makes `formatResult()` skip content negotiation.
 * Action-level `apiResponse` (read from the resolved Action instance) is
 * applied separately and wins over the group setting.
 */
const routeApiResponseRegistry = new Set<string>()

/** One middleware reference, taken apart. */
interface ParsedMiddleware {
  /** The alias or class name to load, with any leading `!` removed. */
  readonly name: string
  /** Whether the reference was negated with a leading `!`. */
  readonly negated: boolean
  /** Sanitized Server-Timing label for the original reference. */
  readonly timingName: string
  /** Whatever followed the first `:`, when the reference is not itself an alias. */
  readonly params?: string
}

let parsedMiddlewareCache = new Map<string, ParsedMiddleware | Promise<ParsedMiddleware>>()

function parseMiddlewareEntry(middleware: string): ParsedMiddleware | Promise<ParsedMiddleware> {
  const cache = parsedMiddlewareCache
  let parsed = cache.get(middleware)
  if (!parsed) {
    parsed = parseMiddlewareEntryUncached(middleware).then((resolved) => {
      cache.set(middleware, resolved)
      return resolved
    }, (error) => {
      cache.delete(middleware)
      throw error
    })
    cache.set(middleware, parsed)
  }
  return parsed
}

/**
 * Parse a middleware reference into the name to load, its parameters, and
 * whether it was negated.
 *
 * The WHOLE reference is checked against the alias map before the colon is read
 * as a parameter separator, and that ordering is the fix for a guard that did
 * nothing. `app/Middleware.ts` ships `'env:production': 'EnvProduction'`, and
 * splitting first turned `.middleware('env:production')` into the alias `'env'`
 * with a parameter `'production'` - so it loaded `Env`, which accepts any of
 * the six known environments and ignores parameters outright. A route marked
 * production-only was open in local, dev and staging, and every one of the six
 * `env:*` aliases was unreachable. `'throttle:60,1'` is not an alias, so it
 * still splits and still passes `60,1` to `throttle`.
 *
 * Async because the alias map is loaded by dynamic import. The old sync
 * version could not consult it, which is why it did not.
 */
async function parseMiddlewareEntryUncached(middleware: string): Promise<ParsedMiddleware> {
  const timingName = middleware.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32)
  const negated = middleware.startsWith('!')
  const bare = negated ? middleware.slice(1) : middleware
  const aliases = await getMiddlewareAliases()

  if (Object.hasOwn(aliases, bare))
    return { name: bare, negated, timingName }

  const colonIndex = bare.indexOf(':')
  if (colonIndex === -1)
    return { name: bare, negated, timingName }

  return {
    name: bare.substring(0, colonIndex),
    negated,
    timingName,
    params: bare.substring(colonIndex + 1),
  }
}

/**
 * Resolve every middleware alias referenced by a registered route and
 * report the ones that don't load. `csrf` is always checked too — it's
 * auto-injected on unsafe methods even when no route lists it.
 *
 * Resolution is inherently lazy (`.middleware(name)` is a sync chainable
 * that just records a string; the alias map and middleware modules load
 * via async dynamic import), so a throw at literal registration time is
 * impossible. Calling this after all routes are registered — the end of
 * `importRoutes()` and the compiled-binary boot in core/server — IS
 * effectively registration-time validation. See stacksjs/stacks#1957.
 */
export async function findUnresolvableRouteMiddleware(): Promise<Array<{ alias: string, routes: string[] }>> {
  const usage = new Map<string, { parsed: ParsedMiddleware, routes: string[] }>()
  for (const [routeKey, entries] of routeMiddlewareRegistry) {
    for (const entry of entries) {
      const parsed = await parseMiddlewareEntry(entry)
      // Reported without the parameters - those are the middleware's argument,
      // not part of what has to resolve - but WITH the `!`, because `auth` and
      // `!auth` are two different things to look up.
      const alias = parsed.negated ? `!${parsed.name}` : parsed.name
      const seen = usage.get(alias) ?? { parsed, routes: [] }
      seen.routes.push(routeKey)
      usage.set(alias, seen)
    }
  }
  if (!usage.has('csrf'))
    usage.set('csrf', { parsed: { name: 'csrf', negated: false, timingName: 'csrf' }, routes: ['(auto-injected on POST/PUT/PATCH/DELETE)'] })

  const unresolvable: Array<{ alias: string, routes: string[] }> = []
  for (const [alias, { parsed, routes }] of usage) {
    const handler = await loadParsedMiddleware(parsed)
    if (!handler || typeof handler.handle !== 'function')
      unresolvable.push({ alias, routes })
  }
  return unresolvable
}

/**
 * Throw when any registered route references a middleware alias that
 * cannot be resolved. Fail-closed boot validation: a typo'd `auth` alias
 * must abort startup loudly, not serve the route unprotected (the
 * request-time guard in createMiddlewareHandler 500s as a backstop).
 */
export async function assertRouteMiddlewareResolvable(): Promise<void> {
  const unresolvable = await findUnresolvableRouteMiddleware()
  if (unresolvable.length === 0)
    return
  const detail = unresolvable
    .map(u => `"${u.alias}" (used by ${u.routes.join(', ')})`)
    .join('; ')
  throw new Error(`[Router] Unresolvable middleware alias(es): ${detail}. Check the alias map in app/Middleware.ts or add app/Middleware/<Class>.ts.`)
}

/**
 * Create a wrapped handler with middleware support
 */
function createMiddlewareHandler(routeKey: string, handler: StacksHandler): RouteHandlerFn {
  // Create the base handler with skipParsing=true since we'll do it ourselves
  const wrappedBase = wrapHandler(handler, true, routeKey)
  const routeMiddleware = routeMiddlewareRegistry.get(routeKey) ?? EMPTY_MIDDLEWARE_ENTRIES
  const routeCsrf = routeCsrfRegistry.get(routeKey)
  const routeRateLimit = routeRateLimitRegistry.get(routeKey)

  /*
   * Everything about this route that a request cannot change, decided here.
   *
   * The method is in the route key, the handler is the argument, and the
   * group-level `apiResponse` flag is written by `registerRoute` before this
   * function is called - so all three were being re-derived per request from
   * data that was already fixed. The registries that the chainable API can
   * still mutate after registration (`.middleware()`, `.skipCsrf()`,
   * `.rateLimit()`) are retained as route-owned state so updates stay live.
   */
  const routeMethod = routeKey.slice(0, routeKey.indexOf(':')).toUpperCase()
  const routeAcceptsCsrf = CSRF_PROTECTED_METHODS.has(routeMethod)
  const routeMayHaveBody = routeMethod !== 'GET' && routeMethod !== 'HEAD'
  const routeRendersCsrf = routeMethod === 'GET' || routeMethod === 'HEAD'
  const routeSeedsCsrf = routeMethod === 'GET' || routeMethod === 'HEAD' || routeMethod === 'OPTIONS'
  const forcesJsonByGroup = routeApiResponseRegistry.has(routeKey)
  // Direct actions are already resolved and immutable, so retain their CSRF
  // flag now. Only string actions need the shared cache that their lazy import
  // fills later.
  const directActionSkipsCsrf = isRouterAction(handler)
    && (handler.skipCsrf === true || handler.csrf === false)
  const handlerKey = typeof handler === 'string' ? handler : undefined

  /*
   * Pre-resolve string handlers so action-level CSRF flags (skipCsrf) are
   * cached before the middleware chain runs. Without this, the first request
   * to a skipCsrf webhook would inject CSRF, fail, and only the SECOND request
   * would see the populated cache and skip injection.
   *
   * Only for CSRF-protected methods: GET/HEAD/OPTIONS never get CSRF injected,
   * so prefetching their actions would front-load every action import (and its
   * model graph) at registration time for no benefit. Measured ~90ms of
   * dev-boot time across a route-heavy app; safe-method actions resolve lazily
   * on first request instead. Idempotent - later resolutions come from the
   * import cache.
   *
   * An action handed over directly needs none of this: `wrapHandler` above
   * already read its flags, synchronously, before this line.
   */
  let actionPrefetch: Promise<void> | null = null
  if (typeof handler === 'string' && routeAcceptsCsrf) {
    const pending = resolveStringHandler(handler)
    if (pending instanceof Promise) {
      const settled = () => { actionPrefetch = null }
      actionPrefetch = pending.then(settled, settled)
    }
  }

  return async (req: EnhancedRequest) => {
    // Parse body and enhance request first. parseRequestBody can throw
    // an HttpError(400) on malformed JSON (stacksjs/stacks#1859 H-5) —
    // route that to the standard error response path instead of letting
    // it bubble out of the handler as an unhandled rejection.
    if (routeMayHaveBody) {
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
    }
    // bun-router dispatches only after its enhancer has installed both its
    // macros and the Stacks prototype. The fused enhancer also initializes the
    // request id, so running the public fallback decorator again here only
    // repeats params assignment and a marker lookup.
    const enhancedReq = req
    const csrfHandledByOuter = (enhancedReq as unknown as Record<symbol, unknown>)[CSRF_SEEDED_BY_HANDLE_REQUEST] === true

    // Mint the CSRF token BEFORE the handler runs, not after.
    //
    // Seeding it on the way out (below) is too late for a server-rendered
    // page: the page is what has to embed the token in its forms, and on a
    // visitor's very first request it renders before any cookie exists. Their
    // first submit then fails CSRF - the one submit most likely to be somebody
    // trying the product for the first time.
    //
    // So the token is created here and pushed into the request's own cookie
    // header, which is where a template reads cookies from. The response
    // seeding below then reuses this exact value rather than generating a
    // second one, so what the page embedded and what the browser stores are
    // the same string.
    if (!csrfHandledByOuter && routeRendersCsrf) {
      const renderTokenSeeding = seedCsrfTokenForRender(enhancedReq as unknown as Request & { _csrfToken?: string })
      if (renderTokenSeeding) await renderTokenSeeding
    }

    if (actionPrefetch) await actionPrefetch

    // Group-level apiResponse: flip `_forceJson` so `formatResult` skips
    // negotiation and always returns JSON. Action-level apiResponse is
    // applied later (inside the action wrapper) and wins by also setting
    // the same flag.
    if (forcesJsonByGroup) {
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
      const rl = routeRateLimit?.config
      if (rl) {
        try {
          const { rateLimit: enforceRateLimit } = await import('./rate-limit')
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

      const userMiddleware = routeMiddleware

      // Default-on CSRF: every state-mutating method gets `csrf` injected
      // at the front of the chain unless:
      //   - the route author explicitly added `.skipCsrf()`
      //   - they already listed `csrf` themselves (don't double-run)
      //   - the resolved action exports `skipCsrf: true` / `csrf: false`
      //     (handled by stamping `_skipCsrf` on the request — the CSRF
      //     middleware itself bails when it sees that flag)
      // The bearer-token bypass and safe-method bypass live inside the
      // CSRF middleware itself, so they don't need to be re-checked here.
      // A route's method is fixed at registration, so whether CSRF could
      // apply at all was already known before this request arrived. HEAD is
      // served by the GET route and is not CSRF-protected either way, so
      // reading it off the route rather than the request changes nothing.
      let shouldInjectCsrf = false
      if (routeAcceptsCsrf) {
        const alreadyHasCsrf = userMiddleware.some(m => m === 'csrf' || m.startsWith('csrf:'))
        const routeCsrfMode = routeCsrf?.mode ?? CSRF_DEFAULT
        const routeSkipped = routeCsrfMode === CSRF_SKIPPED
        const routeRequired = routeCsrfMode === CSRF_REQUIRED
        // Check action-level cache: an action exporting `skipCsrf: true`
        // means we should NOT inject the middleware at all (rather than
        // injecting it and having it self-bail). Skipping at injection
        // time avoids the import + parse cost of csrf.ts entirely on
        // hot webhook paths.
        const actionSkipped = directActionSkipsCsrf
          || (handlerKey ? actionSkipsCsrfCache.get(handlerKey) === true : false)
        // Decision order (stacksjs/stacks#1870 R-9):
        //   1. `.requireCsrf()` on the route wins over EVERYTHING — used to
        //      re-enable CSRF for a browser-facing route that shares an
        //      action with API/webhook routes that legitimately skip.
        //   2. Otherwise the union of the route- and action-level skip
        //      flags decides — either one is enough to bypass.
        shouldInjectCsrf = !alreadyHasCsrf && (routeRequired || (!routeSkipped && !actionSkipped))
      }

      // Only build a chain when there is one to build. A route with no
      // middleware and no CSRF injection - every GET that is not behind auth -
      // used to copy an empty array before sorting and walking it. When
      // nothing is prepended this aliases the registry's own array, which is
      // read-only from here on.
      const middlewareEntries: readonly string[] = shouldInjectCsrf
        ? (userMiddleware.length === 0 ? CSRF_ONLY_MIDDLEWARE : ['csrf', ...userMiddleware])
        : userMiddleware

      let middlewareTimings: MiddlewareTiming[] = EMPTY_MIDDLEWARE_TIMINGS
      if (middlewareEntries.length > 0) {
        // Only pay for pathname extraction when debug logging is actually on —
        // this runs per request on every middleware-bearing route. The level
        // gate mirrors `log.debug`'s own cheap-exit, and the cheap string slice
        // avoids a full `new URL()` parse on the hot path in production.
        if (isDebugLogging()) {
          const schemeEnd = req.url.indexOf('://')
          const pathStart = schemeEnd === -1 ? 0 : req.url.indexOf('/', schemeEnd + 3)
          const q = req.url.indexOf('?', pathStart < 0 ? 0 : pathStart)
          const urlPath = pathStart < 0 ? '/' : req.url.slice(pathStart, q === -1 ? undefined : q)
          log.debug(`[middleware] Executing chain: [${middlewareEntries.join(', ')}] for ${routeMethod} ${urlPath}`)
        }

        // Pre-resolve every entry to its handler + priority. Each
        // Middleware instance declares an optional `priority` (lower
        // runs earlier, default 10); without sorting, declared order
        // alone decides execution — which contradicts the Cors header
        // contract requiring CORS to precede auth/throttle so 4xx
        // responses still carry the right headers. See
        // stacksjs/stacks#1863, #1859 (H-1).
        const cachedCsrfOnlyMiddleware = middlewareEntries === CSRF_ONLY_MIDDLEWARE
          ? resolvedCsrfOnlyMiddleware
          : undefined
        const resolved: ResolvedMiddleware[] = cachedCsrfOnlyMiddleware ?? []
        const unresolvedEntries = cachedCsrfOnlyMiddleware ? EMPTY_MIDDLEWARE_ENTRIES : middlewareEntries
        for (const middlewareEntry of unresolvedEntries) {
          let resolvedEntry = resolvedMiddlewareEntryCache.get(middlewareEntry)
          if (!resolvedEntry) {
            const pending = parseMiddlewareEntry(middlewareEntry)
            const parsed = pending instanceof Promise ? await pending : pending
            const loaded = loadParsedMiddleware(parsed)
            const middleware = loaded instanceof Promise ? await loaded : loaded
            if (middleware && typeof middleware.handle === 'function') {
              const rawPriority = (middleware as { priority?: unknown }).priority
              let priority = DEFAULT_MIDDLEWARE_PRIORITY
              if (typeof rawPriority === 'number' && Number.isFinite(rawPriority) && rawPriority >= 0) {
                priority = rawPriority
              }
              else if (rawPriority !== undefined) {
                warnInvalidMiddlewarePriority(middlewareEntry, rawPriority)
              }
              resolvedEntry = {
                name: middlewareEntry,
                timingName: parsed.timingName,
                handler: middleware,
                priority,
                parameterName: parsed.params ? parsed.name : undefined,
                params: parsed.params,
              }
              resolvedMiddlewareEntryCache.set(middlewareEntry, resolvedEntry)
            }
          }

          if (!resolvedEntry) {
            // Fail CLOSED. The previous `continue` served the route WITHOUT
            // the middleware — a typo'd `auth` alias silently unprotected the
            // route. Every entry point (including dev hot-reload cache clears
            // and late package registrations) must get a 500 instead.
            // Boot-time validation (assertRouteMiddlewareResolvable) catches
            // these earlier and louder; this branch is the request-time
            // guarantee. See stacksjs/stacks#1957.
            log.error(`[Router] Middleware '${middlewareEntry}' on ${routeKey} could not be resolved - failing closed`)
            const failClosedError = new Error(`Middleware '${middlewareEntry}' could not be resolved`)
            const failClosedResponse = await createErrorResponse(failClosedError, enhancedReq, { status: 500 })
            return await applyCorsIfConfigured(enhancedReq, failClosedResponse)
          }

          // Store middleware params on request for middleware to access.
          // Params are keyed by middleware name so this is order-independent.
          if (resolvedEntry.params && resolvedEntry.parameterName) {
            ;enhancedReq._middlewareParams = enhancedReq._middlewareParams || {}
            ;enhancedReq._middlewareParams[resolvedEntry.parameterName] = resolvedEntry.params
          }
          resolved.push(resolvedEntry)
        }

        if (middlewareEntries === CSRF_ONLY_MIDDLEWARE && !cachedCsrfOnlyMiddleware && resolved.length === 1)
          resolvedCsrfOnlyMiddleware = resolved

        // Stable sort — V8 + Bun guarantee Array.sort is stable since 2018,
        // so same-priority entries preserve insertion order. This keeps
        // declared sequencing within a priority band predictable.
        if (resolved.length > 1)
          resolved.sort((a, b) => a.priority - b.priority)

        // Run middleware in priority order
        const collectsMiddlewareTimings = enhancedReq._startNs != null
        if (collectsMiddlewareTimings)
          middlewareTimings = []

      /*
       * One budget for the chain, armed at most once per request.
       *
       * A misbehaving middleware that hangs - waiting forever on a deadlocked
       * external service - used to lock the request handler indefinitely, so
       * every layer got a 30s `setTimeout` plus a `Promise.race`, set and
       * cleared per middleware per request. Under load that is a lot of timers
       * and event-loop wakeups for a guard that fires approximately never.
       *
       * The budget now belongs to the chain rather than to each layer: it is
       * created lazily by the first middleware that actually returns a promise,
       * reused by the rest, and cleared once. A chain that spends 29s across
       * three layers and then hangs in a fourth surfaces at 30s instead of
       * 120s, which is closer to what the client's own timeout does anyway.
       * A middleware that finishes synchronously never arms anything.
       */
        let chainTimer: ReturnType<typeof setTimeout> | undefined
        let chainBudget: Promise<never> | undefined
        let runningMiddleware = ''

        try {
          for (const { name: middlewareName, timingName, handler: middleware } of resolved) {
          // Per-middleware timing is appended to the request's Server-Timing
          // trail when the caller enabled timing by stamping `_startNs`.
          const mwStart = collectsMiddlewareTimings ? performance.now() : 0
          runningMiddleware = middlewareName
          try {
            const outcome = middleware.handle(enhancedReq)
            // Nothing to time out when the layer already finished. Arm the
            // shared chain budget only after the first asynchronous outcome.
            if (outcome && typeof (outcome as Promise<void>).then === 'function') {
              if (!chainBudget) {
                chainBudget = new Promise<never>((_, reject) => {
                  chainTimer = setTimeout(
                    () => reject(new Error(`Middleware '${runningMiddleware}' exceeded ${MIDDLEWARE_TIMEOUT_MS}ms`)),
                    MIDDLEWARE_TIMEOUT_MS,
                  )
                })
                // Marks the budget handled so a chain that finishes normally does not
                // leave an unhandled rejection behind when the timer eventually fires.
                chainBudget.catch(() => {})
              }
              await Promise.race([outcome as Promise<void>, chainBudget])
            }
            if (collectsMiddlewareTimings) {
              const elapsedMs = performance.now() - mwStart
              middlewareTimings.push({ name: timingName, ms: elapsedMs })
            }
          }
          catch (error) {
            // Even on a thrown middleware, record the timing so the
            // Server-Timing header on the error response is complete.
            // Without this, an auth-rejected 401 had no per-middleware
            // timings at all — making it impossible to tell from the
            // response whether the rejection was instant or hung first.
            if (collectsMiddlewareTimings) {
              const elapsedMs = performance.now() - mwStart
              middlewareTimings.push({ name: timingName, ms: elapsedMs })
            }
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
                  parts.push(`mw_${t.name};dur=${t.ms.toFixed(1)}`)
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
                parts.push(`mw_${t.name};dur=${t.ms.toFixed(1)}`)
              }
              if (parts.length > 0) errorResponse.headers.set('Server-Timing', parts.join(', '))
              if (reqId) errorResponse.headers.set('X-Request-ID', reqId)
            }
            catch { /* immutable headers — leave the response alone */ }
            return await applyCorsIfConfigured(enhancedReq, errorResponse)
          }
          }
        }
        finally {
          // One timer, cleared on every way out of the chain - including the
          // early returns above - so a settled request leaves nothing pending.
          if (chainTimer)
            clearTimeout(chainTimer)
        }
      }

      // Call the actual handler with the enhanced request.
      // `let` (not `const`) because the post-action CORS wrapper below may
      // replace it with a header-mutated copy when the original Response's
      // Headers are immutable.
      const baseResult = wrappedBase(enhancedReq)
      let response = baseResult instanceof Response ? baseResult : await baseResult

      // CSRF cookie seeding — on safe-method responses (GET/HEAD/OPTIONS),
      // attach a fresh `X-CSRF-Token` cookie when none is present so SPAs
      // and forms have a usable token to echo on the next unsafe request.
      // Without this, the default-on CSRF middleware rejected every
      // browser POST that lacked a Bearer-token bypass — the cookie was
      // read but never written. See stacksjs/stacks#1859 (CSRF
      // seeding INVESTIGATE → confirmed broken-by-default).
      if (response) {
        if (routeSeedsCsrf && !csrfHandledByOuter) {
          try {
            const mod = loadCsrfModule()
            const csrf = mod instanceof Promise ? await mod : mod
            if (csrf) {
              response = csrf.seedCsrfCookieIfMissing(
                enhancedReq as unknown as Request,
                response,
                // The value the render already embedded, when there was one.
                (enhancedReq as unknown as { _csrfToken?: string })._csrfToken,
              )
            }
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
      if (response && enhancedReq._corsConfig)
        response = await applyCorsIfConfigured(enhancedReq, response)

      // Echo X-Request-ID + Server-Timing on every response, AND stitch
      // the request_id into JSON error bodies so SPA error toasts can show
      // it (and bug reports can include it). For 4xx/5xx JSON responses
      // we rebuild the body once with `request_id` added; for 2xx/3xx we
      // only touch headers.
      const reqId = enhancedReq._requestId as string | undefined
      const startNs = enhancedReq._startNs as bigint | undefined
      const durMs = startNs != null ? Number(process.hrtime.bigint() - startNs) / 1_000_000 : null
      const after = enhancedReq._afterResponse
      const requested = enhancedReq._responseHeaders
      const frameworkMetadataApplied = response
        && (response as unknown as Record<symbol, unknown>)[FRAMEWORK_RESPONSE_METADATA_APPLIED] === true
      // Framework JSON responses already carry their request id and security
      // defaults from `formatJsonResult`. When no middleware requested later
      // work, leave the native Headers object untouched and avoid allocating
      // the post-processing closure on the dominant success path.
      const needsResponseMetadata = response && (
        response.status >= 400
        || Array.isArray(after)
        || (requested && typeof requested === 'object')
        || durMs != null
        || !frameworkMetadataApplied
      )

      if (needsResponseMetadata && typeof response.headers?.set === 'function') {
        const setHeaders = (h: Headers) => {
          /*
           * Headers a middleware asked to have on the response.
           *
           * The middleware pipeline is pre-action only, so a middleware that has
           * something to say *about the answer* - a rate limit's remaining count,
           * a cache verdict, a deprecation notice - had nowhere to put it.
           * Compression got a hard-coded post-action wrapper keyed on a
           * `_compress` marker; everything else got nothing, and the workaround
           * in an app is to wrap every action.
           *
           * So: a middleware writes `request._responseHeaders`, and they land
           * here, before the router's own. The router's win a collision on
           * purpose - `X-Request-ID` and `Server-Timing` are this layer's to
           * state, and a middleware overwriting them breaks correlation.
           */
          /*
           * Callbacks a middleware asked to run once the answer is known.
           *
           * The header seam covers "put this on the response"; this covers
           * "record that this happened", which is the other half of what a
           * pre-action pipeline cannot do. Metrics are the obvious case: a
           * middleware can time the start of a request and has no way to learn
           * the status or the duration without one of these.
           *
           * Failures are swallowed on purpose. A metrics callback that throws
           * must not turn a served request into a 500 - the observation is worth
           * less than the thing being observed.
           */
          if (Array.isArray(after)) {
            for (const callback of after) {
              try {
                if (typeof callback === 'function')
                  callback({ status: response.status, durationMs: durMs ?? 0 })
              }
              catch { /* an observation is worth less than the request it observes */ }
            }
          }

          if (requested && typeof requested === 'object') {
            for (const [name, value] of Object.entries(requested as Record<string, unknown>)) {
              if (typeof value === 'string')
                h.set(name, value)
            }
          }

          if (reqId && !frameworkMetadataApplied) h.set('X-Request-ID', reqId)
          if (durMs != null) {
            let timing = `total;dur=${durMs.toFixed(1)}`
            // Append per-middleware timing entries. Chrome's network
            // panel shows these as a stacked timeline under the response.
            for (const t of middlewareTimings) {
              timing += `, mw_${t.name};dur=${t.ms.toFixed(1)}`
            }
            h.set('Server-Timing', timing)
          }
          if (!frameworkMetadataApplied)
            applySecurityHeaders(h)
        }

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
          const { applyCompression } = await import(resolveDefaultsPath('app/Middleware/Compress.ts'))
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
/**
 * A chain for a registration that will never serve.
 *
 * Returned instead of the real chain when a duplicate `METHOD:/path` is
 * registered (stacksjs/stacks#2332). Every method is a no-op, so
 * `.middleware('auth')` or `.skipCsrf()` written against a dead duplicate
 * cannot reach the live route's registries. Chainable, so calling code is
 * unchanged.
 */
function createInertRoute(): ChainableRoute {
  // Not cast: the annotation makes TypeScript fail here if `ChainableRoute`
  // grows a member, rather than letting a new one silently reach the live
  // route from a dead duplicate.
  const inert: ChainableRoute = {
    middleware: () => inert,
    name: () => inert,
    skipCsrf: () => inert,
    requireCsrf: () => inert,
    rateLimit: () => inert,
  }

  return inert
}

function createChainableRoute(routeKey: string, shadowed = false): ChainableRoute {
  if (shadowed)
    return createInertRoute()

  // Initialize middleware list for this route
  if (!routeMiddlewareRegistry.has(routeKey)) {
    routeMiddlewareRegistry.set(routeKey, [])
  }

  // Extract the path from routeKey (format: "METHOD:/path")
  const routePath = routeKey.includes(':') ? routeKey.substring(routeKey.indexOf(':') + 1) : routeKey
  const routeCsrf = routeCsrfRegistry.get(routeKey)
  const routeRateLimit = routeRateLimitRegistry.get(routeKey)

  const chain: ChainableRoute = {
    /**
     * Attach one middleware alias, or several.
     *
     * The array form is accepted because it is the obvious way to write a
     * route with two guards, and it used to be a trap: the array was pushed
     * whole, the reference parser found no colon in it, and the failure
     * surfaced at boot as `input.split is not a function` from inside a case
     * converter — an error that names nothing about routes or middleware and
     * sends the reader into the router's internals.
     *
     * A non-string entry throws by name for the same reason. This runs at
     * registration, before anything is served, so a loud throw here is the
     * cheapest possible place to learn about it.
     */
    middleware(name: MiddlewareReference | readonly MiddlewareReference[]) {
      const middlewareList = routeMiddlewareRegistry.get(routeKey)
      if (!middlewareList)
        return chain

      for (const entry of Array.isArray(name) ? name : [name]) {
        if (typeof entry !== 'string') {
          throw new TypeError(
            `[Router] middleware() on ${routeKey} was given a ${typeof entry}; it takes an alias or an array of aliases`,
          )
        }
        middlewareList.push(entry)
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
      // Last call wins, so skip and require remain mutually exclusive.
      if (routeCsrf)
        routeCsrf.mode = CSRF_SKIPPED
      return chain
    },

    requireCsrf() {
      // Forced-on mode overrides the action-level skip cache.
      if (routeCsrf)
        routeCsrf.mode = CSRF_REQUIRED
      return chain
    },

    rateLimit(max, window) {
      // Resolve at registration time so a typo (e.g. .rateLimit(5, 'minutes'))
      // throws on boot, not on the first 429. The check is read once per
      // request in createMiddlewareHandler. The handler retains this state so
      // routes that did not opt in avoid a registry lookup.
      if (!Number.isFinite(max) || max <= 0) {
        throw new Error(`[Router] .rateLimit(): max must be a positive number, got ${String(max)}`)
      }
      const windowSeconds = rateLimitWindowToSeconds(window)
      if (routeRateLimit)
        routeRateLimit.config = { max: Math.floor(max), windowSeconds }
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

// Resolved-handler cache. A string handler resolves to an immutable
// RouteHandlerFn (module is import-cached, the action wrapper is rebuilt the
// same way every time), so resolving it once per route and reusing the result
// removes a per-request `fileExists` stat + closure allocation from the single
// hottest path. Shares a promise while loading, then stores the function so
// warm requests need no resolution await. Evicts on rejection for retries.
// Same lifetime as `cachedImport` — a dev hot-reload restarts the process and
// clears both, so this never serves a stale handler.
const _resolvedHandlerCache = new Map<string, RouteHandlerFn | Promise<RouteHandlerFn>>()
function resolveStringHandler(handlerPath: string): RouteHandlerFn | Promise<RouteHandlerFn> {
  let resolved = _resolvedHandlerCache.get(handlerPath)
  if (!resolved) {
    resolved = resolveStringHandlerUncached(handlerPath).then((handler) => {
      _resolvedHandlerCache.set(handlerPath, handler)
      return handler
    }, (error) => {
      _resolvedHandlerCache.delete(handlerPath)
      throw error
    })
    _resolvedHandlerCache.set(handlerPath, resolved)
  }
  return resolved
}

/**
 * Resolve a string handler to an actual handler function
 * Supports user overrides: checks user's app/ first, then falls back to defaults
 */
/**
 * The one 422 body a failed `validations:` block produces.
 *
 * This path used to hand-build `{ error: 'Validation failed', errors }`, which
 * made it the only error response in the framework without a `message`. Every
 * other one — `response.error()`, `unauthorized()`, `forbidden()`,
 * `notFound()`, and `validationError()` itself — goes through bun-router's
 * `response.error`, which emits `{ success: false, message, errors }`. So a
 * client correctly reading `data.message` got `undefined` for the one response
 * type forms hit most, and showed its own fallback string instead: a 5-character
 * password on `/login` reported "Invalid email or password" for a 422
 * (stacksjs/stacks#2227).
 *
 * Delegating rather than hand-building is the point: the envelope is defined in
 * exactly one place, so this path cannot drift from it again. A named helper
 * rather than an inline call so `createValidationErrorResponse` in
 * `error-handler.ts` — a third shape, nesting `errors` under `details` — has an
 * obvious thing to be reconciled with.
 */
function validationFailureResponse(errors: Record<string, string[]>): Response {
  return response.validationError(errors) as Response
}

/**
 * Whether this request is asking "would this be accepted?" rather than
 * "do this" (stacksjs/stacks#2226).
 *
 * An Action's `validations:` block was a server-only artifact: nothing could
 * read it from a template or a client script, so every form in every app
 * retyped the rules in the browser and the two copies drifted. The framework's
 * own defaults demonstrated it — the browser refused a 7-character password
 * that `POST /register` would have accepted.
 *
 * Rather than serialise the rules (a `schema.*` chain is a live object with
 * no faithful JSON projection), the client asks the real endpoint to run the
 * real rules and stops short of the side effect. Same shape as Laravel
 * Precognition, and deliberately header-compatible with it.
 *
 * `?_validate=1` is accepted too: a header cannot be set on a plain form
 * submission or a `<script client>` block using a bare fetch shorthand, and
 * requiring one would have put this out of reach of the simplest caller.
 */
export function precognitionRequest(req: EnhancedRequest): { only: string[] } | null {
  const header = req.headers?.get?.('Precognition')
  const viaHeader = typeof header === 'string' && header.toLowerCase() === 'true'

  let viaQuery = false
  try {
    // Ordinary action requests have no query to inspect. A true header also
    // settles the decision without parsing the URL again.
    if (!viaHeader && req.url.includes('?'))
      viaQuery = new URL(req.url).searchParams.get('_validate') === '1'
  }
  catch {
    viaQuery = false
  }

  if (!viaHeader && !viaQuery)
    return null

  // `Precognition-Validate-Only: email,password` narrows the run to the fields
  // the form has actually touched, which is what makes validate-on-blur usable:
  // without it, blurring the first field reports every later field as empty.
  const only = (req.headers?.get?.('Precognition-Validate-Only') ?? '')
    .split(',')
    .map(field => field.trim())
    .filter(Boolean)

  return { only }
}

/**
 * The "nothing to report" answer to a precognition request. 204 rather than an
 * empty 200 so a client cannot mistake it for the action's real result.
 *
 * `Vary` because the same URL and method now has two different answers
 * depending on a request header — without it a shared cache is entitled to
 * serve this 204 to a caller that meant to submit.
 */
export function precognitionSuccess(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Precognition': 'true',
      'Precognition-Success': 'true',
      'Vary': 'Precognition, Precognition-Validate-Only',
    },
  })
}

/**
 * The generated action registry: action path to file, resolved absolute.
 *
 * The same map `ActionPath` is `keyof`'d from, so a handler string that
 * type-checks is one that resolves. Null when the file is absent, and the
 * path-probing below runs instead.
 */
let actionRegistryPromise: Promise<Record<string, string> | null> | null = null

async function getActionRegistry(): Promise<Record<string, string> | null> {
  if (actionRegistryPromise)
    return actionRegistryPromise

  actionRegistryPromise = (async () => {
    try {
      const dir = p.storagePath('framework/auto-imports')
      const module = await import(`${dir}/actions.ts`) as { actions?: Record<string, string> }
      if (!module.actions)
        return null

      const { resolve } = await import('node:path')

      return Object.fromEntries(
        Object.entries(module.actions).map(([name, file]) => [name, resolve(dir, file)]),
      )
    }
    catch {
      return null
    }
  })()

  return actionRegistryPromise
}

async function resolveStringHandlerUncached(handlerPath: string): Promise<RouteHandlerFn> {
  assertSafeHandlerPath(handlerPath)
  let modulePath = handlerPath

  // Remove trailing .ts if present
  modulePath = modulePath.endsWith('.ts') ? modulePath.slice(0, -3) : modulePath

  // Handle controller-based routing (e.g., 'Controllers/MyController@method')
  if (modulePath.includes('Controller')) {
    const [controllerPath, methodName = 'index'] = modulePath.split('@')

    // Try user path first, then fall back to defaults
    const userPath = p.appPath(`${controllerPath}.ts`)
    const defaultPath = resolveDefaultsPath(`app/${controllerPath}.ts`)
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
    // The registry first: it already encodes the app-over-defaults override,
    // it is the same list the compiler checked the handler string against, and
    // it works inside a compiled binary where probing source paths does not.
    const registered = (await getActionRegistry())?.[modulePath]

    if (registered) {
      fullPath = registered
    }
    else {
      // Try user path first, then fall back to defaults
      const userPath = p.projectPath(`app/${modulePath}.ts`)
      const defaultPath = resolveDefaultsPath(`app/${modulePath}.ts`)
      fullPath = await fileExists(userPath) ? userPath : defaultPath
    }
  }
  else {
    // Generic app path - try user first, then defaults
    const userPath = p.appPath(`${modulePath}.ts`)
    const defaultPath = resolveDefaultsPath(`app/${modulePath}.ts`)
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

    return wrapAction(action, handlerPath)
  }
  catch (importError) {
    log.error(`[Router] Failed to import action '${fullPath}':`, importError)
    throw importError
  }
}

/**
 * Anything the router is willing to treat as an action.
 *
 * Structural rather than `instanceof Action`, because an action can also be a
 * plain object with a `handle()` - the framework's own defaults include both
 * shapes - and because a duplicated install would make an `instanceof` check
 * reject a perfectly good action from the other copy of the package.
 */
export interface RouterAction {
  handle: (req: any) => unknown
  validations?: ActionValidations
  authorize?: (req: any) => unknown
  before?: (req: any) => unknown
  skipCsrf?: boolean
  csrf?: boolean
  apiResponse?: boolean
  model?: unknown
  modelDefinition?: unknown
  name?: string
  responses?: unknown
  responseHeaders?: unknown
  requestHeaders?: unknown
}

/** Whether a route handler is an action rather than a plain function. */
export function isRouterAction(handler: unknown): handler is RouterAction {
  return typeof handler === 'object'
    && handler !== null
    && typeof (handler as RouterAction).handle === 'function'
}

/**
 * Turn a resolved action into the function the route actually runs.
 *
 * Split out of the string-resolution path so registering an action by import
 * (`createTypedRouter().get('/x', ShowAction)`) and registering it by name
 * (`route.get('/x', 'Actions/ShowAction')`) share one runtime path. The two
 * forms differ only in when the module is loaded and in what the compiler can
 * see; everything below - validation, precognition, `authorize`, `before`,
 * result formatting, error reporting - is the same code for both.
 *
 * `handlerKey` identifies the action for the CSRF skip cache and for error
 * labels. It is the handler string when there is one, and the route key
 * otherwise.
 */
export function wrapAction(action: RouterAction, handlerKey: string): RouteHandlerFn {
  // Action-level CSRF opt-out flag. Read once at resolve time and
  // memoize against the original handler path so the CSRF gate can
  // skip lookups without re-importing the action on every request.
  // Accept both spellings: `skipCsrf: true` (intent-explicit) and
  // `csrf: false` (group-config-shaped).
  const actionSkipsCsrf = action.skipCsrf === true || action.csrf === false
  actionSkipsCsrfCache.set(handlerKey, actionSkipsCsrf)

  // Action-level apiResponse: when `true`, force JSON responses for this
  // route regardless of content negotiation. Wins over the group-level
  // flag (which `createMiddlewareHandler` already applied).
  const actionForcesJson = action.apiResponse === true

  /*
   * The rules `request.validate()` falls back to, derived once.
   *
   * An action with a model attached and no explicit `validations` gets its
   * rules by reflecting over `Object.entries(model.attributes)` - and that
   * was happening per request, for an action object that does not change
   * between them. Every default `useApi`-generated CRUD action pays it, on
   * every call, to rebuild the same object.
   */
  const requestValidationRules = action.validations
    ?? modelValidationRules(action.modelDefinition ?? action.model)
  const actionValidationEntries = action.validations
    ? Object.entries(action.validations)
    : undefined

  const prepareRequest = (req: EnhancedRequest): Response | undefined => {
    // A precognition request answers "would this be accepted?" and must
    // never reach handle(). An action with no validations still returns early:
    // running the handler because there was nothing to check would make
    // the probe itself the side effect (#2226).
    const precognition = precognitionRequest(req)
    if (precognition) {
      if (!action.validations)
        return precognitionSuccess()

      const rules = precognition.only.length > 0
        ? Object.fromEntries(
            Object.entries(action.validations).filter(([field]) => precognition.only.includes(field)),
          )
        : action.validations

      const precognitionResult = validateActionInputSync(
        req,
        rules,
        rules === action.validations ? actionValidationEntries : undefined,
      )
      return precognitionResult.valid
        ? precognitionSuccess()
        : validationFailureResponse(precognitionResult.errors)
    }

    if (action.validations) {
      const validationResult = validateActionInputSync(req, action.validations, actionValidationEntries)
      if (!validationResult.valid)
        return validationFailureResponse(validationResult.errors)
    }
  }

  const rethrowActionError = (handleError: unknown): never => {
    report(handleError, { label: `[Router] action.handle() for '${handlerKey}'` })
    throw handleError
  }

  if (typeof action.authorize !== 'function' && typeof action.before !== 'function') {
    return (req: EnhancedRequest) => {
      if (actionSkipsCsrf)
        req._skipCsrf = true
      if (actionForcesJson)
        req._forceJson = true
      req._requestValidationRules = requestValidationRules

      try {
        const earlyResponse = prepareRequest(req)
        if (earlyResponse)
          return earlyResponse

        const result = action.handle(req)
        return result instanceof Promise
          ? result.then(value => formatResult(value, req)).catch(rethrowActionError)
          : formatResult(result, req)
      }
      catch (handleError) {
        return rethrowActionError(handleError)
      }
    }
  }

  return async (req: EnhancedRequest) => {
    if (actionSkipsCsrf) {
      ;req._skipCsrf = true
    }
    if (actionForcesJson) {
      ;req._forceJson = true
    }
    ;req._requestValidationRules = requestValidationRules
    try {
      const earlyResponse = prepareRequest(req)
      if (earlyResponse)
        return earlyResponse

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
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      // `before` runs after authorize; returning a Response still
      // short-circuits, returning void continues into `handle()`.
      if (typeof action.before === 'function') {
        const pre = await action.before(req)
        if (pre instanceof Response) return pre
      }

      const pendingResult = action.handle(req)
      const result = pendingResult instanceof Promise ? await pendingResult : pendingResult
      return formatResult(result, req)
    }
    catch (handleError) {
      return rethrowActionError(handleError)
    }
  }
}

// `ActionValidations` and `ValidationResult` are imported from
// `@stacksjs/actions` — they're a single source of truth, owned by the
// actions package. The previous local copies here drifted out of sync
// during the #1865 typed-request work (stacksjs/stacks#1870 R-3).

/**
 * Run an action's declarative `validations:` against the request.
 *
 * The action path uses this synchronous core because input collection and the
 * validator contract are synchronous. The exported wrapper below stays
 * Promise-based for compatibility with callers that chain or await it.
 */
type ActionValidationEntry = [string, ActionValidations[string]]

function validateActionInputSync(
  req: EnhancedRequest,
  validations: ActionValidations,
  compiledEntries?: ActionValidationEntry[],
): ValidationResult {
  const errors: Record<string, string[]> = {}
  const validated: Record<string, unknown> = {}
  let valid = true
  const entries = compiledEntries ?? Object.entries(validations)

  // Pass `validations` so wire-stringified path/query values get coerced
  // to the type the rule expects before they're tested. Without this,
  // `schema.number()` on a path-param `id` 422s on every request because
  // the URL delivers `"1"` not `1` and ts-validation's NumberValidator is
  // a strict `typeof value === 'number'` check. See stacksjs/stacks#1865.
  const input = getRequestInput(req, entries)

  for (const [field, validation] of entries) {
    const value = input[field]
    let result: { valid: boolean, errors?: Array<{ message: string }> }

    try {
      result = validation.rule.validate(value)
    }
    catch {
      result = { valid: false, errors: [{ message: `${field} validation failed` }] }
    }

    if (!result.valid) {
      valid = false
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
    else if (value !== undefined) {
      validated[field] = value
    }
  }

  /*
   * Record what passed, so `request.getValidated()` and `request.safe()` have
   * something to return.
   *
   * They are Laravel's `$request->validated()` under different names, and they
   * returned `{}` after a request the router had just validated: the only way
   * to populate them was to call `request.validate()` again inside the handler,
   * redoing work that had already been done a few frames up. Meanwhile the
   * declared return type promised the validated fields, so a handler reading
   * `getValidated().email` type-checked and got `undefined`.
   *
   * Only the declared fields, and only the ones actually present - an absent
   * optional field is absent here too, which matches both Laravel and the
   * optional keys the inferred type now produces. The values are the coerced
   * ones the rules were tested against, not the raw wire strings.
   */
  if (valid) {
    ;(req as EnhancedRequest & { _validatedInput?: Record<string, unknown> })._validatedInput = validated
  }

  return {
    valid,
    errors,
  }
}

export async function validateActionInput(req: EnhancedRequest, validations: ActionValidations): Promise<ValidationResult> {
  return validateActionInputSync(req, validations)
}

function modelValidationRules(model: any): ActionValidations | undefined {
  if (!model?.attributes || typeof model.attributes !== 'object')
    return

  const rules: ActionValidations = {}
  for (const [field, attribute] of Object.entries(model.attributes)) {
    const validation = (attribute as { validation?: ActionValidations[string] } | null | undefined)?.validation
    if (validation?.rule)
      rules[field] = validation
  }
  return Object.keys(rules).length > 0 ? rules : undefined
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
function getRequestInput(
  req: EnhancedRequest,
  validationEntries?: ActionValidationEntry[],
): Record<string, unknown> {
  let input: Record<string, unknown> = {}
  let mayNeedCoercion = false

  // Get query parameters (always strings on the wire). Leave bun-router's
  // lazy query accessor untouched when the URL has no query string. When one
  // is present, reuse the parsed `req.query`; only fall back to `new URL()` if
  // this runs before enhancement (the action path always enhances first).
  if (req.url.includes('?')) {
    const q = req.query
    if (q) {
      for (const key in q) {
        input[key] = q[key]
        mayNeedCoercion = true
      }
    }
    else {
      const url = new URL(req.url)
      url.searchParams.forEach((value, key) => {
        input[key] = value
        mayNeedCoercion = true
      })
    }
  }

  // Get route params if available (also strings — bun-router doesn't
  // know the route-pattern type)
  let hasRouteParams = false
  if (req.params) {
    for (const key in req.params) {
      if (!Object.hasOwn(req.params, key)) continue
      input[key] = req.params[key]
      hasRouteParams = true
      mayNeedCoercion = true
    }
  }

  // Use already-parsed body (from parseRequestBody) if available
  if (req.jsonBody && typeof req.jsonBody === 'object') {
    input = mayNeedCoercion
      ? Object.assign(input, req.jsonBody)
      : { ...req.jsonBody }
  }
  else if (req.formBody && typeof req.formBody === 'object') {
    input = mayNeedCoercion
      ? Object.assign(input, req.formBody)
      : { ...req.formBody }
    mayNeedCoercion = true
  }

  // Merge multipart files so file-shaped validations
  // (`schema.file().image().maxBytes(...)`) see the `UploadedFile`
  // instance under its field name. Body wins on collision — text
  // fields and file uploads sharing a name is a pathological case the
  // caller should disambiguate, and silently overwriting the body
  // value with the file would be more surprising than the reverse.
  // (stacksjs/stacks#1856)
  if (req.files && typeof req.allFiles === 'function') {
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

  if (!validationEntries)
    return input

  // Coerce string values when the rule expects a non-string primitive.
  // Path/query params are always strings on the wire; body-sourced
  // values were already typed by the JSON parser, so `typeof value !==
  // 'string'` skips them naturally. Form-body fields are still strings
  // (multipart wire format) — same code path covers them.
  let coerced = false
  if (mayNeedCoercion) {
    for (const [field, validation] of validationEntries) {
      const value = input[field]
      if (typeof value !== 'string') continue

      const validatorName = (validation.rule as { name?: string })?.name
      if (validatorName === 'number') {
        // `Number.isFinite()` guard so malformed inputs (`"abc"`,
        // `"NaN"`, `"Infinity"`) stay as strings — the validator then
        // emits its natural "Must be a number" error rather than us
        // swallowing the bad value as 0.
        const n = Number(value)
        if (Number.isFinite(n)) {
          input[field] = n
          coerced = true
        }
      }
      else if (validatorName === 'boolean') {
        if (value === 'true' || value === '1') {
          input[field] = true
          coerced = true
        }
        else if (value === 'false' || value === '0') {
          input[field] = false
          coerced = true
        }
      }
    }
  }

  if (
    !coerced
    && !req.formBody
    && !req.files
    && !hasRouteParams
  ) {
    ;req._allInputCache = input
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

  // Objects + arrays always serialize as JSON regardless of negotiation —
  // there's no reasonable HTML representation of `{id: 1}`, and userland
  // that wants HTML should return a `new Response(html, …)` directly.
  if (result !== null && typeof result === 'object') {
    // Paginator auto-serialize (stacksjs/stacks#1908 P4). When the
    // action returns a canonical Paginator / SimplePaginator /
    // CursorPaginator, emit `Link: <prev>; rel="prev", <next>; rel="next"`
    // alongside the JSON body — HATEOAS for REST clients + crawlers
    // who'd otherwise have to dig through the body to find next/prev.
    const linkHeader = 'data' in result ? buildPaginatorLinkHeader(result) : null
    return formatJsonResult(result, req, linkHeader)
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

  // Primitives: JSON-encode for API requests so a string return lands as
  // `"ok"` with `application/json`, not `ok` with `text/plain`.
  if (apiShaped) {
    if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean')
      return formatJsonResult(result, req)
    return Response.json(result)
  }

  return new Response(String(result), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/** Serialize JSON once and make its size available to compression. */
function formatJsonResult(result: unknown, req: EnhancedRequest, linkHeader?: string | null): Response {
  const canPreapplyMetadata = !req._responseHeaders

  // Serialize once and publish the exact byte length so the server and the
  // compression wrapper do not have to consume and rebuild the response
  // stream. Count UTF-8 bytes, not JavaScript characters; a custom toJSON may
  // also produce an empty body.
  const body = JSON.stringify(result) ?? ''
  const response = canPreapplyMetadata
    ? secureSerializedJsonResponse(body)
    : new Response(body, { headers: createJsonSecurityHeaders() })
  response.headers.set('Content-Length', String(Buffer.byteLength(body)))
  if (linkHeader)
    response.headers.set('Link', linkHeader)
  if (canPreapplyMetadata) {
    if (req._requestId)
      response.headers.set('X-Request-ID', req._requestId)
    ;(response as unknown as Record<symbol, unknown>)[FRAMEWORK_RESPONSE_METADATA_APPLIED] = true
  }
  return response
}

/**
 * Build the RFC 5988 `Link` header from a paginator return value, or
 * return `null` when the value isn't paginator-shaped (so the caller
 * skips the header entirely). stacksjs/stacks#1908 P4.
 *
 * Both `prev_page_url` and `next_page_url` are surfaced when present —
 * matches what REST clients (jsonapi.org consumers, HAL, openapi-fetch)
 * expect from a paginated collection.
 */
function buildPaginatorLinkHeader(value: unknown): string | null {
  if (!isPaginator(value) && !isSimplePaginator(value) && !isCursorPaginator(value))
    return null
  const v = value as { prev_page_url?: string | null, next_page_url?: string | null, first_page_url?: string, last_page_url?: string }
  const parts: string[] = []
  if (v.prev_page_url) parts.push(`<${v.prev_page_url}>; rel="prev"`)
  if (v.next_page_url) parts.push(`<${v.next_page_url}>; rel="next"`)
  if (v.first_page_url) parts.push(`<${v.first_page_url}>; rel="first"`)
  if (v.last_page_url) parts.push(`<${v.last_page_url}>; rel="last"`)
  return parts.length > 0 ? parts.join(', ') : null
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

// Per-request merged input: query + JSON body + form body + route params, in
// that precedence order (later sources win). Memoized on the request via
// `_allInputCache` so repeated `req.all()/get()/input()` calls don't re-merge.
// A standalone function (not a per-request closure) so the request helpers
// below can be shared module-level functions rather than re-allocated per
// request.
function getAllInputFor(req: EnhancedRequest): Record<string, unknown> {
  const cached = req._allInputCache as Record<string, unknown> | undefined
  if (cached)
    return cached

  const input: Record<string, unknown> = {}
  const query = req.query as Record<string, unknown> | undefined
  if (query) {
    for (const key in query) input[key] = query[key]
  }
  if (req.jsonBody && typeof req.jsonBody === 'object')
    Object.assign(input, req.jsonBody)
  if (req.formBody && typeof req.formBody === 'object')
    Object.assign(input, req.formBody)
  if (req.params && typeof req.params === 'object')
    Object.assign(input, req.params)

  ;req._allInputCache = input
  return input
}

function flashInputFor(req: EnhancedRequest, keys?: string[]): void {
  const input = getAllInputFor(req)
  ;req._oldInput = keys
    ? Object.fromEntries(keys.filter(key => key in input).map(key => [key, input[key]]))
    : { ...input }
}

const nativeRequestText = Request.prototype.text
const nativeRequestJson = Request.prototype.json
const nativeRequestBytes = Request.prototype.bytes
const nativeRequestArrayBuffer = Request.prototype.arrayBuffer
const nativeRequestBlob = Request.prototype.blob
const nativeRequestClone = Request.prototype.clone
const requestBodyEncoder = new TextEncoder()

// Shared implementations of the Laravel-style request helpers. Assigned onto
// each request by a single `Object.assign` (reference copy) instead of
// allocating ~25 fresh closures per request — all per-request state lives on
// the request object, so each method reads it through `this`. `ThisType`
// types `this` as the request inside every method.
const REQUEST_METHODS: Record<string, (...args: any[]) => any> & ThisType<EnhancedRequest> = {
  text() {
    return this._rawBody === undefined
      ? nativeRequestText.call(this)
      : Promise.resolve(this._rawBody)
  },
  json() {
    if (this._rawBody === undefined)
      return nativeRequestJson.call(this)
    try {
      return Promise.resolve(this._rawBody.length === 0 ? null : JSON.parse(this._rawBody))
    }
    catch (error) {
      return Promise.reject(error)
    }
  },
  bytes() {
    return this._rawBody === undefined
      ? nativeRequestBytes.call(this)
      : Promise.resolve(requestBodyEncoder.encode(this._rawBody))
  },
  arrayBuffer() {
    if (this._rawBody === undefined)
      return nativeRequestArrayBuffer.call(this)
    const bytes = requestBodyEncoder.encode(this._rawBody)
    return Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  },
  blob() {
    return this._rawBody === undefined
      ? nativeRequestBlob.call(this)
      : Promise.resolve(new Blob([this._rawBody], { type: this._rawBodyContentType }))
  },
  clone() {
    if (this._rawBody === undefined)
      return nativeRequestClone.call(this)
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      body: this._rawBody,
    })
  },
  get(key: string, defaultValue?: any) {
    const input = getAllInputFor(this)
    const value = input[key]
    return value !== undefined ? value : defaultValue
  },
  input(key: string, defaultValue?: any) {
    const input = getAllInputFor(this)
    const value = input[key]
    return value !== undefined ? value : defaultValue
  },
  all() {
    return getAllInputFor(this)
  },
  only(keys: string[]) {
    const input = getAllInputFor(this)
    const result: Record<string, unknown> = {}
    for (const key of keys) {
      if (key in input)
        result[key] = input[key]
    }
    return result
  },
  except(keys: string[]) {
    const input = getAllInputFor(this)
    const result: Record<string, unknown> = { ...input }
    for (const key of keys) delete result[key]
    return result
  },
  has(key: string | string[]) {
    const input = getAllInputFor(this)
    if (Array.isArray(key))
      return key.every(k => k in input && input[k] !== undefined)
    return key in input && input[key] !== undefined
  },
  hasAny(keys: string[]) {
    const input = getAllInputFor(this)
    return keys.some(k => k in input && input[k] !== undefined)
  },
  filled(key: string | string[]) {
    const input = getAllInputFor(this)
    const isFilled = (k: string): boolean => {
      const value = input[k]
      return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
    }
    if (Array.isArray(key))
      return key.every(isFilled)
    return isFilled(key)
  },
  missing(key: string | string[]) {
    const input = getAllInputFor(this)
    if (Array.isArray(key))
      return key.every(k => !(k in input) || input[k] === undefined)
    return !(key in input) || input[key] === undefined
  },
  merge(data: Record<string, unknown>) {
    Object.assign(getAllInputFor(this), data)
  },
  keys() {
    return Object.keys(getAllInputFor(this))
  },
  string(key: string, defaultValue: string = '') {
    const input = getAllInputFor(this)
    const value = input[key]
    return value !== undefined && value !== null ? String(value) : defaultValue
  },
  // Strict numeric parsing: `Number.parseInt('123abc')` returns 123 silently,
  // so we require the entire string to be a valid number — trailing garbage
  // falls through to `defaultValue`.
  integer(key: string, defaultValue: number = 0) {
    const input = getAllInputFor(this)
    const value = input[key]
    if (value === undefined || value === null || value === '')
      return defaultValue
    if (typeof value === 'number')
      return Number.isFinite(value) ? Math.trunc(value) : defaultValue
    const str = String(value).trim()
    if (!/^-?\d+$/.test(str))
      return defaultValue
    const parsed = Number.parseInt(str, 10)
    return Number.isFinite(parsed) ? parsed : defaultValue
  },
  float(key: string, defaultValue: number = 0) {
    const input = getAllInputFor(this)
    const value = input[key]
    if (value === undefined || value === null || value === '')
      return defaultValue
    if (typeof value === 'number')
      return Number.isFinite(value) ? value : defaultValue
    const str = String(value).trim()
    if (!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(str))
      return defaultValue
    const parsed = Number.parseFloat(str)
    return Number.isFinite(parsed) ? parsed : defaultValue
  },
  boolean(key: string, defaultValue: boolean = false) {
    const input = getAllInputFor(this)
    const value = input[key]
    if (value === undefined || value === null)
      return defaultValue
    if (typeof value === 'boolean')
      return value
    if (value === 'true' || value === '1' || value === 1)
      return true
    if (value === 'false' || value === '0' || value === 0)
      return false
    return defaultValue
  },
  array(key: string) {
    const input = getAllInputFor(this)
    const value = input[key]
    if (Array.isArray(value))
      return value
    return value !== undefined && value !== null ? [value] : []
  },
  date(key: string) {
    const value = getAllInputFor(this)[key]
    if (value === undefined || value === null || value === '')
      return null
    const parsed = new Date(value as string | number | Date)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  },
  enum(key: string, enumType: Record<string, string | number>) {
    const value = getAllInputFor(this)[key]
    if (value === undefined || value === null)
      return null
    if (Object.values(enumType).includes(value as string | number))
      return value
    const enumKey = String(value)
    return enumKey in enumType ? enumType[enumKey] : null
  },
  collect(key: string) {
    const value = getAllInputFor(this)[key]
    if (Array.isArray(value))
      return collect(value)
    return collect(value === undefined || value === null ? [] : [value])
  },
  whenHas(key: string, callback: (value: unknown) => void, defaultCallback?: () => void) {
    const input = getAllInputFor(this)
    if (key in input && input[key] !== undefined)
      callback(input[key])
    else
      defaultCallback?.()
  },
  whenFilled(key: string, callback: (value: unknown) => void, defaultCallback?: () => void) {
    const input = getAllInputFor(this)
    const value = input[key]
    const filled = value !== undefined
      && value !== null
      && value !== ''
      && !(Array.isArray(value) && value.length === 0)
    if (filled)
      callback(value)
    else
      defaultCallback?.()
  },
  isValue(key: string, value: unknown) {
    return getAllInputFor(this)[key] === value
  },
  async validate(rules?: Record<string, any>, messages: Record<string, string> = {}) {
    const selectedRules = rules ?? (this)._requestValidationRules
    if (!selectedRules || Object.keys(selectedRules).length === 0) {
      const input = getAllInputFor(this)
      ;(this)._validatedInput = input
      return input
    }

    const normalized: Record<string, any> = {}
    for (const [field, definition] of Object.entries(selectedRules)) {
      if (typeof definition === 'string') {
        throw new TypeError(`String validation rules are not supported for "${field}". Use schema validators.`)
      }

      if (definition && typeof definition === 'object' && 'rule' in definition) {
        const message = messages[field]
        normalized[field] = message ? { ...definition, message } : definition
      }
      else {
        normalized[field] = definition
      }
    }

    const { validate } = await import('@stacksjs/validation')
    const validated = await validate(this, normalized)
    ;(this)._validatedInput = validated
    return validated
  },
  getValidated() {
    return (this)._validatedInput ?? {}
  },
  safe() {
    // The marker is `unknown` by design; this accessor is what gives the
    // validated payload a shape callers can read.
    const data = (this._validatedInput ?? {}) as Record<string, unknown>
    return {
      all: () => ({ ...data }),
      get: (key: string, defaultValue?: any) => key in data ? data[key] : defaultValue,
      only: (keys: string[]) => Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]])),
      except: (keys: string[]) => Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key))),
    }
  },
  old(key: string, defaultValue?: unknown) {
    const oldInput = (this)._oldInput as Record<string, unknown> | undefined
    return oldInput?.[key] ?? defaultValue
  },
  flashInput(keys?: string[]) {
    flashInputFor(this, keys)
  },
  flashInputOnly(keys: string[]) {
    flashInputFor(this, keys)
  },
  flashInputExcept(keys: string[]) {
    const input = getAllInputFor(this)
    ;(this)._oldInput = Object.fromEntries(
      Object.entries(input).filter(([key]) => !keys.includes(key)),
    )
  },
  // File handling — returns UploadedFile with store/storeAs methods.
  file(key: string) {
    const files = (this.files || {}) as Record<string, File | File[]>
    const file = files[key]
    if (!file)
      return null
    const rawFile = Array.isArray(file) ? file[0] : file
    return rawFile ? new UploadedFile(rawFile) : null
  },
  getFiles(key: string) {
    const files = (this.files || {}) as Record<string, File | File[]>
    const file = files[key]
    if (!file)
      return []
    const fileArray = Array.isArray(file) ? file : [file]
    return fileArray.map(f => new UploadedFile(f))
  },
  hasFile(key: string) {
    const files = (this.files || {}) as Record<string, File | File[]>
    return key in files && files[key] !== undefined
  },
  allFiles() {
    const files = (this.files || {}) as Record<string, File | File[]>
    const result: Record<string, UploadedFile | UploadedFile[]> = {}
    for (const [key, value] of Object.entries(files)) {
      if (Array.isArray(value))
        result[key] = value.map(f => new UploadedFile(f as File))
      else
        result[key] = new UploadedFile(value as File)
    }
    return result
  },
  getParams() {
    return { ...this.params }
  },
  isEmpty() {
    return Object.keys(getAllInputFor(this)).length === 0
  },
  browser() {
    return this.headers.get('sec-ch-ua') || this.headers.get('user-agent')
  },
  ipForRateLimit() {
    const ip = (this).ip
    if (typeof ip === 'function')
      return ip.call(this) || null
    return typeof ip === 'string' && ip ? ip : null
  },
  getMethod() {
    return this.method.toUpperCase()
  },
  // Auth — returns the authenticated user/token set by middleware.
  async user() {
    return this._authenticatedUser
  },
  async userToken() {
    return this._currentAccessToken
  },
  // Strict: a missing token, a token without an `abilities` array, or a
  // non-string ability all fail closed.
  async tokenCan(ability: string) {
    if (typeof ability !== 'string' || ability.length === 0)
      return false
    const token = this._currentAccessToken
    if (!token || typeof token !== 'object')
      return false

    // The access token's shape is project-defined, so it arrives as `unknown`
    // and is narrowed to the one field this checks.
    const abilities = (token as { abilities?: unknown }).abilities

    if (!Array.isArray(abilities))
      return false
    if (abilities.includes('*'))
      return true
    return abilities.includes(ability)
  },
  async tokenCant(ability: string) {
    return !(await this.tokenCan!(ability))
  },
  // Gate / Policy macros (stacksjs/stacks#1874 F-9). Lazy-import `@stacksjs/auth`
  // to dodge the router←auth cycle; resolve the user from `_authenticatedUser`,
  // passing `null` when missing so public-read policies still get a chance.
  async can(ability: string, ...args: unknown[]) {
    if (typeof ability !== 'string' || ability.length === 0)
      return false
    const { Gate } = await import('@stacksjs/auth')
    const user = (this._authenticatedUser as Parameters<typeof Gate.allows>[1]) ?? null
    return Gate.allows(ability, user, ...args)
  },
  async cannot(ability: string, ...args: unknown[]) {
    return !(await this.can!(ability, ...args))
  },
  // Throw-on-deny variant (Laravel's `$this->authorize(...)`). Throws
  // AuthorizationException (403) on deny.
  async authorize(ability: string, ...args: unknown[]) {
    const { Gate } = await import('@stacksjs/auth')
    const user = (this._authenticatedUser as Parameters<typeof Gate.authorize>[1]) ?? null
    await Gate.authorize(ability, user, ...args)
  },
}

const stacksRequestPrototypes = new WeakMap<object, object>()
const STACKS_REQUEST_ENHANCED = Symbol.for('stacks.router.requestEnhanced')

/**
 * Let bun-router install its macros and the Stacks helpers as one cached
 * prototype. The first request for a base prototype discovers the combined
 * shape through the normal paths; later requests attach that finished shape
 * directly, avoiding a second `Object.setPrototypeOf` on every dispatch.
 */
function fuseRequestEnhancements(router: Router): void {
  const original = router.enhanceRequest.bind(router)
  const combinedPrototypes = new WeakMap<object, object>()

  router.enhanceRequest = (request: Request, params: Record<string, string> = {}): EnhancedRequest => {
    const basePrototype = Object.getPrototypeOf(request) as object
    const combined = combinedPrototypes.get(basePrototype)
    if (combined) {
      const enhanced = request as EnhancedRequest
      if ('params' in request) {
        Object.defineProperty(enhanced, 'params', {
          value: params,
          writable: true,
          configurable: true,
          enumerable: false,
        })
      }
      else {
        enhanced.params = params
      }
      Object.setPrototypeOf(enhanced, combined)
      if (!enhanced._requestId)
        enhanced._requestId = incomingRequestId(enhanced) ?? crypto.randomUUID()
      return enhanced
    }

    const enhanced = enhanceRequest(original(request, params))
    combinedPrototypes.set(basePrototype, Object.getPrototypeOf(enhanced) as object)
    return enhanced
  }
}

// Decorate the incoming request with the helpers the framework's middleware
// and actions assume are always available. Names follow Laravel's convention
// because that's the API surface Stacks userland expects.
/**
 * Put a CSRF token where a server-rendered page can find it.
 *
 * The router seeds the cookie on the way *out*, which is fine for a
 * single-page app - it reads the cookie on its next request and echoes the
 * header. It is too late for a page that renders forms, because the page is
 * what has to embed the token and, on a visitor's very first request, it
 * renders before any cookie exists. Their first submit then fails CSRF, which
 * is the submit most likely to belong to somebody trying the product out.
 *
 * So a token is created here and appended to the request's own `cookie`
 * header, which is where a template reads cookies from. It is also recorded on
 * the request so the response seeding reuses this exact value: two independent
 * `randomBytes` calls would embed one token in the page and store a different
 * one in the browser, which fails in a way that looks identical to no token at
 * all.
 *
 * Safe methods only, and only when the request carries no token already.
 * Anything else is somebody's live session and must not have its token
 * rotated mid-flight.
 */
/**
 * The CSRF middleware module, resolved once.
 *
 * It used to be a `await import()` on the request path - three of them per GET,
 * counting the two response-side seedings - and while the module cache makes
 * the second import cheap, the promise, the property lookups and the
 * `resolveDefaultsPath` stat in front of it were all being paid per request for
 * a module whose identity is fixed at boot.
 *
 * Three states, and the distinction matters: `undefined` means nobody has
 * looked yet, `null` means this project ships no CSRF middleware and never
 * will, and a module means the fast path is available synchronously. Only the
 * first request through here awaits anything.
 */
interface CsrfModule {
  generateCsrfToken: () => string
  CSRF_COOKIE_NAME: string
  seedCsrfCookieIfMissing: (req: Request, res: Response, token?: string) => Response
}

let csrfModule: CsrfModule | null | undefined
let csrfModuleLoad: Promise<CsrfModule | null> | undefined

function loadCsrfModule(): CsrfModule | null | Promise<CsrfModule | null> {
  if (csrfModule !== undefined)
    return csrfModule

  csrfModuleLoad ??= import(resolveDefaultsPath('app/Middleware/Csrf.ts'))
    .then((mod) => {
      csrfModule = mod as CsrfModule
      return csrfModule
    })
    .catch(() => {
      // No CSRF middleware in this project's defaults. Nothing to seed, ever.
      csrfModule = null
      return null
    })

  return csrfModuleLoad
}

/** Test / hot-reload seam: forget the resolved module. */
export function clearCsrfModuleCache(): void {
  csrfModule = undefined
  csrfModuleLoad = undefined
}

function applyCsrfRenderToken(req: Request & { _csrfToken?: string }, cookieHeader: string, mod: CsrfModule): void {
  const token = mod.generateCsrfToken()
  req._csrfToken = token

  // Headers on an incoming Request are immutable in some runtimes, so a
  // failure here is not fatal: the response still seeds the cookie and the
  // next page load carries it. It only costs the very first submit.
  try {
    const merged = cookieHeader
      ? `${cookieHeader}; ${mod.CSRF_COOKIE_NAME}=${token}`
      : `${mod.CSRF_COOKIE_NAME}=${token}`
    req.headers.set('cookie', merged)
  }
  catch {
    // Immutable headers; the response seeding below still applies.
  }
}

/**
 * Returns a promise ONLY when it has to wait for the module's first load.
 * Every other call - the overwhelming majority - finishes synchronously, so
 * callers write `const seeding = seedCsrfTokenForRender(req); if (seeding) await seeding`
 * and a request that has nothing to seed never allocates a promise at all.
 */
function seedCsrfTokenForRender(req: Request & { _csrfToken?: string }, cookieHeader = req.headers?.get?.('cookie') ?? ''): void | Promise<void> {
  if (cookieHeader.includes('X-CSRF-Token=') || cookieHeader.includes('csrf-token='))
    return

  const mod = loadCsrfModule()
  if (mod === null)
    return
  if (mod instanceof Promise) {
    return mod.then((resolved) => {
      if (resolved)
        applyCsrfRenderToken(req, cookieHeader, resolved)
    })
  }

  applyCsrfRenderToken(req, cookieHeader, mod)
}

export function enhanceRequest(req: EnhancedRequest): EnhancedRequest {
  /*
   * Params arrive decoded. This used to decode them here, because the router
   * handed back the raw path segment - so `/users/{name}` given `caf%C3%A9`
   * reached a handler as `caf%C3%A9` unless something in between fixed it.
   *
   * bun-router 0.1.6 decodes at the two places it assigns a path param, which
   * is where it belongs: every consumer gets it, not just the ones that
   * remembered. Keeping this layer as well would mean decoding TWICE, and
   * `%2520` arriving as a space - a double decode is how a filter that rejects
   * `../` gets walked past. So the correct amount of work here is none.
   */
  const routeParams: Record<string, string> = req.params ?? {}

  req.params = routeParams

  /*
   * Every request gets an id.
   *
   * The router already echoed `X-Request-ID`, stitched it into JSON error
   * bodies, and used it as the implicit trace for downstream work - all of it
   * guarded on `_requestId` being set, and **nothing ever set it.** A complete
   * read path with no writer: the header never appeared, error bodies carried
   * no id, and every queued job logged under an id of its own.
   *
   * An inbound value is honoured, because correlating a request across a proxy
   * and two services is the entire point of having one. It is bounded and
   * filtered first: this string goes into log lines, and an unbounded one from
   * a stranger is log injection with extra steps.
   */
  if (!req._requestId)
    req._requestId = incomingRequestId(req) ?? crypto.randomUUID()

  if ((req as unknown as Record<symbol, unknown>)[STACKS_REQUEST_ENHANCED] === true)
    return req

  applyRequestEnhancements(req as unknown as Request, routeParams)

  /*
   * `query` comes from the router (bun-router 0.1.7), as a lazy accessor that
   * parses on first access and caches - so a request that never reads it still
   * costs nothing, which is what the fallback that used to live here was for.
   *
   * Keeping the fallback would be worse than redundant. It built a
   * `Record<string, string>` where a repeated key kept only the LAST value,
   * while the router collects `?a=1&a=2` into `['1', '2']` as the declared type
   * has always promised - so the shape of `req.query` would have depended on
   * which layer happened to fill it in.
   */

  // Put the shared Laravel-style helpers on one derived prototype instead of
  // copying every method onto every request. Keep bun-router's own shared
  // prototype untouched so code using it directly does not gain Stacks APIs.
  const routerPrototype = Object.getPrototypeOf(req) as object
  let stacksPrototype = stacksRequestPrototypes.get(routerPrototype)
  if (!stacksPrototype) {
    stacksPrototype = Object.assign(Object.create(routerPrototype) as object, REQUEST_METHODS)
    Object.defineProperty(stacksPrototype, STACKS_REQUEST_ENHANCED, { value: true })
    stacksRequestPrototypes.set(routerPrototype, stacksPrototype)
  }
  Object.setPrototypeOf(req, stacksPrototype)

  return req
}

/**
 * A request id supplied by the caller, if it is one we are willing to repeat.
 *
 * Accepted so a trace survives a proxy or a sibling service. Constrained
 * because it is written into logs verbatim: 8 to 200 characters of the
 * alphabet ids actually use. Anything else is ignored rather than rejected -
 * refusing a request over a malformed diagnostic header would turn a header
 * nobody needs into an outage.
 */
function incomingRequestId(req: EnhancedRequest): string | undefined {
  try {
    const supplied = req.headers?.get?.('x-request-id')?.trim()

    if (supplied && /^[\w.:-]{8,200}$/.test(supplied))
      return supplied
  }
  catch { /* a request with no readable headers is not worth failing over */ }

  return undefined
}

function wrapHandler(handler: StacksHandler, skipParsing = false, handlerKey = ''): RouteHandlerFn {
  // An action handed over directly is already resolved; there is nothing to
  // import and nothing to wait for.
  if (isRouterAction(handler))
    return wrapAction(handler, handlerKey)

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

        const pending = resolveStringHandler(handlerPath)
        const resolvedHandler = pending instanceof Promise ? await pending : pending
        // Must await to catch async errors in try-catch
        return await resolvedHandler(req)
      }
      catch (error) {
        // Single chokepoint (stacksjs/stacks#1933): 5xx + non-HTTP
        // throws log at error with full stack; thrown 4xx HttpErrors
        // are kept out of the error stream.
        report(error, { label: `[Router] ${handlerPath}` })
        // Extract a thrown 4xx/5xx status (HttpError + duck-typed shapes)
        // and forward it, mirroring createMiddlewareErrorResponse. Without
        // this, createErrorResponse defaults every handler-thrown error to
        // 500 (error-handler.ts: `options?.status || 500`), flattening a
        // thrown HttpError(409) to a masked 500 on the wire. With it, #1946's
        // production 4xx branch surfaces the clean message. 5xx and plain
        // Errors stay undefined -> 500 default, still masked. See #1957.
        const rawStatus = (error as { statusCode?: unknown, status?: unknown })?.statusCode
          ?? (error as { status?: unknown })?.status
        const status = typeof rawStatus === 'number' && Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600
          ? rawStatus
          : undefined
        // Return Ignition-style error page in development, JSON in production
        return await createErrorResponse(
          error instanceof Error ? error : new Error(String(error)),
          req,
          { handlerPath, status },
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
  const fn = handler as InlineRouteHandler
  return (req: EnhancedRequest) => {
    const result = fn(req)
    if (result instanceof Promise)
      return result.then(value => formatResult(value, req))
    return formatResult(result, req)
  }
}

/**
 * Read a JSON body once, and leave the request readable afterwards.
 *
 * This used to be `req.clone()` then `.text()` on the clone, which tees the
 * body stream and allocates a second Request on every JSON request that
 * arrives - purely so a handler calling `request.json()` later would still
 * find a body to read. The stream is read directly now, and the readers that
 * would have found it consumed are backed by the string instead: same answers,
 * one read, no clone.
 *
 * `clone()` is replaced too, because the default one throws once the body has
 * been used, and `rawBody()` in bun-router reaches for it when `_rawBody` is
 * not already set.
 */
async function readJsonBodyOnce(req: EnhancedRequest, contentType: string): Promise<string> {
  const raw = await (req as unknown as Request).text()

  // The exact unparsed bytes, so `request.rawBody()` can return them for
  // webhook signature verification (Stripe/GitHub/Slack). A re-serialized
  // `jsonBody` is NOT byte-identical and fails HMAC checks.
  ;req._rawBody = raw
  ;req._rawBodyContentType = contentType

  return raw
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
    if (contentType === 'application/json' || JSON_CONTENT_TYPE.test(contentType)) {
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
      const raw = await readJsonBodyOnce(req, contentType)
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

      Reflect.set(req, 'formBody', formBody)
      Reflect.set(req, 'files', files)
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
  fuseRequestEnhancements(bunRouter)

  let currentPrefix = ''
  let currentGroupMiddleware: string[] = []
  let currentGroupApiResponse = false

  /**
   * Every `METHOD:/path` THIS router has already registered.
   *
   * Instance-scoped on purpose: bun-router dedupes per instance, so the same
   * path registered on two routers is live on both. A module-level set would
   * declare the second one shadowed and silently strip its middleware.
   */
  const registeredRouteKeys = new Set<string>()

  // Helper to register a route with group middleware applied
  function registerRoute(method: string, path: string, _handler: StacksHandler) {
    const fullPath = currentPrefix + path
    const routeKey = `${method}:${fullPath}`
    log.debug(`[router] ${method} ${fullPath} → ${typeof _handler === 'string' ? _handler : 'function'}`)

    // A second registration of the same method+path never serves: bun-router's
    // compiler skips it (`RouteCompiler.addRoute` returns false on a duplicate
    // key) and the static fast map only fills an empty slot, so the FIRST
    // registration is the live one. That is the whole basis of the override
    // model in `route-loader.ts`, which loads user routes before framework
    // defaults precisely so a user route wins.
    //
    // The registries below are keyed by `routeKey` alone, so without this
    // guard the shadowed registration writes into the LIVE route's state:
    // a user's public `route.get('/dashboard/home', ...)` was answering 401,
    // because the framework's later duplicate inside
    // `route.group({ middleware: 'auth' }, ...)` stamped `auth` onto it
    // (stacksjs/stacks#2332). `.skipCsrf()` on a dead duplicate could likewise
    // disable CSRF on the live route.
    //
    // Tracked per ROUTER INSTANCE, not per module, because bun-router's
    // duplicate skip is per instance: two `createStacksRouter()` instances
    // registering the same path both serve it, and both must keep their own
    // middleware.
    const shadowed = registeredRouteKeys.has(routeKey)
    if (!shadowed)
      registeredRouteKeys.add(routeKey)

    // Create the route-owned array before its request handler so the handler
    // can retain the reference. Chainable `.middleware()` calls mutate this
    // same array after registration without requiring a Map lookup per request.
    if (!shadowed)
      routeMiddlewareRegistry.set(routeKey, [...currentGroupMiddleware])
    if (!shadowed)
      routeCsrfRegistry.set(routeKey, { mode: CSRF_DEFAULT })
    if (!shadowed)
      routeRateLimitRegistry.set(routeKey, {})

    // Pre-populate apiResponse registry with the group flag so the request
    // handler can flip `req._forceJson` without re-walking the group stack.
    if (!shadowed && currentGroupApiResponse) {
      routeApiResponseRegistry.add(routeKey)
    }

    // Track string handlers so the CSRF gate can look up action-level
    // skipCsrf flags without re-importing on every request. Guarded for the
    // same reason, and it is also what made `listRegisteredRoutes()` name a
    // handler that never runs.
    if (!shadowed && typeof _handler === 'string') {
      routeHandlerKeyRegistry.set(routeKey, _handler)
    }

    // Same purpose for an action registered by import: `listRegisteredRoutes()`
    // hands it straight to the OpenAPI generator, which would otherwise have
    // no file to read the schema out of.
    if (!shadowed && isRouterAction(_handler)) {
      routeActionRegistry.set(routeKey, _handler)
    }

    return { fullPath, routeKey, shadowed }
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
      const { fullPath, routeKey, shadowed } = registerRoute('GET', path, handler)
      bunRouter.get(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey, shadowed)
    },

    post(path: string, handler: StacksHandler) {
      const { fullPath, routeKey, shadowed } = registerRoute('POST', path, handler)
      bunRouter.post(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey, shadowed)
    },

    put(path: string, handler: StacksHandler) {
      const { fullPath, routeKey, shadowed } = registerRoute('PUT', path, handler)
      bunRouter.put(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey, shadowed)
    },

    patch(path: string, handler: StacksHandler) {
      const { fullPath, routeKey, shadowed } = registerRoute('PATCH', path, handler)
      bunRouter.patch(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey, shadowed)
    },

    delete(path: string, handler: StacksHandler) {
      const { fullPath, routeKey, shadowed } = registerRoute('DELETE', path, handler)
      bunRouter.delete(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey, shadowed)
    },

    options(path: string, handler: StacksHandler) {
      const { fullPath, routeKey, shadowed } = registerRoute('OPTIONS', path, handler)
      bunRouter.options(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey, shadowed)
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

      /*
       * `'Post'` → `'Actions/Post'`, and an explicit `'Actions/Blog/Blog'` is
       * left alone.
       *
       * Without the prefix the composed name went through the resolver's
       * generic branch and looked for `app/PostIndexAction.ts` - the project
       * root, not `app/Actions/`. `buddy make:crud` writes its five actions to
       * `app/Actions/` and then prints `route.resource('posts', 'Post')` as the
       * next step, so the documented, scaffolded happy path resolved to a file
       * that had just been written somewhere else and 500'd on first request.
       * Nothing caught it: the tests asserted five routes were REGISTERED, and
       * a string handler is not resolved until the route is hit.
       */
      const stripped = handler.replace(/Action$/, '')
      const handlerBase = stripped.startsWith('Actions/') ? stripped : `Actions/${stripped}`
      log.debug(`[router] Resource: /${name} → ${handlerBase}*Action [${activeActions.join(', ')}]`)

      /*
       * The siblings are composed at runtime, so they cannot be listed at the
       * call site - and `only`/`except` mean the required set is not even fixed.
       * The type below checks that the base names at least ONE real action;
       * which of the five exist is settled when the route is hit, as before.
       */
      const sibling = (suffix: string): ActionPath => `${handlerBase}${suffix}` as ActionPath

      const registerResourceRoutes = () => {
        for (const action of activeActions) {
          switch (action) {
            case 'index':
              stacksRouter.get(`/${name}`, sibling('IndexAction'))
              break
            case 'store':
              stacksRouter.post(`/${name}`, sibling('StoreAction'))
              break
            case 'show':
              stacksRouter.get(`/${name}/:id`, sibling('ShowAction'))
              break
            case 'update':
              stacksRouter.put(`/${name}/:id`, sibling('UpdateAction'))
              break
            case 'destroy':
              stacksRouter.delete(`/${name}/:id`, sibling('DestroyAction'))
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
      // The chain returned below belongs to `methods[0]`, so it is that
      // method's own shadow state that decides whether it is inert. Taking
      // "any method shadowed" would silently inert a chain whose first method
      // is perfectly live.
      let firstShadowed = false
      for (const [index, method] of methods.entries()) {
        const m = method.toUpperCase()
        const { fullPath, routeKey, shadowed } = registerRoute(m, path, handler)
        if (index === 0)
          firstShadowed = shadowed
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
      return createChainableRoute(`${methods[0]}:${currentPrefix}${path}`, firstShadowed)
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
        const health = await checkApplicationHealth()
        return Response.json(health, { status: health.status === 'healthy' ? 200 : 503 })
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
        if (!isExposeRoutesAuthorized(req)) return Response.json({ error: 'disabled' }, { status: 404 })
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
        const params = (req as Request & { params?: Record<string, string> }).params
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
        if (!isExposeRoutesAuthorized(req)) return Response.json({ error: 'disabled' }, { status: 404 })
        try {
          const { generateOpenApi } = await import('@stacksjs/api')
          // `write: false` because this route SERVES a spec, it does not
          // produce the committed artifact. Called bare, `options.write` is
          // undefined and the generator's `write !== false` test treated that
          // as yes, so every hit on this route overwrote the tracked
          // storage/framework/api/openapi.json with whatever that machine's
          // APP_NAME happened to be.
          //
          // `portable: false` keeps the app's own name in the served document,
          // which is the one place that is genuinely wanted.
          const spec = await (generateOpenApi as (o: { write: boolean, portable: boolean }) => Promise<unknown>)({
            write: false,
            portable: false,
          })
          return Response.json(spec)
        }
        catch (err) {
          return Response.json(
            { error: 'OpenAPI generation failed', message: err instanceof Error ? err.message : String(err) },
            { status: 500 },
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
    use(middleware: ActionHandler | BunMiddlewareHandler | Middleware | { handle: (req: EnhancedRequest) => void | Promise<void> }) {
      // bunRouter.use() is async, so we need to call it properly
      // For synchronous chaining, we push directly to globalMiddleware
      // The sync path accepts the broader middleware union the async one does.
      const adapted = adaptMiddlewareForBunRouter(middleware)
      bunRouter.globalMiddleware.push(adapted)
      return stacksRouter
    },

    /**
     * Register work to do once, after the routes load and before the first
     * request. See `BootHook` for what belongs here and what does not.
     */
    booting(name: string, run: () => void | Promise<void>) {
      bootHooks.push({ name, run })
      return stacksRouter
    },

    // Serve the router
    async serve(options: ServerOptions = {}): Promise<Server<unknown>> {
      // Warn (don't crash) on a split router (#1975/#1982). The route table is
      // now a process-global singleton, so a second instance pulled in by user
      // route files shares the same table — routing works — but a duplicated
      // install is still worth flagging. By now importRoutes() has run, so any
      // second instance is already registered.
      warnOnMultipleRouterInstances()

      // Where this app's components, layouts and partials are. Without it a
      // view served from here renders every component as an inline error and
      // still answers 200 - see `configureViewDirectories`.
      configureViewDirectories(bunRouter)

      // A view served from here never reaches the route pipeline, so the CSRF
      // cookie was only ever seeded on API responses. See the wrapper.
      wrapHandleRequestForCsrf(bunRouter)

      // Directly served requests need the same read-after-write tracking as
      // serverResponse(), including requests that bypass the route pipeline.
      await wrapHandleRequestForDatabaseContext(bunRouter)

      // After the routes and the view configuration, before the first request:
      // the one moment an application can do work once without racing a reader
      // for it. See `BootHook`.
      await runBootHooks()

      const appEnv = (process.env.APP_ENV ?? '').toLowerCase()
      const production = appEnv === 'production' || process.env.NODE_ENV === 'production'
      const callerSuppliedRoutes = Object.prototype.hasOwnProperty.call(options, 'routes')
      const nativeRoutes = options.nativeRoutes
        ?? (production && !callerSuppliedRoutes && shouldUseNativeRoutesByDefault(bunRouter.routes))

      return bunRouter.serve(nativeRoutes === options.nativeRoutes
        ? options
        : { ...options, nativeRoutes })
    },

    // Handle a request directly
    handleRequest(req: Request): Promise<Response> {
      return bunRouter.handleRequest(req)
    },

    // Mirror bun-router's introspection: which HTTP methods are registered
    // for `pathname`. Used by the dev dashboard's onRequest gate to decide
    // whether to delegate or fall through to STX page rendering.
    getAllowedMethods(pathname: string, domain?: string): string[] {
      return bunRouter.getAllowedMethods(pathname, domain)
    },

    // Register routes from a package or module file within an optional group
    async register(routePath: string, options?: { prefix?: string, middleware?: MiddlewareReference | MiddlewareReference[] }): Promise<StacksRouterInstance> {
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

      // Load ORM-generated API routes.
      //
      // The PACKAGE is tried first, and that ordering is load-bearing. The
      // vendored `storage/framework/orm/routes.ts` is copied into an app once
      // and nothing re-vendors it: `@stacksjs/orm` publishes `dist/routes.js`
      // and no `routes.ts`, so an app that upgrades the package keeps running
      // whatever generator its vendored copy froze at. One app was serving a
      // copy old enough to compare route paths literally, so a generated
      // `PATCH /api/sites/{id}` did not recognise a hand-written
      // `/api/sites/{siteId}` as the same endpoint, registered alongside it,
      // and the hand-written handler's authorization check stopped running
      // (stacksjs/stacks#2364).
      //
      // `core/server/src/start.ts` and `core/api/src/generate-openapi.ts`
      // already resolve it package-first; this path and `defaults/bootstrap.ts`
      // were the two that did not, which is why the same app could be correct
      // under one entrypoint and shadowed under another.
      //
      // The vendored paths remain as fallbacks for a checkout with no built
      // package behind the specifier.
      log.debug('[router] Loading ORM routes...')
      // Held in a variable so the specifier resolves at runtime: a literal one
      // is resolved while transpiling, and an unresolvable literal fails the
      // module rather than throwing where it can be caught.
      const ormRoutesPackage = '@stacksjs/orm/routes'
      let ormRoutesLoaded = false
      try {
        await import(ormRoutesPackage)
        ormRoutesLoaded = true
        log.debug(`[router] ORM routes loaded from ${ormRoutesPackage}`)
      }
      catch (error) {
        log.debug('[router] ORM routes not available from the package, trying the vendored copy\n', error)
      }

      const ormRoutesCandidates = ormRoutesLoaded
        ? []
        : [
            p.frameworkPath('orm/routes.ts'),
            p.frameworkPath('core/orm/routes.ts'),
          ]
      for (const candidate of ormRoutesCandidates) {
        try {
          if (await Bun.file(candidate).exists()) {
            await import(candidate)
            ormRoutesLoaded = true
            // Which generator is running is the one fact that made #2364
            // undiagnosable from outside, so say it rather than debug it.
            log.info(`[router] ORM routes loaded from the vendored copy at ${candidate}. `
              + `This file is not refreshed by upgrading @stacksjs/orm - delete it to use the package.`)
            break
          }
        }
        catch (error) {
          // WARN, not debug: a throwing candidate is a real problem. This
          // loader tries the canonical copy first and falls through to the
          // legacy one on ANY error — so a canonical file that throws at
          // import (e.g. a hard `import config/qb.ts` on a project without
          // one) silently serves the STALE legacy copy, and every edit to
          // the canonical file appears to do nothing. Make that visible.
          log.warn(`[router] ORM routes candidate failed to load, falling back to next: ${candidate}\n`, error)
        }
      }
      // The package was already tried first, above: an app scaffolded before the
      // vendored shim was fixed carries one that re-exports `../core/orm/routes`,
      // a directory that exists in this repository and nowhere else, and the
      // package is what it can actually reach.

      if (!ormRoutesLoaded)
        log.warn('[router] No ORM routes candidate loaded - model useApi endpoints are unavailable.')

      // Load routes from discovered packages
      log.debug('[router] Loading discovered package routes...')
      try {
        await stacksRouter.loadDiscoveredRoutes()
      }
      catch (error) {
        log.debug('Package route discovery skipped:', error)
      }

      // Fail-closed boot validation (stacksjs/stacks#1957): every
      // middleware alias referenced by a registered route — including
      // those from discovered pantry packages above — must resolve NOW.
      // A typo'd alias aborts boot instead of serving the route
      // unprotected; the request-time guard in createMiddlewareHandler
      // is the 500 backstop for anything registered after this point.
      await assertRouteMiddlewareResolvable()
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

        for (const [pkgName, meta] of Object.entries(packages) as [string, any][]) {
          const routes = meta?.routes
          if (!routes) continue

          const routeList = Array.isArray(routes) ? routes : [routes]
          // Discovery records where it found the package. Falling back to
          // `pantry/<name>` keeps a manifest written before that field existed
          // working, but it is only ever right for the pantry tree: a package
          // a user installed lives in node_modules, and reading its routes
          // from pantry silently found nothing.
          const pkgDir = meta?.root
            ? p.projectPath(meta.root)
            : `${p.projectPath('pantry')}/${pkgName}`

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

/**
 * Seed the CSRF cookie on file-based view responses too.
 *
 * **Every form in a server-rendered Stacks app was refused for a first-time
 * visitor.** Both halves of the seeding exist and both hang off the *route
 * handler* pipeline: `seedCsrfTokenForRender` puts a token on the incoming
 * request so a template can embed it, and `seedCsrfCookieIfMissing` puts the
 * matching cookie on the outgoing response. A file-based view takes neither -
 * bun-router serves it directly - so the page rendered a token the browser had
 * no cookie for, and the first submit came back `CSRF token mismatch`.
 *
 * It is invisible to a test suite. A request carrying a Bearer token bypasses
 * the check by design, and that is how integration tests authenticate, so the
 * suite passes while every human interaction fails. The application that found
 * this had a hundred passing tests and not one working form.
 *
 * Wrapped around `handleRequest` rather than added as a middleware, because a
 * middleware runs on the route pipeline and that is the pipeline a view does not
 * take. It cannot go in the serve options either: bun-router's `serve()`
 * overwrites `fetch` with its own bound `handleRequest`, so anything passed
 * there is discarded.
 *
 * Safe methods only, and only when the request carried no token of its own:
 * anything else is a live session whose token must not be rotated mid-flight.
 */
function wrapHandleRequestForCsrf(bunRouter: Router): void {
  const router = bunRouter as Router & { _csrfSeedingWrapped?: boolean, handleRequest: (req: Request) => Promise<Response> }

  // `serve()` can be called more than once in a process - a test that boots a
  // server per file does exactly that - and wrapping twice would append two
  // Set-Cookie headers carrying different tokens.
  if (router._csrfSeedingWrapped)
    return

  const original = router.handleRequest.bind(router)

  const handleUnseededSafeRequest = async (request: Request, rendersCsrf: boolean, cookieHeader: string): Promise<Response> => {
    /*
     * Seeded *before* the render, not only after it.
     *
     * A template reads cookies off the incoming request, so a first-time
     * visitor whose request carries none renders an empty token no matter what
     * the response sets afterwards - and their first submit fails. Putting it
     * on the request first is what makes that first form usable; the response
     * half below then stores the same value in the browser.
     */
    if (rendersCsrf) {
      const seeding = seedCsrfTokenForRender(request as Request & { _csrfToken?: string }, cookieHeader)
      if (seeding) await seeding
    }
    ;(request as unknown as Record<symbol, unknown>)[CSRF_SEEDED_BY_HANDLE_REQUEST] = true

    const response = await original(request)

    if (!response)
      return response

    try {
      const mod = loadCsrfModule()
      const csrf = mod instanceof Promise ? await mod : mod
      if (!csrf)
        return response

      return csrf.seedCsrfCookieIfMissing(
        request,
        response,
        // The value a render already embedded, when the route pipeline ran and
        // seeded one. Reused rather than regenerated: two independent tokens
        // put one value in the form and another in the browser, which fails
        // exactly the way no token at all does.
        (request as Request & { _csrfToken?: string })._csrfToken,
      )
    }
    catch (err) {
      // No CSRF middleware in this project's defaults, or it could not be read.
      // Reported rather than swallowed: a cookie that quietly stops being set
      // turns every form in the product into a button that does nothing.
      log.warn('[router] CSRF cookie seeding failed on the view path', { error: err })

      return response
    }
  }

  const handleSafeRequest = (request: Request, rendersCsrf: boolean): Promise<Response> => {
    const cookieHeader = request.headers.get('cookie') ?? ''
    if (cookieHeader.includes('X-CSRF-Token=') || cookieHeader.includes('csrf-token=')) {
      ;(request as unknown as Record<symbol, unknown>)[CSRF_SEEDED_BY_HANDLE_REQUEST] = true
      return original(request)
    }
    return handleUnseededSafeRequest(request, rendersCsrf, cookieHeader)
  }

  router.handleRequest = (request: Request): Promise<Response> => {
    const method = request.method
    if (method === 'GET' || method === 'HEAD')
      return handleSafeRequest(request, true)
    if (method === 'OPTIONS')
      return handleSafeRequest(request, false)
    return original(request)
  }

  router._csrfSeedingWrapped = true
}

/**
 * Tell the file-based view renderer where this application keeps its templates.
 *
 * Two different programs render `.stx` in a Stacks app and they were not
 * agreeing. `buddy dev` and the production server go through
 * `bun-plugin-stx`'s own `serve()`, which is handed the components, layouts and
 * partials directories explicitly. `route.serve()` goes through bun-router's
 * file routing, which was handed nothing - so its components directory fell
 * back to `<viewsDir>/components`, and `resources/components`, where every
 * Stacks app actually keeps them, was never looked in.
 *
 * The failure is silent in the direction that hides bugs. The page still
 * answers 200; the component is replaced inline with
 * `[Error loading component: ENOENT ...]`. So a test that boots the router and
 * asserts on rendered HTML cannot see any component at all, and reads as though
 * the feature under test were missing rather than the harness.
 *
 * Only fills in what has not been set: an application that called
 * `route.bunRouter.views(...)` itself has said something more specific, and
 * this must not overwrite it.
 *
 * **It deliberately does not set `viewsPath`.** Naming one switches on
 * file-based route discovery, which walks the whole views tree - so an
 * application that never asked for file routing would start doing it because a
 * directory happened to exist. Where the views are is already decided
 * elsewhere; the only thing missing was where the *components* are.
 */
export function configureViewDirectories(bunRouter: Router): void {
  const router = bunRouter as Router & { _fileRoutingConfig?: Record<string, unknown>, views?: (config: Record<string, unknown>) => unknown }

  if (typeof router.views !== 'function')
    return

  // Already configured by the application, or file routing deliberately off.
  const existing = router._fileRoutingConfig
  if (existing && Object.keys(existing).length > 0)
    return

  // Nothing to configure for an application with no views at all.
  if (!existsSync(p.projectPath('resources/views')))
    return

  // `resources/views/layouts` is where the scaffold puts them now;
  // `resources/layouts` is the older location and still in use. Whichever
  // exists is the answer, and the production server picks between them the
  // same way.
  const layouts = [p.projectPath('resources/views/layouts'), p.projectPath('resources/layouts')].find(existsSync)
  const partials = [p.projectPath('resources/views/partials'), p.projectPath('resources/partials')].find(existsSync)
  const components = [p.projectPath('resources/components'), p.projectPath('resources/views/components')].find(existsSync)

  router.views({
    ...(components ? { componentsDir: components } : {}),
    ...(layouts ? { layoutsDir: layouts } : {}),
    ...(partials ? { partialsDir: partials } : {}),
  })
}

/**
 * Stop the API server answering page routes.
 *
 * bun-router discovers `.stx` files on its own: with no views configured at
 * all it falls back to `detectViewsDirectory()`, finds `resources/views`
 * because the directory happens to exist, and mounts a GET route for every
 * template under it. The API server therefore serves the whole site, on the
 * port whose banner says "API server ready".
 *
 * Those pages cannot work. The API process has no static-asset handling and no
 * CSS pipeline, so the HTML it emits references images that 404 on that port
 * and carries no stylesheet - a page that only renders correctly when fetched
 * through a different server. Nothing needs it either: in dev the views server
 * renders pages and proxies `/api/**` here, and in production `buddy serve`
 * does the same. The API server is the proxy *target* in both.
 *
 * It is also actively misleading, which is how it was found
 * (stacksjs/stacks#2314). A page answering 200 at a path the developer never
 * routed reads as "my route was overridden", when the route was in fact mounted
 * somewhere else entirely.
 *
 * Declared routes were never at risk - bun-router skips a discovered view when
 * a GET route already exists at that path - so this changes nothing for any
 * path that answers today.
 *
 * An application that called `route.bunRouter.views(...)` itself has asked for
 * file routing and is left alone; that is the escape hatch for anyone serving
 * pages from this process on purpose, and it is the same "said something more
 * specific" rule {@link configureViewDirectories} follows. Route files run
 * before this does, so asking for it from `routes/*.ts` works.
 *
 * The two functions are coupled and the coupling is bun-router's, not ours:
 * `serve()` calls {@link configureViewDirectories} after this, and that only
 * backs off because `disableFileRouting()` happens to leave a non-empty
 * `_fileRoutingConfig` behind. Were that flag ever to move to a field of its
 * own, `configureViewDirectories` would overwrite the config and re-mount every
 * template. `api-view-routing.test.ts` drives both, in that order, so the
 * upgrade that changes it fails a test rather than quietly restoring the site
 * to the API port.
 *
 * @returns whether file routing was switched off by this call.
 */
export function disableViewRouting(bunRouter: Router): boolean {
  const router = bunRouter as Router & {
    _fileRoutingConfig?: Record<string, unknown>
    disableFileRouting?: () => unknown
  }

  // Older bun-router, or a stand-in in a test. Nothing to switch off.
  if (typeof router.disableFileRouting !== 'function')
    return false

  // The application configured views itself. Leave it alone.
  const existing = router._fileRoutingConfig
  if (existing && Object.keys(existing).length > 0)
    return false

  router.disableFileRouting()

  return true
}

export interface StacksRouterInstance {
  bunRouter: Router
  routes: Route[]
  /*
   * Two call signatures each, and the order matters. The first types an inline
   * arrow's request from the path literal; the second accepts every other
   * handler form unchanged. One parameter typed as the union would type
   * neither - see `TypedInlineRouteHandler`.
   */
  get: {
    <TPath extends string>(path: TPath, handler: TypedInlineRouteHandler<TPath>): ChainableRoute
    (path: string, handler: StacksHandler): ChainableRoute
  }
  post: {
    <TPath extends string>(path: TPath, handler: TypedInlineRouteHandler<TPath>): ChainableRoute
    (path: string, handler: StacksHandler): ChainableRoute
  }
  put: {
    <TPath extends string>(path: TPath, handler: TypedInlineRouteHandler<TPath>): ChainableRoute
    (path: string, handler: StacksHandler): ChainableRoute
  }
  patch: {
    <TPath extends string>(path: TPath, handler: TypedInlineRouteHandler<TPath>): ChainableRoute
    (path: string, handler: StacksHandler): ChainableRoute
  }
  delete: {
    <TPath extends string>(path: TPath, handler: TypedInlineRouteHandler<TPath>): ChainableRoute
    (path: string, handler: StacksHandler): ChainableRoute
  }
  options: {
    <TPath extends string>(path: TPath, handler: TypedInlineRouteHandler<TPath>): ChainableRoute
    (path: string, handler: StacksHandler): ChainableRoute
  }
  group: (options: GroupOptions, callback: () => void | Promise<void>) => StacksRouterInstance | Promise<StacksRouterInstance>
  /*
   * Generic in the base AND in `only`/`except`, so the check can ask about the
   * exact set of files this call will register. `readonly TOnly[]` rather than
   * `ResourceAction[]` is what makes `only: ['index', 'show']` infer as the
   * literals `'index' | 'show'` instead of widening to the whole union.
   */
  resource: <TBase extends string, TOnly extends ResourceAction = never, TExcept extends ResourceAction = never>(
    name: string,
    handler: TBase & ResourceBaseCheck<TBase, ActiveResourceActions<TOnly, TExcept>>,
    options?: {
      only?: readonly TOnly[]
      except?: readonly TExcept[]
      middleware?: MiddlewareReference | MiddlewareReference[]
    },
  ) => StacksRouterInstance
  match: {
    <TPath extends string>(methods: string[], path: TPath, handler: TypedInlineRouteHandler<TPath>): ChainableRoute
    (methods: string[], path: string, handler: StacksHandler): ChainableRoute
  }
  health: () => StacksRouterInstance
  use: (middleware: ActionHandler | BunMiddlewareHandler) => StacksRouterInstance
  register: (routePath: string, options?: { prefix?: string, middleware?: MiddlewareReference | MiddlewareReference[] }) => Promise<StacksRouterInstance>
  /**
   * Work to do once, after the routes load and before the first request.
   *
   * The moment an application can prepare something without racing a reader
   * for it - warming a cache, loading grammars, opening a connection. A hook
   * that throws is logged and the boot continues; see `BootHook`.
   */
  booting: (name: string, run: () => void | Promise<void>) => StacksRouterInstance
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

// Create and export a default router instance.
//
// Promoted to a process-global singleton (keyed by a well-known Symbol) so
// that if two physically distinct @stacksjs/router modules ever load in one
// process — the dist-only-app-that-also-vendors-core split of
// stacksjs/stacks#1975 / #1982 — they SHARE one route table instead of
// registering user routes on one instance while the server serves another's
// (empty) table (every route 404s). In the normal single-instance case `??=`
// runs createStacksRouter() exactly once, so this is byte-identical to the
// previous module-local singleton. Pairs with the request-context ALS, which
// is globalized the same way so request state is shared across copies too.
const ROUTE_SINGLETON_KEY = Symbol.for('@stacksjs/router:route-singleton')
export const route: StacksRouterInstance = ((globalThis as Record<symbol, unknown>)[ROUTE_SINGLETON_KEY] ??= createStacksRouter()) as StacksRouterInstance

// Promise-based route loading to prevent race conditions under concurrency
let routesLoadPromise: Promise<void> | null = null

/**
 * Per-request read-routing context.
 *
 * The database package tracks writes per async context so that a request
 * which reads back what it just wrote is never served from a read replica
 * (replication is asynchronous, so the row may not be there yet). That
 * tracking only works if something establishes the context at the request
 * boundary — without this, `contextHasWritten()` has no store to consult,
 * always reports false, and every read routes to a replica including the
 * one immediately following a write. The safety rule would be dead code.
 *
 * Loaded lazily rather than imported: `@stacksjs/database` already depends
 * on `@stacksjs/router`, so a static import here would close a package
 * cycle. The dynamic import is resolved once and cached, and the fallback
 * is a plain pass-through so a build without the database package (or an
 * older one) still serves requests.
 */
type ContextRunner = <T>(fn: () => T) => T
let routingContextRunner: ContextRunner | null = null

const databaseContextWrappedRouters = new WeakSet<Router>()

type NativeRouteHandler = (request: Request) => Promise<Response>
type NativeRouteTable = Record<string, Record<string, NativeRouteHandler>>

/**
 * Bun's native route table bypasses `handleRequest`, which is normally the
 * database routing boundary. Decorate the generated handlers instead of the
 * shared dispatcher so fetch-routed requests keep exactly one context while
 * native requests gain the one they were missing.
 */
function wrapNativeRoutesForDatabaseContext(router: Router, runInRoutingContext: ContextRunner): void {
  const nativeRouter = router as Router & {
    _nativeDatabaseContextWrapped?: boolean
    _buildNativeRoutes?: () => NativeRouteTable | null
  }
  if (nativeRouter._nativeDatabaseContextWrapped || typeof nativeRouter._buildNativeRoutes !== 'function')
    return

  const buildNativeRoutes = nativeRouter._buildNativeRoutes.bind(nativeRouter)
  nativeRouter._buildNativeRoutes = () => {
    const routes = buildNativeRoutes()
    if (!routes)
      return routes

    const compression = (nativeRouter.config as unknown as {
      compression?: Parameters<typeof applyResponseCompression>[2]
    }).compression
    for (const methods of Object.values(routes)) {
      for (const [method, handler] of Object.entries(methods)) {
        methods[method] = async (request) => {
          const response = await runInRoutingContext(() => handler(request))
          return await applyResponseCompression(response, request, compression)
        }
      }
    }
    return routes
  }
  nativeRouter._nativeDatabaseContextWrapped = true
}

async function wrapHandleRequestForDatabaseContext(router: Router): Promise<void> {
  if (databaseContextWrappedRouters.has(router)) return
  const runInRoutingContext = await getRoutingContextRunner()
  // Concurrent serve() calls can resolve the runner together.
  if (databaseContextWrappedRouters.has(router)) return
  wrapNativeRoutesForDatabaseContext(router, runInRoutingContext)
  const original = router.handleRequest.bind(router)
  router.handleRequest = request => runInRoutingContext(() => original(request))
  databaseContextWrappedRouters.add(router)
}

async function getRoutingContextRunner(): Promise<ContextRunner> {
  if (!routingContextRunner) {
    try {
      const database = await import('@stacksjs/database')
      const runner = database.withDatabaseRoutingContext ?? database.withRoutingContext
      routingContextRunner = typeof runner === 'function'
        ? runner
        : (fn => fn())
    }
    catch {
      // No database package available — routing is moot, so run unwrapped.
      routingContextRunner = fn => fn()
    }
  }
  return routingContextRunner
}

/**
 * Handle a server request through the router
 * This is the main entry point for the Stacks server
 */
export async function serverResponse(request: Request, _body?: string): Promise<Response> {
  const runInRoutingContext = await getRoutingContextRunner()
  // The context must wrap the whole handler, not just the dispatch: a write
  // in a controller has to be visible to a read later in the same request,
  // and AsyncLocalStorage carries the store across every await inside.
  return runInRoutingContext(() => handleServerRequest(request))
}

async function handleServerRequest(request: Request): Promise<Response> {
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
      const body = await response.clone().json()
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
