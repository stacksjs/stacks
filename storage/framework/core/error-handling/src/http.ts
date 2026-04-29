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
  /**
   * Optional structured payload that will be serialized into the JSON
   * error response (`{ error: message, details: ... }`). Used by validation
   * to attach the per-field error map so clients can render inline messages
   * instead of having to parse `JSON.stringify(errors)` out of `.message`.
   */
  public details?: unknown

  constructor(public status: number, message: string, details?: unknown) {
    super(message)
    // Name maps to the standard HTTP reason phrase so clients see
    // `{ "error": "Unauthorized" }` for 401, `"Forbidden"` for 403, etc.
    // Used to be the literal string "Server Error!" for every status,
    // which made every 4xx look like a 5xx in dashboards and logs.
    this.name = httpStatusName(status)
    if (details !== undefined) this.details = details
  }
}

function httpStatusName(status: number): string {
  switch (status) {
    case 400: return 'Bad Request'
    case 401: return 'Unauthorized'
    case 402: return 'Payment Required'
    case 403: return 'Forbidden'
    case 404: return 'Not Found'
    case 405: return 'Method Not Allowed'
    case 408: return 'Request Timeout'
    case 409: return 'Conflict'
    case 410: return 'Gone'
    case 413: return 'Payload Too Large'
    case 415: return 'Unsupported Media Type'
    case 422: return 'Unprocessable Entity'
    case 423: return 'Locked'
    case 425: return 'Too Early'
    case 426: return 'Upgrade Required'
    case 428: return 'Precondition Required'
    case 429: return 'Too Many Requests'
    case 431: return 'Request Header Fields Too Large'
    case 451: return 'Unavailable For Legal Reasons'
    case 500: return 'Internal Server Error'
    case 501: return 'Not Implemented'
    case 502: return 'Bad Gateway'
    case 503: return 'Service Unavailable'
    case 504: return 'Gateway Timeout'
    case 507: return 'Insufficient Storage'
    case 508: return 'Loop Detected'
    case 511: return 'Network Authentication Required'
    default: return status >= 400 && status < 500 ? 'Client Error' : 'Server Error'
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
