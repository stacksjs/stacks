import {
  createErrorHandler,
  HTTP_ERRORS,
  renderProductionErrorPage,
} from './error-page'
import type {
  ErrorPageConfig,
  HttpStatusCode,
  RequestContext,
  RoutingContext,
} from './error-page'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'Server Error!'
  }
}

/**
 * HTTP error handler with Ignition-style error pages
 */
export class HttpErrorHandler {
  private handler = createErrorHandler()
  private isDevelopment: boolean

  constructor(options?: {
    isDevelopment?: boolean
    config?: ErrorPageConfig
  }) {
    this.isDevelopment = options?.isDevelopment ?? process.env.NODE_ENV !== 'production'

    if (options?.config) {
      this.handler = createErrorHandler(options.config)
    }

    // Set framework info
    this.handler.setFramework('Stacks')
  }

  /**
   * Set request context
   */
  setRequest(request: Request | RequestContext): this {
    this.handler.setRequest(request)
    return this
  }

  /**
   * Set routing context
   */
  setRouting(routing: RoutingContext): this {
    this.handler.setRouting(routing)
    return this
  }

  /**
   * Add a query to track
   */
  addQuery(query: string, time?: number, connection?: string): this {
    this.handler.addQuery(query, time, connection)
    return this
  }

  /**
   * Handle an error and return an HTML response
   */
  handle(error: Error, status: number = 500): Response {
    if (this.isDevelopment) {
      return this.handler.handleError(error, status)
    }

    // Production: show simple error page without details
    return new Response(renderProductionErrorPage(status), {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  /**
   * Create a 404 Not Found response
   */
  notFound(message?: string): Response {
    const error = new HttpError(404, message || 'The requested resource could not be found.')
    return this.handle(error, 404)
  }

  /**
   * Create a 500 Internal Server Error response
   */
  serverError(error: Error): Response {
    return this.handle(error, 500)
  }

  /**
   * Create a 403 Forbidden response
   */
  forbidden(message?: string): Response {
    const error = new HttpError(403, message || 'You do not have permission to access this resource.')
    return this.handle(error, 403)
  }

  /**
   * Create a 401 Unauthorized response
   */
  unauthorized(message?: string): Response {
    const error = new HttpError(401, message || 'Authentication is required to access this resource.')
    return this.handle(error, 401)
  }

  /**
   * Create a 400 Bad Request response
   */
  badRequest(message?: string): Response {
    const error = new HttpError(400, message || 'The request was malformed or invalid.')
    return this.handle(error, 400)
  }

  /**
   * Create a 422 Unprocessable Entity response
   */
  validationError(message?: string): Response {
    const error = new HttpError(422, message || 'The request was well-formed but could not be processed.')
    return this.handle(error, 422)
  }

  /**
   * Create a 429 Too Many Requests response
   */
  tooManyRequests(message?: string): Response {
    const error = new HttpError(429, message || 'You have exceeded the rate limit.')
    return this.handle(error, 429)
  }

  /**
   * Create a 503 Service Unavailable response
   */
  serviceUnavailable(message?: string): Response {
    const error = new HttpError(503, message || 'The service is temporarily unavailable.')
    return this.handle(error, 503)
  }
}

/**
 * Create a new HTTP error handler
 */
export function createHttpErrorHandler(options?: {
  isDevelopment?: boolean
  config?: ErrorPageConfig
}): HttpErrorHandler {
  return new HttpErrorHandler(options)
}

/**
 * Quick helper to render an error page for HTTP errors
 */
export function renderHttpError(
  error: Error,
  request?: Request,
  options?: {
    status?: number
    isDevelopment?: boolean
    config?: ErrorPageConfig
  },
): Response {
  const handler = createHttpErrorHandler({
    isDevelopment: options?.isDevelopment,
    config: options?.config,
  })

  if (request) {
    handler.setRequest(request)
  }

  return handler.handle(error, options?.status)
}

/**
 * Express/Hono style error middleware
 */
export function errorMiddleware(options?: {
  isDevelopment?: boolean
  config?: ErrorPageConfig
}) {
  const handler = createHttpErrorHandler(options)

  return async (error: Error, request: Request): Promise<Response> => {
    handler.setRequest(request)

    // Determine status code
    let status = 500
    if (error instanceof HttpError) {
      status = error.status
    }
    else if ('status' in error && typeof error.status === 'number') {
      status = error.status as number
    }
    else if ('statusCode' in error && typeof error.statusCode === 'number') {
      status = error.statusCode as number
    }

    return handler.handle(error, status)
  }
}
