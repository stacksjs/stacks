/**
 * Stacks Error Handler - Ignition-style error pages
 *
 * Provides beautiful development error pages with full stack traces,
 * database queries, and request context.
 */

import type { EnhancedRequest } from '@stacksjs/bun-router'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import {
  createErrorHandler,
  renderProductionErrorPage,
  type ErrorPageConfig,
} from '@stacksjs/error-handling'
import { isApiRequest } from './api-shape'
import { getCurrentRequest } from './request-context'

/**
 * Standard error response structure used across all JSON error responses.
 */
export interface ErrorResponseBody {
  error: string
  message: string
  status: number
  timestamp: string
  details?: Record<string, unknown>
}

function buildErrorJson(opts: {
  error: string
  message: string
  status: number
  details?: Record<string, unknown>
}): string {
  const body: ErrorResponseBody = {
    error: opts.error,
    message: opts.message,
    status: opts.status,
    timestamp: new Date().toISOString(),
  }
  if (opts.details) body.details = opts.details
  return JSON.stringify(body)
}

/**
 * Single source of truth for "is this deployment allowed to surface
 * debug info (stack traces, recent queries, error names) to API
 * clients?" Default-deny: only an explicit `APP_ENV='development'`
 * (or `NODE_ENV='development'` when APP_ENV is unset) opts in.
 *
 * The previous predicates were asymmetric: `isDevelopment` checked
 * `APP_ENV !== 'production' && NODE_ENV !== 'production'`, which
 * treated `APP_ENV='staging'` as "development" and leaked stack
 * traces + recent-query shapes to staging API clients. Staging
 * deployments often touch real data and real third-party tokens, so
 * those leaks are exploitable. See stacksjs/stacks#1859 H-10.
 */
function isDebugAllowed(): boolean {
  const appEnv = (process.env.APP_ENV ?? '').toLowerCase()
  if (appEnv === 'development') return true
  if (!appEnv && process.env.NODE_ENV === 'development') return true
  return false
}

function getJsonHeaders(): Record<string, string> {
  // CORS headers used to be emitted here directly using `APP_URL` env,
  // independent of the configured CORS policy. That meant error
  // responses could advertise different allowed origins than success
  // responses (and in dev defaulted to `*` regardless of policy).
  // The router's post-response CORS wrapper now owns all CORS header
  // injection, applying the configured policy uniformly to success
  // and error paths. See stacksjs/stacks#1859 H-3.
  return { 'Content-Type': 'application/json' }
}

function getJsonHeadersFull(): Record<string, string> {
  // Same rationale as `getJsonHeaders` — defer CORS to the post-response
  // wrapper rather than emit policy-inconsistent headers from here.
  return getJsonHeaders()
}

// Circular buffer for tracked queries (avoids O(n) shift on every insert).
// State is scoped per-request via the ALS-backed request context; when
// no request is in scope (CLI scripts, queued jobs, tests outside
// `runWithRequest`) a single process-wide fallback bucket is used so
// the helpers still work — but error pages and N+1 detection inside a
// request never cross-contaminate with state from a concurrent request
// running on the same worker (stacksjs/stacks#1863 T-5, #1859 H-4).
const MAX_QUERIES = 50
const N1_THRESHOLD = 5

interface QueryTrack {
  buffer: Array<{ query: string, time?: number, connection?: string } | null>
  writeIndex: number
  count: number
  shapeCounts: Map<string, number>
  n1Warned: Set<string>
}

function newQueryTrack(): QueryTrack {
  return {
    buffer: new Array(MAX_QUERIES).fill(null),
    writeIndex: 0,
    count: 0,
    shapeCounts: new Map<string, number>(),
    n1Warned: new Set<string>(),
  }
}

const REQUEST_QUERY_TRACK_KEY = Symbol.for('stacks.queryTracking')

// Used only when no request is in scope. Cleared lazily — tests that
// don't go through `runWithRequest` can still call `clearTrackedQueries()`
// to reset between assertions.
let fallbackTrack: QueryTrack = newQueryTrack()

function getQueryTrack(): QueryTrack {
  const req = getCurrentRequest() as (EnhancedRequest & { [k: symbol]: unknown }) | undefined
  if (!req) return fallbackTrack
  let track = req[REQUEST_QUERY_TRACK_KEY] as QueryTrack | undefined
  if (!track) {
    track = newQueryTrack()
    ;(req as Record<symbol, unknown>)[REQUEST_QUERY_TRACK_KEY] = track
  }
  return track
}

/**
 * Normalize a query string for shape-comparison. Strips bound values
 * (`= 1`, `= 'foo'`, `IN (1, 2, 3)`), collapses whitespace, and uppercases
 * keywords so two queries that differ only in their parameter values
 * end up in the same bucket.
 */
function normalizeQueryShape(query: string): string {
  return query
    // Quoted strings (single + double) → ?
    .replace(/'(?:[^']|'')*'/g, '?')
    .replace(/"(?:[^"]|"")*"/g, '?')
    // Numbers → ?
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    // Multi-value IN lists → IN (?)
    .replace(/IN\s*\([^)]*\)/gi, 'IN (?)')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * Add a query to the recent queries list for error context.
 * Uses a circular buffer for O(1) insert instead of array.shift().
 *
 * Also runs N+1 detection: when the same query *shape* (with bound
 * values normalized away) repeats more than `N1_THRESHOLD` times within
 * a single request lifecycle, we warn once via `log.warn`. The signal
 * is highly correlated with missing eager loading.
 */
export function trackQuery(query: string, time?: number, connection?: string): void {
  const track = getQueryTrack()
  track.buffer[track.writeIndex] = { query, time, connection }
  track.writeIndex = (track.writeIndex + 1) % MAX_QUERIES
  if (track.count < MAX_QUERIES) track.count++

  // N+1 heuristic — only active in dev. The check is deliberately cheap
  // (one normalize + map increment per query) so we can leave it on by
  // default without measurably increasing query latency.
  if (!isDebugAllowed()) return
  const shape = normalizeQueryShape(query)
  // Skip framework's own bookkeeping queries (query_logs INSERT, EXPLAIN).
  if (shape.startsWith('INSERT INTO QUERY_LOGS') || shape.startsWith('EXPLAIN')) return
  const next = (track.shapeCounts.get(shape) ?? 0) + 1
  track.shapeCounts.set(shape, next)
  if (next === N1_THRESHOLD + 1 && !track.n1Warned.has(shape)) {
    track.n1Warned.add(shape)
    // Lazy import so this file stays free of @stacksjs/logging in case
    // logging is the failing component during error rendering.
    import('@stacksjs/logging').then(({ log }) => {
      log.warn(
        `[orm] Possible N+1 — query shape ran ${next}× in this request:\n  ${shape}\n  `
        + `Hint: load related rows with .with('relation') or eager-load via includes() before iterating.`,
      )
    }).catch(() => { /* logging unavailable — silently skip */ })
  }
}

/**
 * Get tracked queries in insertion order (for the active request, or
 * the fallback bucket when called outside a request scope).
 */
function getRecentQueries(): Array<{ query: string, time?: number, connection?: string }> {
  const track = getQueryTrack()
  if (track.count === 0) return []
  const result: Array<{ query: string, time?: number, connection?: string }> = []
  const start = track.count < MAX_QUERIES ? 0 : track.writeIndex
  for (let i = 0; i < track.count; i++) {
    const entry = track.buffer[(start + i) % MAX_QUERIES]
    if (entry) result.push(entry)
  }
  return result
}

/**
 * Snapshot of query shape counts for the active request. Useful for
 * tests asserting that an action ran a single query for `posts`
 * instead of one-per-user.
 */
export function getQueryShapeCounts(): ReadonlyMap<string, number> {
  return new Map(getQueryTrack().shapeCounts)
}

/**
 * Reset query tracking for the active scope.
 *
 * Inside a request, this clears the per-request tracking object — but
 * the object is also auto-collected when the request goes out of scope,
 * so the explicit call is mainly useful for tests that re-use a single
 * request. Outside a request, this clears the process-wide fallback.
 */
export function clearTrackedQueries(): void {
  const req = getCurrentRequest() as (EnhancedRequest & { [k: symbol]: unknown }) | undefined
  if (req && req[REQUEST_QUERY_TRACK_KEY]) {
    ;(req as Record<symbol, unknown>)[REQUEST_QUERY_TRACK_KEY] = newQueryTrack()
    return
  }
  fallbackTrack = newQueryTrack()
}

/**
 * Get the error handler configuration
 */
function getErrorHandlerConfig(): ErrorPageConfig {
  return {
    appName: 'Stacks',
    theme: 'auto',
    showEnvironment: true,
    showQueries: true,
    showRequest: true,
    enableCopyMarkdown: true,
    snippetLines: 8,
    basePaths: [process.cwd()],
  }
}

/**
 * Sensitive fields that should be hidden in error pages
 */
/**
 * Patterns for detecting sensitive fields (matched case-insensitively).
 * Each entry is checked via `lowerKey.includes(pattern)`.
 */
const SENSITIVE_PATTERNS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'access_key',
  'accesskey',
  'private_key',
  'privatekey',
  'credit_card',
  'creditcard',
  'card_number',
  'cardnumber',
  'cvv',
  'ssn',
  'authorization',
  'credential',
  'aws_secret',
  'aws_access',
  'database_password',
  'db_password',
  'encryption_key',
  'signing_key',
  'bearer',
  'session_id',
  'sessionid',
  'cookie',
]

/**
 * Sanitize object by hiding sensitive fields.
 *
 * Walks objects + arrays, redacting any field whose key matches a
 * sensitive pattern (token/password/secret/etc). Cycle-safe via a
 * WeakSet — a circular request body (or an Express-style req object
 * that links back to itself through `req.connection.server.connections`)
 * used to send the recursion past `MAX_SANITIZE_DEPTH` and silently
 * truncate; cycle detection keeps the structure intact while still
 * bounding work.
 */
const MAX_SANITIZE_DEPTH = 10
const CIRCULAR_PLACEHOLDER = '[Circular]'

function sanitizeData(data: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (!data || typeof data !== 'object' || depth >= MAX_SANITIZE_DEPTH) {
    return data
  }
  if (seen.has(data as object)) return CIRCULAR_PLACEHOLDER
  seen.add(data as object)

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1, seen))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern))) {
      sanitized[key] = '********'
    }
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, depth + 1, seen)
    }
    else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Get request body from enhanced request (already parsed)
 */
function getRequestBody(request: Request | EnhancedRequest): unknown {
  const req = request as EnhancedRequest
  if (req.jsonBody) {
    return sanitizeData(req.jsonBody)
  }
  if (req.formBody) {
    return sanitizeData(req.formBody)
  }
  return undefined
}

/**
 * Get user context from authenticated user on request
 */
async function getUserContext(request: Request | EnhancedRequest): Promise<{ id?: string | number, email?: string, name?: string } | undefined> {
  const req = request as EnhancedRequest
  // Check if user was set by auth middleware. The shape is project-
  // defined (`_authenticatedUser` is typed `unknown` in the request
  // augmentation), so narrow to the fields we actually read.
  const authed = req._authenticatedUser as { id?: string | number, email?: string, name?: string, username?: string } | undefined
  if (authed) {
    return {
      id: authed.id,
      email: authed.email,
      name: authed.name || authed.username,
    }
  }
  return undefined
}

/**
 * Create an Ignition-style error response for development
 */
export async function createErrorResponse(
  error: Error,
  request: Request | EnhancedRequest,
  options?: {
    status?: number
    handlerPath?: string
    routingContext?: {
      controller?: string
      routeName?: string
      middleware?: string[]
    }
  },
): Promise<Response> {
  const status = options?.status || 500
  log.debug(`[error] ${status} ${error.message}`)
  const debugAllowed = isDebugAllowed()

  if (!debugAllowed) {
    // Production OR staging: JSON-first. Only render the HTML production
    // error page
    // when the client explicitly opted into HTML (top-level browser nav).
    // The old check required `Accept: application/json` literally, which
    // missed `Accept: */*` (curl + fetch default) and silently leaked an
    // HTML page to JSON-consuming clients.
    if (isApiRequest(request)) {
      // 4xx messages are meant for the caller (validation copy, dedupe vs.
      // invalid, field-level errors), so surface `error.name` / `error.message`
      // / `details` for client errors and keep masking 5xx to avoid leaking
      // internals. Mirrors `createMiddlewareErrorResponse` so an
      // `HttpError(4xx, …)` reads the same whether it's thrown from middleware
      // or an action handler. See stacksjs/stacks#1946.
      const isClientError = status >= 400 && status < 500
      const errDetails = (error as { details?: unknown }).details
      return new Response(
        buildErrorJson({
          error: isClientError ? (error.name || 'Client Error') : 'Internal Server Error',
          message: isClientError ? error.message : 'An unexpected error occurred.',
          status,
          details: isClientError && errDetails && typeof errDetails === 'object'
            ? errDetails as Record<string, unknown>
            : undefined,
        }),
        { status, headers: getJsonHeaders() },
      )
    }
    return new Response(renderProductionErrorPage(status), {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Development: create full Ignition-style error page
  try {
    const handler = createErrorHandler(getErrorHandlerConfig())

    // Set framework info
    handler.setFramework('Stacks', '0.70.0')

    // Set request context with body
    const requestBody = getRequestBody(request)
    if (requestBody) {
      const url = new URL(request.url)
      handler.setRequest({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        queryParams: Object.fromEntries(url.searchParams.entries()),
        body: requestBody,
      })
    }
    else {
      handler.setRequest(request)
    }

    // Set user context if authenticated
    const userContext = await getUserContext(request)
    if (userContext) {
      handler.setUser(userContext)
    }

    // Set routing context if available
    if (options?.routingContext) {
      handler.setRouting(options.routingContext)
    }
    else if (options?.handlerPath) {
      // Create basic routing context from handler path
      handler.setRouting({
        controller: options.handlerPath,
      })
    }

    // Add tracked queries
    for (const query of getRecentQueries()) {
      handler.addQuery(query.query, query.time, query.connection)
    }

    // Decide JSON vs HTML via the shared `isApiRequest()` predicate so
    // every response path (errors, formatResult, 404s) makes the same call.
    // The Ignition-style HTML page only renders for explicit top-level
    // browser navigations; everything else — fetch, curl, API clients —
    // gets JSON.
    if (isApiRequest(request)) {
      // Return JSON error for API requests. Outside development, strip
      // the stack trace and recent-queries log — those leak file paths,
      // function names, query shapes, and (potentially) parameter
      // values that an attacker can use to fingerprint the deployment.
      // Staging used to receive the dev payload here, which leaked
      // details on shared infra (stacksjs/stacks#1859 H-10).
      const details: Record<string, unknown> = { handler: options?.handlerPath }
      if (isDebugAllowed()) {
        details.stack = error.stack?.split('\n').slice(0, 10)
        details.queries = getRecentQueries().slice(-10)
      }
      return new Response(
        buildErrorJson({
          error: error.name || 'Error',
          message: error.message,
          status,
          details,
        }),
        { status, headers: getJsonHeadersFull() },
      )
    }

    // Return HTML error page. CORS origin: prefer the configured APP_URL.
    // Wildcard `*` for CORS on a 5xx response is safe-ish (no credentials),
    // but it's better DX to reflect the configured origin so curl/Postman
    // see consistent behavior with successful responses.
    const corsOrigin = process.env.APP_URL
      ? (process.env.APP_URL.startsWith('http') ? process.env.APP_URL : `https://${process.env.APP_URL}`)
      : (isDebugAllowed() ? '*' : request.headers.get('origin') ?? 'null')
    const html = await handler.render(error, status)
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin,
      },
    })
  }
  catch (renderError) {
    // Fallback to simple error page if rendering fails
    console.error('[Error Handler] Failed to render error page:', renderError)
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    return new Response(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>${escapeHtml(error.message)}</p>
          <pre>${escapeHtml(error.stack || '')}</pre>
        </body>
      </html>
    `, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

/**
 * Create a middleware error response (401, 403, etc.)
 *
 * Reads `statusCode` OR `status` off the error so both shapes are honored:
 * - middleware that throws `Object.assign(new Error('msg'), { statusCode: 401 })`
 * - framework HttpError instances where the field is named `status`
 *
 * Without the `status` fallback, every `HttpError(401, …)` throw from auth or
 * validation middleware leaks out as a 500 with an Ignition error page —
 * which is what we used to ship for `GET /api/me` without a token.
 */
export async function createMiddlewareErrorResponse(
  error: Error & { statusCode?: number, status?: number, headers?: Record<string, string> },
  request: Request | EnhancedRequest,
): Promise<Response> {
  const status = error.statusCode ?? error.status ?? 500
  const isDevelopment = isDebugAllowed()

  // For 4xx errors, return JSON in both dev and prod
  if (status >= 400 && status < 500) {
    // Merge in any per-error headers (e.g. `Retry-After` from
    // rate-limit 429s — stacksjs/stacks#1870 R-8). JSON headers
    // win on collision so content-type stays correct.
    const headers = error.headers
      ? { ...error.headers, ...getJsonHeaders() }
      : getJsonHeaders()
    return new Response(
      buildErrorJson({
        error: error.name || 'ClientError',
        message: error.message,
        status,
      }),
      { status, headers },
    )
  }

  // For 5xx errors in development, show full error page
  if (isDevelopment) {
    return await createErrorResponse(error, request, { status })
  }

  // Production 5xx
  return new Response(
    buildErrorJson({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
      status,
    }),
    { status, headers: getJsonHeaders() },
  )
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  errors: Record<string, string[]>,
  _request: Request | EnhancedRequest,
): Response {
  return new Response(
    buildErrorJson({
      error: 'ValidationError',
      message: 'Validation failed',
      status: 422,
      details: { errors },
    }),
    { status: 422, headers: getJsonHeaders() },
  )
}

/**
 * Create a 404 Not Found response
 */
export async function createNotFoundResponse(
  path: string,
  request: Request | EnhancedRequest,
): Promise<Response> {
  const isDevelopment = isDebugAllowed()

  if (isDevelopment) {
    const error = new Error(`Route not found: ${path}`)
    error.name = 'NotFoundError'
    return await createErrorResponse(error, request, { status: 404 })
  }

  // Production: JSON-first 404. Only render the HTML production page when
  // the client explicitly opted into HTML (top-level browser nav).
  if (isApiRequest(request)) {
    return new Response(
      buildErrorJson({
        error: 'NotFound',
        message: `Route not found: ${path}`,
        status: 404,
      }),
      { status: 404, headers: getJsonHeaders() },
    )
  }

  return new Response(renderProductionErrorPage(404), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
