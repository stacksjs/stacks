/**
 * Stacks Router - Extends bun-router with action/controller resolution
 *
 * This module provides a router that wraps bun-router and adds the ability
 * to use string paths like 'Actions/MyAction' or 'Controllers/MyController@method'
 */

import type { Server } from 'bun'
import type { ActionHandler, EnhancedRequest, Route, ServerOptions } from '@stacksjs/bun-router'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { UploadedFile } from '@stacksjs/storage'
import { applyRequestEnhancements, Router } from '@stacksjs/bun-router'
import { runWithRequest } from './request-context'
import { clearTrackedQueries, createErrorResponse, createMiddlewareErrorResponse } from './error-handler'

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
}

/**
 * Set of route keys (`METHOD:/path`) that have explicitly opted out of
 * CSRF enforcement via `.skipCsrf()`. Lookup happens once per request
 * during the middleware-handler entry point.
 */
const csrfSkipRegistry = new Set<string>()

/**
 * Action-level CSRF opt-out cache, keyed by the resolved handler
 * import path. Populated lazily when an action with a string handler
 * is loaded — we read `action.skipCsrf` / `action.csrf` once at
 * load time and keep the answer here so the CSRF gate doesn't have to
 * re-import the module on every request.
 */
const actionSkipsCsrfCache = new Map<string, boolean>()

/**
 * Map of routeKey → handler-identifier so the CSRF gate can look up
 * action-level skip flags without re-importing the action module on
 * every request. Identifier is the original string handler path
 * (`'Actions/Foo'`); for function handlers the entry stays unset.
 */
const routeHandlerKeyRegistry = new Map<string, string>()

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
    // Parse body and enhance request first
    await parseRequestBody(req)
    const enhancedReq = enhanceRequest(req)
    if (actionPrefetch) await actionPrefetch

    // Run the entire request handling within the request context
    // This allows Auth and other services to access the current request
    return runWithRequest<Promise<Response>>(enhancedReq, async () => {
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
      // Check action-level cache: an action exporting `skipCsrf: true`
      // means we should NOT inject the middleware at all (rather than
      // injecting it and having it self-bail). Skipping at injection
      // time avoids the import + parse cost of csrf.ts entirely on
      // hot webhook paths.
      const handlerKey = routeHandlerKeyRegistry.get(routeKey)
      const actionSkipped = handlerKey ? actionSkipsCsrfCache.get(handlerKey) === true : false
      if (CSRF_PROTECTED_METHODS.has(method) && !alreadyHasCsrf && !routeSkipped && !actionSkipped) {
        // Prepend so CSRF runs before auth/etc. — a request that fails
        // CSRF should never reach the rest of the chain.
        middlewareEntries.unshift('csrf')
      }

      if (middlewareEntries.length > 0) {
        const urlPath = new URL(req.url).pathname
        log.debug(`[middleware] Executing chain: [${middlewareEntries.join(', ')}] for ${method} ${urlPath}`)
      }

      // Run middleware in order
      const middlewareTimings: Array<{ name: string, ms: number }> = []
      for (const middlewareEntry of middlewareEntries) {
        const { name: middlewareName, params } = parseMiddlewareName(middlewareEntry)

        // Store middleware params on request for middleware to access
        if (params) {
          ;(enhancedReq as any)._middlewareParams = (enhancedReq as any)._middlewareParams || {}
          ;(enhancedReq as any)._middlewareParams[middlewareName] = params
        }

        const middleware = await loadMiddleware(middlewareName)
        if (middleware && typeof middleware.handle === 'function') {
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
                const reqId = (enhancedReq as any)._requestId as string | undefined
                const startNs = (enhancedReq as any)._startNs as bigint | undefined
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
              return error
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
              const reqId = (enhancedReq as any)._requestId as string | undefined
              const startNs = (enhancedReq as any)._startNs as bigint | undefined
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
            return errorResponse
          }
        }
      }

      // Call the actual handler with the enhanced request.
      // `let` (not `const`) because the post-action CORS wrapper below may
      // replace it with a header-mutated copy when the original Response's
      // Headers are immutable.
      let response = await wrappedBase(enhancedReq)

      // Clear tracked queries after each request to prevent accumulation
      clearTrackedQueries()

      // CORS — applied BEFORE the request_id/Server-Timing rebuild path
      // so a JSON-error rewrite carries the freshly-set CORS headers
      // forward, and BEFORE compression so the resulting `Vary` value
      // can include both `Origin` and `Accept-Encoding`. The `_corsConfig`
      // marker is set by the `cors` middleware's `handle()`.
      if ((enhancedReq as any)._corsConfig && response) {
        try {
          const { applyCorsHeaders } = await import(p.storagePath('framework/defaults/app/Middleware/Cors.ts'))
          response = (applyCorsHeaders as (req: Request, res: Response, cfg?: unknown) => Response)(
            enhancedReq as unknown as Request,
            response,
            (enhancedReq as any)._corsConfig,
          )
        }
        catch (err) {
          // CORS header injection failure must not drop the response.
          // The browser will surface a CORS error, which is recoverable
          // for the developer; a 500 here would not be.
          log.warn('[router] CORS header injection failed', { error: err })
        }
      }

      // Echo X-Request-ID + Server-Timing on every response, AND stitch
      // the request_id into JSON error bodies so SPA error toasts can show
      // it (and bug reports can include it). For 4xx/5xx JSON responses
      // we rebuild the body once with `request_id` added; for 2xx/3xx we
      // only touch headers.
      const reqId = (enhancedReq as any)._requestId as string | undefined
      const startNs = (enhancedReq as any)._startNs as bigint | undefined
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
      if ((enhancedReq as any)._compress === true && response) {
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
        return formatResult(result)
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

    return async (req: EnhancedRequest) => {
      if (actionSkipsCsrf) {
        ;(req as any)._skipCsrf = true
      }
      try {
        // Validate action input if validations are defined
        if (action.validations) {
          const validationResult = await validateActionInput(req, action.validations)
          if (!validationResult.valid) {
            return new Response(JSON.stringify({
              error: 'Validation failed',
              errors: validationResult.errors,
            }), {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }

        const result = await action.handle(req)
        return formatResult(result)
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

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean
  errors: Record<string, string[]>
}

/**
 * Action validations interface
 */
interface ActionValidations {
  [key: string]: {
    rule: { validate: (value: unknown) => { valid: boolean, errors?: Array<{ message: string }> } }
    message?: string | Record<string, string>
  }
}

/**
 * Validate action input against defined validations
 */
async function validateActionInput(req: EnhancedRequest, validations: ActionValidations): Promise<ValidationResult> {
  const errors: Record<string, string[]> = {}

  // Get input data from request (query params, body, etc.)
  const input = await getRequestInput(req)

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
 * Get all input data from request (body + query params)
 * Uses already-parsed body from parseRequestBody() when available
 */
async function getRequestInput(req: EnhancedRequest): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {}

  // Get query parameters
  const url = new URL(req.url)
  url.searchParams.forEach((value, key) => {
    input[key] = value
  })

  // Get route params if available
  if ((req as any).params) {
    Object.assign(input, (req as any).params)
  }

  // Use already-parsed body (from parseRequestBody) if available
  if ((req as any).jsonBody && typeof (req as any).jsonBody === 'object') {
    Object.assign(input, (req as any).jsonBody)
  }
  else if ((req as any).formBody && typeof (req as any).formBody === 'object') {
    Object.assign(input, (req as any).formBody)
  }

  return input
}

/**
 * Format a result into a Response
 */
function formatResult(result: unknown): Response {
  if (result instanceof Response) {
    return result
  }

  if (typeof result === 'object' && result !== null) {
    return Response.json(result)
  }

  return new Response(String(result), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

// Decorate the incoming request with the helpers the framework's middleware
// and actions assume are always available. Names follow Laravel's convention
// because that's the API surface Stacks userland expects.
function enhanceRequest(req: EnhancedRequest): EnhancedRequest {
  applyRequestEnhancements(req as unknown as Request, (req as any).params || {})

  // Parse query string if not present
  let query = (req as any).query
  if (!query) {
    const url = new URL(req.url)
    query = {} as Record<string, string>
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })
    ;(req as any).query = query
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
    if ((req as any).jsonBody && typeof (req as any).jsonBody === 'object') {
      for (const [key, value] of Object.entries((req as any).jsonBody)) {
        input[key] = value
      }
    }

    // Form body
    if ((req as any).formBody && typeof (req as any).formBody === 'object') {
      for (const [key, value] of Object.entries((req as any).formBody)) {
        input[key] = value
      }
    }

    // Route params
    if ((req as any).params && typeof (req as any).params === 'object') {
      for (const [key, value] of Object.entries((req as any).params)) {
        input[key] = value
      }
    }

    cachedInput = input
    return input
  }

  // Add Laravel-style methods
  ;(req as any).get = <T = any>(key: string, defaultValue?: T): T => {
    const input = getAllInput()
    const value = input[key]
    return (value !== undefined ? value : defaultValue) as T
  }

  ;(req as any).input = <T = any>(key: string, defaultValue?: T): T => {
    const input = getAllInput()
    const value = input[key]
    return (value !== undefined ? value : defaultValue) as T
  }

  ;(req as any).all = (): Record<string, unknown> => getAllInput()

  ;(req as any).only = <T extends Record<string, unknown>>(keys: string[]): T => {
    const input = getAllInput()
    const result = {} as T
    for (const key of keys) {
      if (key in input) {
        (result as any)[key] = input[key]
      }
    }
    return result
  }

  ;(req as any).except = <T extends Record<string, unknown>>(keys: string[]): T => {
    const input = getAllInput()
    const result = { ...input } as T
    for (const key of keys) {
      delete (result as any)[key]
    }
    return result
  }

  ;(req as any).has = (key: string | string[]): boolean => {
    const input = getAllInput()
    if (Array.isArray(key)) {
      return key.every(k => k in input && input[k] !== undefined)
    }
    return key in input && input[key] !== undefined
  }

  ;(req as any).hasAny = (keys: string[]): boolean => {
    const input = getAllInput()
    return keys.some(k => k in input && input[k] !== undefined)
  }

  ;(req as any).filled = (key: string | string[]): boolean => {
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

  ;(req as any).missing = (key: string | string[]): boolean => {
    const input = getAllInput()
    if (Array.isArray(key)) {
      return key.every(k => !(k in input) || input[k] === undefined)
    }
    return !(key in input) || input[key] === undefined
  }

  ;(req as any).string = (key: string, defaultValue: string = ''): string => {
    const input = getAllInput()
    const value = input[key]
    return value !== undefined && value !== null ? String(value) : defaultValue
  }

  // Strict numeric parsing: `Number.parseInt('123abc')` returns 123 silently,
  // which lets callers accept partial numeric input they didn't intend
  // (e.g. pagination size gets set to the leading digits of a typo'd query
  // param). We require the entire string to be a valid number — any trailing
  // garbage falls through to `defaultValue`.
  ;(req as any).integer = (key: string, defaultValue: number = 0): number => {
    const input = getAllInput()
    const value = input[key]
    if (value === undefined || value === null || value === '') return defaultValue
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : defaultValue
    const str = String(value).trim()
    if (!/^-?\d+$/.test(str)) return defaultValue
    const parsed = Number.parseInt(str, 10)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  ;(req as any).float = (key: string, defaultValue: number = 0): number => {
    const input = getAllInput()
    const value = input[key]
    if (value === undefined || value === null || value === '') return defaultValue
    if (typeof value === 'number') return Number.isFinite(value) ? value : defaultValue
    const str = String(value).trim()
    if (!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(str)) return defaultValue
    const parsed = Number.parseFloat(str)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  ;(req as any).boolean = (key: string, defaultValue: boolean = false): boolean => {
    const input = getAllInput()
    const value = input[key]
    if (value === undefined || value === null) return defaultValue
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === '1' || value === 1) return true
    if (value === 'false' || value === '0' || value === 0) return false
    return defaultValue
  }

  ;(req as any).array = <T = unknown>(key: string): T[] => {
    const input = getAllInput()
    const value = input[key]
    if (Array.isArray(value)) return value as T[]
    return value !== undefined && value !== null ? [value as T] : []
  }

  // File handling methods - returns UploadedFile with store/storeAs methods
  ;(req as any).file = (key: string): UploadedFile | null => {
    const files = (req as any).files || {}
    const file = files[key]
    if (!file) return null
    const rawFile = Array.isArray(file) ? file[0] : file
    return rawFile ? new UploadedFile(rawFile) : null
  }

  ;(req as any).getFiles = (key: string): UploadedFile[] => {
    const files = (req as any).files || {}
    const file = files[key]
    if (!file) return []
    const fileArray = Array.isArray(file) ? file : [file]
    return fileArray.map(f => new UploadedFile(f))
  }

  ;(req as any).hasFile = (key: string): boolean => {
    const files = (req as any).files || {}
    return key in files && files[key] !== undefined
  }

  ;(req as any).allFiles = (): Record<string, UploadedFile | UploadedFile[]> => {
    const files = (req as any).files || {}
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
  ;(req as any).user = async (): Promise<any> => {
    // Return user set by auth middleware (e.g., BearerToken middleware)
    return (req as any)._authenticatedUser
  }

  // Get the current access token instance
  ;(req as any).userToken = async (): Promise<any> => {
    return (req as any)._currentAccessToken
  }

  // Check if the current token has an ability.
  // Strict: a missing token, a token without an `abilities` array, or
  // a non-string ability all fail-closed. Earlier shape did
  // `token.abilities?.includes('*')` which silently accepted any object
  // with a truthy `abilities[Symbol.iterator]` — a malformed token
  // produced by a partially-completed auth race could grant wildcard
  // permissions because of how `?.includes` resolves on non-arrays.
  ;(req as any).tokenCan = async (ability: string): Promise<boolean> => {
    if (typeof ability !== 'string' || ability.length === 0) return false
    const token = (req as any)._currentAccessToken
    if (!token || typeof token !== 'object') return false
    if (!Array.isArray(token.abilities)) return false
    if (token.abilities.includes('*')) return true
    return token.abilities.includes(ability)
  }

  // Check if the current token does NOT have an ability
  ;(req as any).tokenCant = async (ability: string): Promise<boolean> => {
    return !(await (req as any).tokenCan(ability))
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
  // handler is a callable function (RouteHandler or TypedRouteHandler)
  return handler
}

/**
 * Parse request body and attach to request object
 */
async function parseRequestBody(req: EnhancedRequest): Promise<void> {
  // Skip if body was already parsed (avoid double-parsing)
  if ((req as any)._bodyParsed) return
  ;(req as any)._bodyParsed = true

  const contentType = req.headers.get('content-type') || ''

  try {
    // Clone once up front — only the branch that matches content-type will use it
    if (contentType.includes('application/json')) {
      const body = await req.clone().json()
      ;(req as any).jsonBody = body
    }
    else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.clone().text()
      const params = new URLSearchParams(text)
      const formBody: Record<string, string> = {}
      params.forEach((value, key) => {
        formBody[key] = value
      })
      ;(req as any).formBody = formBody
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

      ;(req as any).formBody = formBody
      ;(req as any).files = files
    }
  }
  catch (e) {
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

  // Helper to register a route with group middleware applied
  function registerRoute(method: string, path: string, _handler: StacksHandler) {
    const fullPath = currentPrefix + path
    const routeKey = `${method}:${fullPath}`
    log.debug(`[router] ${method} ${fullPath} → ${typeof _handler === 'string' ? _handler : 'function'}`)

    // Pre-populate middleware registry with group middleware
    if (currentGroupMiddleware.length > 0) {
      routeMiddlewareRegistry.set(routeKey, [...currentGroupMiddleware])
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

      log.debug(`[router] Entering group: prefix=${options.prefix || '/'} middleware=[${middlewareList?.join(', ') || ''}]`)

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
          return stacksRouter
        }).catch((err) => {
          currentPrefix = previousPrefix
          currentGroupMiddleware = previousMiddleware
          throw err
        })
      }

      // Sync callback - restore state immediately
      currentPrefix = previousPrefix
      currentGroupMiddleware = previousMiddleware
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
    health() {
      bunRouter.get('/health', async () => {
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
        return Response.json(body, { status: healthy ? 200 : 503 })
      })
      // Internal route-introspection endpoint. Powers `buddy dev` route
      // listing on startup and future `buddy route:list` consumers.
      // Locked to dev/staging via the `STACKS_EXPOSE_ROUTES` env so
      // production deployments don't unintentionally publish their
      // route surface to the outside world.
      bunRouter.get('/__routes', () => {
        const env = (process.env.APP_ENV ?? '').toLowerCase()
        const isProd = env === 'production' || process.env.NODE_ENV === 'production'
        if (isProd && process.env.STACKS_EXPOSE_ROUTES !== '1') {
          return Response.json({ error: 'disabled in production' }, { status: 404 })
        }
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
        const params = (req as any).params as Record<string, string> | undefined
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
      bunRouter.get('/__openapi.json', async () => {
        const env = (process.env.APP_ENV ?? '').toLowerCase()
        const isProd = env === 'production' || process.env.NODE_ENV === 'production'
        if (isProd && process.env.STACKS_EXPOSE_ROUTES !== '1') {
          return Response.json({ error: 'disabled in production' }, { status: 404 })
        }
        try {
          const { generateOpenApi } = await import('@stacksjs/api')
          const spec = await (generateOpenApi as () => Promise<unknown>)()
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
    use(middleware: ActionHandler) {
      // bunRouter.use() is async, so we need to call it properly
      // For synchronous chaining, we push directly to globalMiddleware
      bunRouter.globalMiddleware.push(middleware as any)
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
