import type { ResponseInstance } from '@stacksjs/types'

/**
 * Response data structure for Stacks framework
 */
export interface ResponseData {
  status: number
  headers: Record<string, string>
  body: string
}

/**
 * Cookie options for setting cookies in responses
 */
export interface CookieOptions {
  /** Cookie expiration date */
  expires?: Date
  /** Max age in seconds */
  maxAge?: number
  /** Cookie domain */
  domain?: string
  /** Cookie path */
  path?: string
  /** Secure flag (HTTPS only) */
  secure?: boolean
  /** HttpOnly flag (not accessible via JavaScript) */
  httpOnly?: boolean
  /** SameSite attribute */
  sameSite?: 'strict' | 'lax' | 'none'
}

/**
 * Stacks Response class - provides response formatting utilities
 *
 * This class provides:
 * - Standardized JSON response formatting
 * - HTTP status code helpers
 * - Error response formatting
 * - Cookie management
 * - Integration with bun-router's response patterns
 */
export class StacksResponse implements ResponseInstance {
  // ============================================================================
  // JSON RESPONSES
  // ============================================================================

  /**
   * Create a JSON response with standardized formatting
   *
   * For success (2xx-3xx): wraps data in { data: ... }
   * For errors (4xx-5xx): wraps data in { errors: ... }
   */
  json(data: any, statusCode: number = 200): ResponseData {
    const isErrorStatus = statusCode >= 400
    return {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isErrorStatus ? { errors: data } : { data }),
    }
  }

  /**
   * Create a raw JSON response without wrapping
   */
  rawJson(data: any, statusCode: number = 200): ResponseData {
    return {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  }

  // ============================================================================
  // SUCCESS RESPONSES
  // ============================================================================

  /**
   * 200 OK - Standard success response
   */
  success(data: any): ResponseData {
    return this.json(data, 200)
  }

  /**
   * 201 Created - Resource created successfully
   */
  created(data: any): ResponseData {
    return this.json(data, 201)
  }

  /**
   * 202 Accepted - Request accepted for processing
   */
  accepted(data?: any): ResponseData {
    return this.json(data ?? { message: 'Accepted' }, 202)
  }

  /**
   * 204 No Content - Success with no response body
   */
  noContent(): ResponseData {
    return {
      status: 204,
      headers: { 'Content-Type': 'application/json' },
      body: '',
    }
  }

  // ============================================================================
  // ERROR RESPONSES
  // ============================================================================

  /**
   * Generic error response
   */
  error(message: string, statusCode: number = 500): ResponseData {
    return this.json({ error: message }, statusCode)
  }

  /**
   * 400 Bad Request - Invalid request data
   */
  badRequest(message: string = 'Bad Request'): ResponseData {
    return this.error(message, 400)
  }

  /**
   * 401 Unauthorized - Authentication required
   */
  unauthorized(message: string = 'Unauthorized'): ResponseData {
    return this.error(message, 401)
  }

  /**
   * 403 Forbidden - Access denied
   */
  forbidden(message: string = 'Forbidden'): ResponseData {
    return this.error(message, 403)
  }

  /**
   * 404 Not Found - Resource not found
   */
  notFound(message: string = 'Not Found'): ResponseData {
    return this.error(message, 404)
  }

  /**
   * 405 Method Not Allowed
   */
  methodNotAllowed(message: string = 'Method Not Allowed'): ResponseData {
    return this.error(message, 405)
  }

  /**
   * 409 Conflict - Resource conflict
   */
  conflict(message: string = 'Conflict'): ResponseData {
    return this.error(message, 409)
  }

  /**
   * 422 Unprocessable Entity - Validation errors
   */
  unprocessableEntity(errors: any): ResponseData {
    return this.json(errors, 422)
  }

  /**
   * 429 Too Many Requests - Rate limited
   */
  tooManyRequests(message: string = 'Too Many Requests'): ResponseData {
    return this.error(message, 429)
  }

  /**
   * 500 Internal Server Error
   */
  serverError(message: string = 'Internal Server Error'): ResponseData {
    return this.error(message, 500)
  }

  /**
   * 502 Bad Gateway
   */
  badGateway(message: string = 'Bad Gateway'): ResponseData {
    return this.error(message, 502)
  }

  /**
   * 503 Service Unavailable
   */
  serviceUnavailable(message: string = 'Service Unavailable'): ResponseData {
    return this.error(message, 503)
  }

  // ============================================================================
  // REDIRECT RESPONSES
  // ============================================================================

  /**
   * 301 Moved Permanently
   */
  movedPermanently(url: string): ResponseData {
    return {
      status: 301,
      headers: { Location: url },
      body: '',
    }
  }

  /**
   * 302 Found (Temporary Redirect)
   */
  redirect(url: string): ResponseData {
    return {
      status: 302,
      headers: { Location: url },
      body: '',
    }
  }

  /**
   * 307 Temporary Redirect (preserves method)
   */
  temporaryRedirect(url: string): ResponseData {
    return {
      status: 307,
      headers: { Location: url },
      body: '',
    }
  }

  /**
   * 308 Permanent Redirect (preserves method)
   */
  permanentRedirect(url: string): ResponseData {
    return {
      status: 308,
      headers: { Location: url },
      body: '',
    }
  }

  // ============================================================================
  // RESPONSE BUILDERS
  // ============================================================================

  /**
   * Convert ResponseData to a native Response object
   */
  toResponse(responseData: ResponseData): Response {
    return new Response(responseData.body || null, {
      status: responseData.status,
      headers: responseData.headers,
    })
  }

  /**
   * Create a streaming response
   */
  stream(
    stream: ReadableStream,
    options: { status?: number; headers?: Record<string, string> } = {},
  ): Response {
    return new Response(stream, {
      status: options.status ?? 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Transfer-Encoding': 'chunked',
        ...options.headers,
      },
    })
  }

  /**
   * Create a file download response
   */
  download(
    content: BlobPart,
    filename: string,
    contentType: string = 'application/octet-stream',
  ): Response {
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  /**
   * Create a Server-Sent Events (SSE) response
   */
  sse(stream: ReadableStream): Response {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // ============================================================================
  // COOKIE HELPERS
  // ============================================================================

  /**
   * Serialize a cookie to a Set-Cookie header value
   */
  serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

    if (options.expires) {
      cookie += `; Expires=${options.expires.toUTCString()}`
    }

    if (options.maxAge !== undefined) {
      cookie += `; Max-Age=${options.maxAge}`
    }

    if (options.domain) {
      cookie += `; Domain=${options.domain}`
    }

    if (options.path) {
      cookie += `; Path=${options.path}`
    }

    if (options.secure) {
      cookie += '; Secure'
    }

    if (options.httpOnly) {
      cookie += '; HttpOnly'
    }

    if (options.sameSite) {
      cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`
    }

    return cookie
  }

  /**
   * Create a response with a Set-Cookie header
   */
  withCookie(
    responseData: ResponseData,
    name: string,
    value: string,
    options: CookieOptions = {},
  ): ResponseData {
    const cookieHeader = this.serializeCookie(name, value, options)
    return {
      ...responseData,
      headers: {
        ...responseData.headers,
        'Set-Cookie': cookieHeader,
      },
    }
  }

  /**
   * Create a response that deletes a cookie
   */
  withoutCookie(responseData: ResponseData, name: string): ResponseData {
    const cookieHeader = this.serializeCookie(name, '', {
      expires: new Date(0),
      path: '/',
    })
    return {
      ...responseData,
      headers: {
        ...responseData.headers,
        'Set-Cookie': cookieHeader,
      },
    }
  }

  // ============================================================================
  // HEADER HELPERS
  // ============================================================================

  /**
   * Add headers to a response
   */
  withHeaders(responseData: ResponseData, headers: Record<string, string>): ResponseData {
    return {
      ...responseData,
      headers: {
        ...responseData.headers,
        ...headers,
      },
    }
  }

  /**
   * Add CORS headers to a response
   */
  withCors(
    responseData: ResponseData,
    options: {
      origin?: string
      methods?: string[]
      headers?: string[]
      credentials?: boolean
      maxAge?: number
    } = {},
  ): ResponseData {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': options.origin ?? '*',
    }

    if (options.methods) {
      corsHeaders['Access-Control-Allow-Methods'] = options.methods.join(', ')
    }

    if (options.headers) {
      corsHeaders['Access-Control-Allow-Headers'] = options.headers.join(', ')
    }

    if (options.credentials) {
      corsHeaders['Access-Control-Allow-Credentials'] = 'true'
    }

    if (options.maxAge) {
      corsHeaders['Access-Control-Max-Age'] = String(options.maxAge)
    }

    return this.withHeaders(responseData, corsHeaders)
  }

  /**
   * Add cache control headers
   */
  withCache(
    responseData: ResponseData,
    options: {
      maxAge?: number
      sMaxAge?: number
      public?: boolean
      private?: boolean
      noCache?: boolean
      noStore?: boolean
      immutable?: boolean
    } = {},
  ): ResponseData {
    const directives: string[] = []

    if (options.public) directives.push('public')
    if (options.private) directives.push('private')
    if (options.noCache) directives.push('no-cache')
    if (options.noStore) directives.push('no-store')
    if (options.maxAge !== undefined) directives.push(`max-age=${options.maxAge}`)
    if (options.sMaxAge !== undefined) directives.push(`s-maxage=${options.sMaxAge}`)
    if (options.immutable) directives.push('immutable')

    return this.withHeaders(responseData, {
      'Cache-Control': directives.join(', '),
    })
  }
}

/**
 * Singleton response instance
 */
export const response: StacksResponse = new StacksResponse()

/**
 * Alias for StacksResponse class
 */
export const Response = StacksResponse

/**
 * Re-export ResponseData type
 */
export type { ResponseData as StacksResponseData }
