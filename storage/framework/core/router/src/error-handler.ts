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

function getJsonHeaders(): Record<string, string> {
  const isDev = process.env.APP_ENV !== 'production' && process.env.NODE_ENV !== 'production'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (isDev) {
    const appUrl = process.env.APP_URL ? `https://${process.env.APP_URL}` : '*'
    headers['Access-Control-Allow-Origin'] = appUrl
  }
  return headers
}

function getJsonHeadersFull(): Record<string, string> {
  const headers = getJsonHeaders()
  if (headers['Access-Control-Allow-Origin']) {
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  }
  return headers
}

// Circular buffer for tracked queries (avoids O(n) shift on every insert)
const MAX_QUERIES = 50
const queryBuffer: Array<{ query: string; time?: number; connection?: string } | null> = new Array(MAX_QUERIES).fill(null)
let queryWriteIndex = 0
let queryCount = 0

/**
 * Add a query to the recent queries list for error context.
 * Uses a circular buffer for O(1) insert instead of array.shift().
 */
export function trackQuery(query: string, time?: number, connection?: string): void {
  queryBuffer[queryWriteIndex] = { query, time, connection }
  queryWriteIndex = (queryWriteIndex + 1) % MAX_QUERIES
  if (queryCount < MAX_QUERIES) queryCount++
}

/**
 * Get tracked queries in insertion order
 */
function getRecentQueries(): Array<{ query: string; time?: number; connection?: string }> {
  if (queryCount === 0) return []
  const result: Array<{ query: string; time?: number; connection?: string }> = []
  const start = queryCount < MAX_QUERIES ? 0 : queryWriteIndex
  for (let i = 0; i < queryCount; i++) {
    const entry = queryBuffer[(start + i) % MAX_QUERIES]
    if (entry) result.push(entry)
  }
  return result
}

/**
 * Clear tracked queries (e.g., after successful response)
 */
export function clearTrackedQueries(): void {
  queryBuffer.fill(null)
  queryWriteIndex = 0
  queryCount = 0
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
  const req = request as any
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
async function getUserContext(request: Request | EnhancedRequest): Promise<{ id?: string | number; email?: string; name?: string } | undefined> {
  const req = request as any
  // Check if user was set by auth middleware
  if (req._authenticatedUser) {
    const user = req._authenticatedUser
    return {
      id: user.id,
      email: user.email,
      name: user.name || user.username,
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
  const isDevelopment = process.env.APP_ENV !== 'production' && process.env.NODE_ENV !== 'production'

  if (!isDevelopment) {
    // Production: return simple JSON or HTML error
    const acceptHeader = request.headers.get('Accept') || ''
    if (acceptHeader.includes('application/json')) {
      return new Response(
        buildErrorJson({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
          status,
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

    // Check if request wants JSON (API request)
    const acceptHeader = request.headers.get('Accept') || ''
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production'
    if (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')) {
      // Return JSON error for API requests. In production, strip the
      // stack trace and recent-queries log — those leak file paths,
      // function names, query shapes, and (potentially) parameter
      // values that an attacker can use to fingerprint the deployment.
      // The dev/staging response keeps them for fast debugging.
      const details: Record<string, unknown> = { handler: options?.handlerPath }
      if (!isProduction) {
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
      : (isProduction ? request.headers.get('origin') ?? 'null' : '*')
    const html = handler.render(error, status)
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
  error: Error & { statusCode?: number, status?: number },
  request: Request | EnhancedRequest,
): Promise<Response> {
  const status = error.statusCode ?? error.status ?? 500
  const isDevelopment = process.env.APP_ENV !== 'production' && process.env.NODE_ENV !== 'production'

  // For 4xx errors, return JSON in both dev and prod
  if (status >= 400 && status < 500) {
    return new Response(
      buildErrorJson({
        error: error.name || 'ClientError',
        message: error.message,
        status,
      }),
      { status, headers: getJsonHeaders() },
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
  const isDevelopment = process.env.APP_ENV !== 'production' && process.env.NODE_ENV !== 'production'

  if (isDevelopment) {
    const error = new Error(`Route not found: ${path}`)
    error.name = 'NotFoundError'
    return await createErrorResponse(error, request, { status: 404 })
  }

  return new Response(renderProductionErrorPage(404), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
