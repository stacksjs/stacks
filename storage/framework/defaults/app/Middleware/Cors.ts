import { config } from '@stacksjs/config'
import { Middleware } from '@stacksjs/router'

/**
 * CORS Middleware
 *
 * Implements the Cross-Origin Resource Sharing protocol on top of the
 * Stacks middleware pipeline. Two responsibilities:
 *
 *   1. **Preflight (OPTIONS)** — short-circuit with a 204 + CORS headers.
 *      No further middleware runs, no action runs.
 *   2. **Regular requests** — pass through to the action, then attach the
 *      configured CORS headers to the outgoing response.
 *
 * Because the Stacks middleware runner only invokes `handle()` *before* the
 * action (no native post-response hook), the response-mutation half of
 * this middleware uses the same marker pattern as `Compress.ts`: `handle`
 * stamps the request with `_corsOptions`, and the router applies the
 * headers via {@link applyCorsHeaders} after the action returns.
 *
 * **Configuration**
 *
 * Reads from `config.cors`. If unset, sensible defaults are used:
 * - `origin: '*'`
 * - `methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`
 * - `allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']`
 * - `exposedHeaders: []`
 * - `credentials: false`
 * - `maxAge: 86400` (24h)
 *
 * Expected config shape (add to `config/cors.ts` or under `config/app.ts`):
 * ```ts
 * export default {
 *   cors: {
 *     origin: '*' | string[] | (origin: string) => boolean,
 *     methods?: string[],
 *     allowedHeaders?: string[],
 *     exposedHeaders?: string[],
 *     credentials?: boolean,
 *     maxAge?: number,
 *   }
 * }
 * ```
 *
 * **Vary header**
 *
 * `Vary: Origin` is set unconditionally on responses that include CORS
 * headers. Without it, an HTTP cache could serve a response with
 * `Access-Control-Allow-Origin: https://a.com` to a request from
 * `https://b.com`. We also append `Access-Control-Request-Headers` and
 * `Access-Control-Request-Method` to Vary on preflight so caches don't
 * conflate two preflights with different requested headers/methods.
 *
 * **Credentials safety**
 *
 * When `credentials: true`, the spec forbids `Access-Control-Allow-Origin: *`.
 * In that case we echo the request's Origin (only if it matches the
 * configured allow-list) or omit the header entirely — never `*`. This
 * prevents the most common credentials-bypass misconfiguration.
 *
 * @example
 * ```ts
 * route.get('/api/*', 'Actions/Api').middleware('cors')
 * route.options('/api/*', () => new Response(null)).middleware('cors')
 * ```
 */

/** Resolved CORS configuration with all defaults applied. */
export interface ResolvedCorsConfig {
  origin: '*' | string[] | ((origin: string) => boolean)
  methods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  credentials: boolean
  maxAge: number
}

/** Raw CORS config shape — every field optional. */
export interface CorsConfig {
  origin?: '*' | string[] | ((origin: string) => boolean)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

/** Defaults used when `config.cors` is missing or partial. */
const DEFAULT_CORS: ResolvedCorsConfig = {
  origin: '*',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86_400,
}

/**
 * Read `config.cors` and merge with defaults. Fail-soft — if config access
 * throws (e.g. before bootstrap), we fall back to defaults rather than
 * crashing the request.
 */
function resolveCorsConfig(): ResolvedCorsConfig {
  try {
    // `config` is a proxy — accessing a missing key returns undefined, not throws.
    // The `as any` lookup is the only place we accept it because the cors key
    // is not yet in the typed config schema.
    // eslint-disable-next-line ts/no-explicit-any
    const userConfig = (config as any).cors as CorsConfig | undefined
    if (!userConfig)
      return DEFAULT_CORS
    return {
      origin: userConfig.origin ?? DEFAULT_CORS.origin,
      methods: userConfig.methods ?? DEFAULT_CORS.methods,
      allowedHeaders: userConfig.allowedHeaders ?? DEFAULT_CORS.allowedHeaders,
      exposedHeaders: userConfig.exposedHeaders ?? DEFAULT_CORS.exposedHeaders,
      credentials: userConfig.credentials ?? DEFAULT_CORS.credentials,
      maxAge: userConfig.maxAge ?? DEFAULT_CORS.maxAge,
    }
  }
  catch {
    return DEFAULT_CORS
  }
}

/**
 * Decide whether a given Origin is allowed under the configured policy.
 *
 * - `'*'` — every origin allowed (but see credentials note below).
 * - `string[]` — exact-match list.
 * - `(origin) => boolean` — caller-defined predicate.
 */
function isOriginAllowed(origin: string, policy: ResolvedCorsConfig['origin']): boolean {
  if (policy === '*')
    return true
  if (Array.isArray(policy))
    return policy.includes(origin)
  if (typeof policy === 'function')
    return policy(origin)
  return false
}

/**
 * Compute the value to send in `Access-Control-Allow-Origin`, honoring the
 * "no `*` with credentials" rule.
 *
 * Returns:
 * - the matched origin string (echoes the request, or `*` when no creds + wildcard policy)
 * - `null` if the origin is disallowed (caller should omit the header entirely)
 */
function computeAllowOrigin(
  requestOrigin: string | null,
  cfg: ResolvedCorsConfig,
): string | null {
  // No Origin header → not a CORS request from the browser's perspective;
  // we still set Vary in case a cache later serves the same URL.
  if (!requestOrigin)
    return cfg.origin === '*' && !cfg.credentials ? '*' : null

  if (!isOriginAllowed(requestOrigin, cfg.origin))
    return null

  // Credentials mode forbids the literal `*` per the CORS spec — browsers
  // reject the response if both are present. Echo the actual origin
  // instead so the Allow-Credentials response is usable.
  if (cfg.credentials)
    return requestOrigin

  // Non-credentials wildcard policy: prefer `*` so caches collapse all
  // origins onto one stored response (more cacheable than per-origin echo).
  if (cfg.origin === '*')
    return '*'

  return requestOrigin
}

/**
 * Append a token to a comma-separated header value if not already present
 * (case-insensitive). Returns the new header value.
 */
function appendVary(existing: string | null, token: string): string {
  if (!existing)
    return token
  const tokens = existing.split(',').map(s => s.trim().toLowerCase())
  if (tokens.includes(token.toLowerCase()))
    return existing
  return `${existing}, ${token}`
}

/**
 * Build the preflight (OPTIONS) response. Returns 204 with the configured
 * CORS headers — does NOT proceed to the next middleware or action.
 *
 * @example
 * ```ts
 * if (request.method === 'OPTIONS')
 *   throw buildPreflightResponse(request, resolveCorsConfig())
 * ```
 */
export function buildPreflightResponse(request: Request, cfg: ResolvedCorsConfig): Response {
  const headers = new Headers()
  const requestOrigin = request.headers.get('origin')
  const allowOrigin = computeAllowOrigin(requestOrigin, cfg)

  if (allowOrigin !== null)
    headers.set('Access-Control-Allow-Origin', allowOrigin)

  // Vary on every dimension that influences the preflight response so
  // shared caches don't blend two clients' answers.
  headers.set('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers')

  if (cfg.credentials)
    headers.set('Access-Control-Allow-Credentials', 'true')

  // Echo the requested method if it's in our allow-list; otherwise advertise
  // the configured methods. This keeps the preflight tight when the client
  // is asking about a specific method.
  const requestedMethod = request.headers.get('access-control-request-method')
  const methods
    = requestedMethod && cfg.methods.includes(requestedMethod.toUpperCase())
      ? [requestedMethod.toUpperCase()]
      : cfg.methods
  headers.set('Access-Control-Allow-Methods', methods.join(', '))

  // Echo the requested headers (typically lowercase) — the browser sends
  // them and the spec allows us to reflect rather than enumerate.
  const requestedHeaders = request.headers.get('access-control-request-headers')
  if (requestedHeaders)
    headers.set('Access-Control-Allow-Headers', requestedHeaders)
  else if (cfg.allowedHeaders.length > 0)
    headers.set('Access-Control-Allow-Headers', cfg.allowedHeaders.join(', '))

  if (cfg.maxAge > 0)
    headers.set('Access-Control-Max-Age', String(cfg.maxAge))

  // 204 No Content is the canonical preflight response — it's what
  // express/cors, fastify-cors, and Hono all emit.
  return new Response(null, { status: 204, headers })
}

/**
 * Apply CORS headers to a non-preflight response. Mutates a clone of the
 * original (Headers may be immutable on some Response shapes) and returns
 * the new instance. Always sets `Vary: Origin` so caches don't serve
 * cross-origin responses for the wrong origin.
 *
 * @example
 * ```ts
 * const response = await action.handle(req)
 * return applyCorsHeaders(req, response)
 * ```
 */
export function applyCorsHeaders(request: Request, response: Response, cfg?: ResolvedCorsConfig): Response {
  const config = cfg ?? resolveCorsConfig()
  const requestOrigin = request.headers.get('origin')
  const allowOrigin = computeAllowOrigin(requestOrigin, config)

  // Try to mutate in place first — fastest path. If headers are immutable
  // (some Response implementations), fall through to the rebuild path.
  try {
    if (allowOrigin !== null)
      response.headers.set('Access-Control-Allow-Origin', allowOrigin)
    response.headers.set('Vary', appendVary(response.headers.get('Vary'), 'Origin'))
    if (config.credentials)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    if (config.exposedHeaders.length > 0)
      response.headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))
    return response
  }
  catch {
    // Fall through: response headers are immutable — rebuild.
  }

  const newHeaders = new Headers(response.headers)
  if (allowOrigin !== null)
    newHeaders.set('Access-Control-Allow-Origin', allowOrigin)
  newHeaders.set('Vary', appendVary(newHeaders.get('Vary'), 'Origin'))
  if (config.credentials)
    newHeaders.set('Access-Control-Allow-Credentials', 'true')
  if (config.exposedHeaders.length > 0)
    newHeaders.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

/**
 * Public re-export for the router to consume without re-deriving config.
 *
 * @example
 * ```ts
 * const cfg = getResolvedCorsConfig()
 * ```
 */
export function getResolvedCorsConfig(): ResolvedCorsConfig {
  return resolveCorsConfig()
}

export default new Middleware({
  name: 'cors',
  // CORS gating must run before auth/throttle so a 401/429 response still
  // carries the right CORS headers (otherwise the browser hides the body
  // from the SPA and the user sees a confusing "CORS error" instead of the
  // actual auth failure).
  priority: 0,

  async handle(request) {
    const cfg = resolveCorsConfig()

    // Preflight short-circuit — throwing a Response is the documented way
    // to halt the chain and return immediately. The router catches it and
    // sends it as-is.
    if (request.method === 'OPTIONS') {
      // Only treat as preflight if the spec-required header is present.
      // A bare OPTIONS without `Access-Control-Request-Method` may be a
      // server-status probe or method-discovery request — let the action
      // handle it.
      if (request.headers.get('access-control-request-method')) {
        // eslint-disable-next-line no-throw-literal
        throw buildPreflightResponse(request as unknown as Request, cfg)
      }
    }

    // Mark the request so the router's response-finalization step picks
    // up the CORS config. We stash the resolved config to avoid resolving
    // it twice per request.
    // eslint-disable-next-line ts/no-explicit-any
    ;(request as any)._corsConfig = cfg
  },
})
