/**
 * Stacks Error Handler - Ignition-style error pages
 *
 * Provides beautiful development error pages with full stack traces,
 * database queries, and request context.
 */

import type { EnhancedRequest } from 'bun-router'
import process from 'node:process'
import {
  createErrorHandler,
  renderProductionErrorPage,
  type ErrorPageConfig,
} from '@stacksjs/error-handling'

// Store queries for error context
let recentQueries: Array<{ query: string; time?: number; connection?: string }> = []

// Maximum queries to keep in memory
const MAX_QUERIES = 50

/**
 * Add a query to the recent queries list for error context
 */
export function trackQuery(query: string, time?: number, connection?: string): void {
  recentQueries.push({ query, time, connection })
  if (recentQueries.length > MAX_QUERIES) {
    recentQueries.shift()
  }
}

/**
 * Clear tracked queries (e.g., after successful response)
 */
export function clearTrackedQueries(): void {
  recentQueries = []
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
const SENSITIVE_FIELDS = [
  'password',
  'password_confirmation',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'api_secret',
  'apiSecret',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'private_key',
  'privateKey',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'ssn',
  'authorization',
]

/**
 * Sanitize object by hiding sensitive fields
 */
function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData)
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '********'
    }
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value)
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
  const isDevelopment = process.env.APP_ENV !== 'production' && process.env.NODE_ENV !== 'production'

  if (!isDevelopment) {
    // Production: return simple JSON or HTML error
    const acceptHeader = request.headers.get('Accept') || ''
    if (acceptHeader.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        }),
        {
          status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
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
    for (const query of recentQueries) {
      handler.addQuery(query.query, query.time, query.connection)
    }

    // Check if request wants JSON (API request)
    const acceptHeader = request.headers.get('Accept') || ''
    if (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')) {
      // Return JSON error for API requests
      return new Response(
        JSON.stringify({
          error: error.name || 'Error',
          message: error.message,
          handler: options?.handlerPath,
          stack: error.stack?.split('\n').slice(0, 10),
          queries: recentQueries.slice(-10),
        }),
        {
          status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        },
      )
    }

    // Return HTML error page
    const html = handler.render(error, status)
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
  catch (renderError) {
    // Fallback to simple error page if rendering fails
    console.error('[Error Handler] Failed to render error page:', renderError)
    return new Response(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>${error.message}</p>
          <pre>${error.stack}</pre>
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
 */
export async function createMiddlewareErrorResponse(
  error: Error & { statusCode?: number },
  request: Request | EnhancedRequest,
): Promise<Response> {
  const status = error.statusCode || 500
  const isDevelopment = process.env.APP_ENV !== 'production' && process.env.NODE_ENV !== 'production'

  // For 4xx errors, return JSON in both dev and prod
  if (status >= 400 && status < 500) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }

  // For 5xx errors in development, show full error page
  if (isDevelopment) {
    return await createErrorResponse(error, request, { status })
  }

  // Production 5xx
  return new Response(
    JSON.stringify({ error: 'Internal Server Error' }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  errors: Record<string, string[]>,
  request: Request | EnhancedRequest,
): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      errors,
    }),
    {
      status: 422,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
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
